// Field data for the serpentinization lab: water analyses with optional coordinates,
// ORP and dissolved gases, normalised to mmol/L so that calculators, diagrams and the map
// all read the same numbers. Columns are recognised with the same rules as the Excel import.
import { guessColumn, type Sheet } from '../excel.ts';

export interface FieldSample {
  id: string;
  name: string;
  lat?: number; lon?: number;
  temp?: number; pH?: number;
  orp?: number;            // mV, as read on the meter (vs. reference electrode)
  eh?: number;             // mV vs. SHE when the sheet gives Eh directly
  /** mmol/L of element (Alkalinity in meq/L; H2 and CH4 in mmol/L of the molecule). */
  conc: Record<string, number>;
  group?: string;          // reference library: site group
  ref?: string;            // reference library: citation key
}

// atomic and formula weights (g/mol)
const GFW: Record<string, number> = {
  Ca: 40.078, Mg: 24.305, Na: 22.99, K: 39.098, Fe: 55.845, Mn: 54.938, Sr: 87.62, Ba: 137.33, Li: 6.94, Al: 26.982,
  Si: 28.086, Cl: 35.453, S: 32.06, N: 14.007, F: 18.998, Br: 79.904, B: 10.81, C: 12.011, P: 30.974, H: 1.008, O: 15.999,
  Ni: 58.693, Cr: 51.996, Co: 58.933, Zn: 65.38, Cu: 63.546,
  SO4: 96.06, NO3: 62.004, NO2: 46.006, NH4: 18.038, SiO2: 60.084, HCO3: 61.017, CaCO3: 100.087, CO3: 60.009, PO4: 94.971,
  H2S: 34.08, HS: 33.07, CH4: 16.043, H2: 2.016, O2: 31.998, CO2: 44.01, H4SiO4: 96.115,
};

/** Element keys the lab understands, with the charge of the ion that dominates in natural water. */
export const IONS: Record<string, number> = {
  Ca: 2, Mg: 2, Na: 1, K: 1, Fe: 2, Mn: 2, Sr: 2, Ba: 2, Li: 1, 'N(-3)': 1,
  Cl: -1, 'S(6)': -2, 'N(5)': -1, F: -1, Br: -1,
};
export const CONC_KEYS = ['Ca', 'Mg', 'Na', 'K', 'Fe', 'Mn', 'Sr', 'Ba', 'Li', 'Al', 'Si', 'Cl', 'S(6)', 'S(-2)', 'N(5)', 'N(-3)', 'F', 'Br', 'B',
  'Alkalinity', 'C(4)', 'H2', 'CH4', 'O(0)', 'Ni', 'Cr'];

const base = (el: string) => el.replace(/\(.*\)$/, '');

/** Converts one value to mmol/L of the element (meq/L for alkalinity). */
export function toMmol(value: number, key: string, unitText: string, defaultUnit: string): number {
  const asM = unitText.match(/\bas\s+([A-Za-z0-9]+)/i);
  const unit = (unitText.replace(/\bas\s+[A-Za-z0-9]+/i, '').trim() || defaultUnit).toLowerCase().replace('µ', 'u');
  if (key === 'Alkalinity') {
    const eqw = asM && /hco3/i.test(asM[1]) ? GFW.HCO3 : GFW.CaCO3 / 2;   // PHREEQC default: as CaCO3
    if (/meq/.test(unit) || /mmol/.test(unit)) return value;
    if (/umol|ueq/.test(unit)) return value / 1000;
    if (/mol\/kgw|^mol/.test(unit)) return value * 1000;
    const mg = /ug|ppb/.test(unit) ? value / 1000 : value;
    return mg / eqw;
  }
  const species = asM?.[1] ?? (key === 'H2' ? 'H2' : key === 'CH4' ? 'CH4' : base(key));
  const w = GFW[species] ?? GFW[base(key)] ?? NaN;
  // a formula with two atoms of the element (none of the "as" forms used here) would need a factor
  if (/^mmol|^mmol\/kgw/.test(unit)) return value;
  if (/^umol/.test(unit)) return value / 1000;
  if (/^mol/.test(unit)) return value * 1000;
  if (/meq/.test(unit)) { const z = Math.abs(IONS[key] ?? 1); return value / z; }
  if (/ug|ppb/.test(unit)) return value / 1000 / w;
  return value / w;   // mg/L, ppm
}

type Target = { kind: 'id' | 'name' | 'lat' | 'lon' | 'temp' | 'pH' | 'orp' | 'eh' | 'pe' | 'skip' } | { kind: 'conc'; key: string; unit: string };

export function mapHeader(h: string, unitRow: string): Target {
  const k = h.toLowerCase().replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const first = k.split(/[\s_]/)[0];
  if (/^(lat|latitude|lintang)$/.test(first)) return { kind: 'lat' };
  if (/^(lon|long|lng|longitude|bujur)$/.test(first)) return { kind: 'lon' };
  if (/^orp/.test(first)) return { kind: 'orp' };
  if (/^eh$/.test(first)) return { kind: 'eh' };
  if (/^(h2|hydrogen|h2_aq|dissolved_h2)$/.test(k.replace(/\s.*$/, '')) || /^dissolved h2/.test(k)) {
    return { kind: 'conc', key: 'H2', unit: (h.match(/(mg|ug|µg|mmol|umol|µmol|nmol)\/?l/i)?.[0] ?? unitRow).trim() };
  }
  if (/^nmol/.test(unitRow.toLowerCase())) return { kind: 'skip' };
  const g = guessColumn(h, unitRow);
  if (!g.target) return { kind: 'skip' };
  if (g.target === 'number') return { kind: 'id' };
  if (g.target === 'desc') return { kind: 'name' };
  if (g.target === 'temp' || g.target === 'pH' || g.target === 'pe') return { kind: g.target };
  if (g.target === 'density') return { kind: 'skip' };
  let key = g.target;
  if (key === 'H(0)') { return { kind: 'conc', key: 'H(0)', unit: g.unit }; }
  if (key === 'C(-4)') key = 'CH4';
  if (key === 'S') key = 'S(6)';
  if (key === 'N') key = 'N(5)';
  if (key === 'C') key = 'C(4)';
  if (key === 'Fe(2)' || key === 'Fe(3)') key = 'Fe';
  return { kind: 'conc', key, unit: g.target === 'C(-4)' ? g.unit.replace(/\s*as\s+CH4/i, '') : g.unit };
}

export interface FieldTable { samples: FieldSample[]; mapped: { header: string; to: string }[]; skipped: string[] }

/** Reads the first useful sheet: a header row, an optional unit row, then one row per sample. */
export function readField(sheets: Sheet[], defaultUnit = 'mg/L'): FieldTable {
  const sheet = sheets.find(s => /field|sample|data|solution/i.test(s.name)) ?? sheets[0];
  if (!sheet) return { samples: [], mapped: [], skipped: [] };
  const rows = sheet.rows.filter(r => r.some(c => c !== null && String(c).trim() !== ''));
  const header = (rows[0] ?? []).map(c => String(c ?? '').trim());
  const second = rows[1] ?? [];
  const isUnitRow = second.length > 0 && second.some((c, i) => header[i] && c != null && String(c).trim() !== '' && !Number.isFinite(Number(c)))
    && !second.some((c, i) => /^(ph|temp)/i.test(header[i] ?? '') && Number.isFinite(Number(c)) && String(c ?? '').trim() !== '');
  const targets = header.map((h, i) => (h ? mapHeader(h, isUnitRow ? String(second[i] ?? '') : '') : { kind: 'skip' as const }));
  const data = rows.slice(isUnitRow ? 2 : 1).filter(r => !String(r[0] ?? '').startsWith('#'));
  const num = (v: unknown) => (v == null || String(v).trim() === '' || !Number.isFinite(Number(v)) ? undefined : Number(v));
  const samples = data.map((r, i): FieldSample => {
    const s: FieldSample = { id: String(i + 1), name: '', conc: {} };
    targets.forEach((tg, c) => {
      const v = r[c];
      if (tg.kind === 'id') { if (v != null && String(v).trim()) s.id = String(v).trim(); return; }
      if (tg.kind === 'name') { if (v != null) s.name = String(v).trim(); return; }
      const n = num(v);
      if (n == null) return;
      if (tg.kind === 'conc') {
        if (tg.key === 'H(0)') { s.conc.H2 = toMmol(n, 'H', tg.unit, defaultUnit) / 2; return; }   // H(0) counts H atoms
        s.conc[tg.key] = toMmol(n, tg.key, tg.unit, defaultUnit);
      } else if (tg.kind !== 'skip') (s as unknown as Record<string, number>)[tg.kind] = n;
    });
    if (!s.name) s.name = s.id;
    return s;
  }).filter(s => Object.keys(s.conc).length || s.pH != null || s.lat != null);
  const label = (t: Target) => (t.kind === 'conc' ? `${t.key}${t.unit ? ' (' + t.unit + ')' : ''}` : t.kind);
  return {
    samples,
    mapped: header.map((h, i) => ({ header: h, to: targets[i].kind === 'skip' ? '' : label(targets[i]) })).filter(m => m.header && m.to),
    skipped: header.filter((h, i) => h && targets[i].kind === 'skip'),
  };
}

// ---------------- calculators ----------------
export const F = 96485.332, R = 8.314462618;
/** pe from Eh (V) at temperature T (°C). */
export const peFromEh = (ehV: number, tC: number) => ehV * F / (Math.LN10 * R * (tC + 273.15));

export interface RefElectrode { id: string; e25: number; dEdT: number }   // V vs SHE at 25 °C, V/°C
// Typical values; the probe manual is the authority for a given sensor.
export const ELECTRODES: RefElectrode[] = [
  { id: 'agcl_3m', e25: 0.210, dEdT: -0.00073 },
  { id: 'agcl_35m', e25: 0.205, dEdT: -0.00073 },
  { id: 'agcl_sat', e25: 0.197, dEdT: -0.00101 },
  { id: 'sce', e25: 0.244, dEdT: -0.00067 },
  { id: 'she', e25: 0, dEdT: 0 },
];
export function orpToPe(orpMv: number, tC: number, el: RefElectrode) {
  const eref = el.e25 + el.dEdT * (tC - 25);
  const eh = orpMv / 1000 + eref;
  return { eref, eh, pe: peFromEh(eh, tC) };
}

// Henry's law constants (mol L-1 atm-1 at 25 °C) and van 't Hoff temperature terms (K),
// typical values from the compilation of Sander (2015, Atmos. Chem. Phys. 15, 4399–4981).
export const HENRY: Record<'H2' | 'CH4', { kH: number; dT: number; M: number }> = {
  H2: { kH: 7.8e-4, dT: 500, M: 2.016 },
  CH4: { kH: 1.4e-3, dT: 1600, M: 16.043 },
};
export const henryAt = (gas: 'H2' | 'CH4', tC: number) => HENRY[gas].kH * Math.exp(HENRY[gas].dT * (1 / (tC + 273.15) - 1 / 298.15));

/**
 * Headspace equilibration: a water sample of volume Vw shares a sealed vial with a gas of volume Vg;
 * after shaking, the gas holds x ppmv of the target gas at total pressure P (atm) and temperature T.
 * Returns the concentration in the original water (all gas was dissolved), mol/L.
 */
export function headspace(gas: 'H2' | 'CH4', ppmv: number, vGasMl: number, vWaterMl: number, tC: number, pAtm = 1, blankPpmv = 0) {
  const p = Math.max(0, ppmv - blankPpmv) * 1e-6 * pAtm;           // partial pressure after equilibration, atm
  const kH = henryAt(gas, tC);
  const cEq = kH * p;                                               // mol/L left in the water
  const nGas = p * (vGasMl / 1000) / (0.082057366 * (tC + 273.15)); // mol in the headspace
  const c0 = cEq + nGas / (vWaterMl / 1000);
  return { kH, pPartial: p, cEq, nGas, c0, fracInGas: nGas / (c0 * vWaterMl / 1000) };
}

// ---------------- charge balance (quick 25 °C estimate) ----------------
// pKw(T) after Harned & Owen; T in kelvin
const pKw = (tC = 25) => { const T = tC + 273.15; return 4470.99 / T - 6.0875 + 0.01706 * T; };
const K_HCO3 = 10 ** -10.33, K_SIL = 10 ** -9.84;
export interface CB { cations: number; anions: number; cbe: number; parts: [string, number][] }
export function chargeBalance(s: FieldSample): CB | null {
  const parts: [string, number][] = [];
  for (const [k, z] of Object.entries(IONS)) if (s.conc[k] != null) parts.push([k, s.conc[k] * z]);
  // at pH >= 10 alkalinity is mostly OH- (as in the SOLUTION blocks): count OH- and silicate instead
  const alk = s.conc.Alkalinity != null && (s.pH == null || s.pH < 10);
  if (alk) parts.push(['Alkalinity', -s.conc.Alkalinity!]);
  if (!alk && s.conc['C(4)'] != null && s.pH != null) {
    // DIC as HCO3- and CO3-2 only (above pH ~6.5, CO2(aq) is small)
    const h = 10 ** -s.pH, a = s.conc['C(4)'] / (1 + K_HCO3 / h + h / 10 ** -6.35);
    parts.push(['HCO3-/CO3-2', -(a + 2 * a * K_HCO3 / h)]);
  }
  if (s.pH != null) {
    if (!alk) parts.push(['OH-', -1000 * 10 ** (s.pH - pKw(s.temp ?? 25))]);
    parts.push(['H+', 1000 * 10 ** -s.pH]);
    if (s.conc.Si != null && !alk) parts.push(['H3SiO4-', -s.conc.Si / (1 + 10 ** -s.pH / K_SIL)]);
  }
  if (parts.length < 2) return null;
  const cations = parts.filter(p => p[1] > 0).reduce((a, p) => a + p[1], 0);
  const anions = -parts.filter(p => p[1] < 0).reduce((a, p) => a + p[1], 0);
  return { cations, anions, cbe: cations + anions > 0 ? 100 * (cations - anions) / (cations + anions) : 0, parts };
}

// ---------------- PHREEQC SOLUTION blocks ----------------
const fmt = (v: number) => String(+v.toPrecision(5));
export function fieldSolutions(samples: FieldSample[], peDefault = 4, electrode?: RefElectrode): string {
  return samples.map((s, i) => {
    const L = [`SOLUTION ${i + 1}  ${s.name.replace(/\s+/g, ' ').slice(0, 60)}`, `    units      mmol/L`];
    if (s.temp != null) L.push(`    temp       ${fmt(s.temp)}`);
    if (s.pH != null) L.push(`    pH         ${fmt(s.pH)}`);
    let pe: number | undefined;
    if (s.eh != null) pe = peFromEh(s.eh / 1000, s.temp ?? 25);
    else if (s.orp != null && electrode) pe = orpToPe(s.orp, s.temp ?? 25, electrode).pe;
    L.push(`    pe         ${fmt(pe ?? peDefault)}${pe != null ? '   # from ' + (s.eh != null ? 'Eh' : 'ORP') : ''}`);
    for (const [k, v] of Object.entries(s.conc)) {
      if (!(v > 0)) continue;
      if (k === 'H2') L.push(`    H(0)       ${fmt(2 * v)}   # = ${fmt(v)} mmol/L H2 (H(0) counts H atoms)`);
      else if (k === 'CH4') L.push(`    C(-4)      ${fmt(v)}`);
      else if (k === 'Alkalinity') {
        // above pH ~10 alkalinity is mostly OH- and silicate; PHREEQC cannot attribute it to carbonate
        if ((s.pH ?? 7) >= 10 && s.conc['C(4)'] == null) L.push(`    # Alkalinity ${fmt(v)} meq/L left out: at pH >= 10 enter DIC as C(4) instead`);
        else if (s.conc['C(4)'] == null) L.push(`    Alkalinity ${fmt(v)}   # meq/L`);
      }
      else L.push(`    ${k.padEnd(11)}${fmt(v)}`);
    }
    return L.join('\n');
  }).join('\n');
}

export async function fieldTemplate() {
  const { default: ExcelJS } = await import('exceljs');
  const { saveBlob } = await import('../download.ts');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aquos Geochemistry';
  const ws = wb.addWorksheet('Field data');
  const head = ['Sample', 'Site', 'Latitude', 'Longitude', 'Temp', 'pH', 'ORP', 'Ca', 'Mg', 'Na', 'K', 'Si', 'Cl', 'SO4', 'Alkalinity', 'Fe', 'H2', 'CH4'];
  const unit = ['', '', 'decimal °', 'decimal °', '°C', '', 'mV', 'mg/L', 'mg/L', 'mg/L', 'mg/L', 'mg/L as SiO2', 'mg/L', 'mg/L', 'mg/L as HCO3', 'mg/L', 'umol/L', 'umol/L'];
  ws.addRow(head).font = { bold: true };
  const ur = ws.addRow(unit); ur.font = { italic: true, color: { argb: 'FF5A6B73' } };
  ws.addRow(['S-01', 'Spring A (example)', -2.55, 121.35, 32.5, 11.4, -420, 58, 0.12, 95, 4.1, 0.9, 92, 24, '', 0.005, 175, 3]);
  ws.addRow(['W-02', 'Well B (example)', -2.6, 121.4, 27.0, 8.35, 120, 6.5, 42, 12, 0.8, 18, 15, 27, 230, '', '', '']);
  ws.columns.forEach(c => { c.width = 13; });
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  const g = wb.addWorksheet('Guide');
  g.addRow(['Column', 'Meaning']).font = { bold: true };
  for (const r of [
    ['Sample, Site', 'Identifier and a free-text name'],
    ['Latitude, Longitude', 'Decimal degrees, WGS84 (south and west are negative)'],
    ['Temp, pH', 'Field temperature (°C) and pH'],
    ['ORP or Eh', 'ORP in mV as read on the meter (choose the reference electrode in the app), or Eh in mV vs. SHE'],
    ['Ca, Mg, Na …', 'One column per element; the second row gives the unit (mg/L, mmol/L, umol/L, ug/L, meq/L) and "as SiO2", "as HCO3", "as SO4" where needed'],
    ['Alkalinity, DIC', 'Alkalinity "as HCO3" or "as CaCO3"; for pH ≥ 10 give DIC (column DIC, mmol/L) instead, because alkalinity there is mostly OH-'],
    ['H2, CH4', 'Dissolved gas, e.g. from the headspace calculator: umol/L, mmol/L or mg/L of the molecule'],
  ]) g.addRow(r);
  g.columns.forEach((c, i) => { c.width = i ? 100 : 22; });
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'aquos-field-data-template.xlsx');
}
