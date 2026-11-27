// Excel / CSV import and the downloadable template.
// The workbook is read in the browser; rows become SOLUTION blocks.

export interface Sheet { name: string; rows: (string | number | null)[][] }
export interface ColumnMap {
  col: number;
  header: string;
  target: string;        // '' = skip; 'number' | 'desc' | 'temp' | 'pH' | 'pe' | 'density' | element name
  unit: string;          // per-column unit or "as ..." text, may be ''
  confident: boolean;
}

export const UNITS = ['mg/L', 'mmol/L', 'umol/L', 'ug/L', 'meq/L', 'ppm', 'ppb', 'mol/kgw', 'mmol/kgw', 'umol/kgw', 'mg/kgs', 'g/kgs'];
export const SPECIAL = ['number', 'desc', 'temp', 'pH', 'pe', 'density'];

const ELEMENTS = ['Alkalinity', 'Ca', 'Mg', 'Na', 'K', 'Fe', 'Fe(2)', 'Fe(3)', 'Mn', 'Mn(2)', 'Al', 'Ba', 'Sr', 'Si', 'Cl', 'C', 'C(4)', 'C(-4)',
  'S', 'S(6)', 'S(-2)', 'N', 'N(5)', 'N(3)', 'N(0)', 'N(-3)', 'Amm', 'P', 'F', 'Br', 'B', 'Li', 'Cs', 'Rb', 'Zn', 'Cu', 'Pb', 'Cd', 'Ni', 'Co', 'Cr',
  'U', 'As', 'Se', 'Hg', 'Ag', 'Mo', 'V', 'O(0)', 'H(0)', 'I', 'Ra', 'Rn', 'Th', 'Tritium', 'Doc'];
export const ELEMENT_CHOICES = ELEMENTS;

// common column names -> [PHREEQC name, implied "as"]
const ALIASES: Record<string, [string, string]> = {
  calcium: ['Ca', ''], magnesium: ['Mg', ''], sodium: ['Na', ''], potassium: ['K', ''], iron: ['Fe', ''], manganese: ['Mn', ''],
  aluminum: ['Al', ''], aluminium: ['Al', ''], barium: ['Ba', ''], strontium: ['Sr', ''], silica: ['Si', 'as SiO2'], silicon: ['Si', ''],
  chloride: ['Cl', ''], fluoride: ['F', ''], bromide: ['Br', ''], boron: ['B', ''], lithium: ['Li', ''], zinc: ['Zn', ''], copper: ['Cu', ''],
  lead: ['Pb', ''], cadmium: ['Cd', ''], nickel: ['Ni', ''], uranium: ['U', ''], arsenic: ['As', ''], selenium: ['Se', ''],
  alk: ['Alkalinity', ''], alkalinity: ['Alkalinity', ''], hco3: ['Alkalinity', 'as HCO3'], bicarbonate: ['Alkalinity', 'as HCO3'],
  so4: ['S(6)', 'as SO4'], sulfate: ['S(6)', 'as SO4'], sulphate: ['S(6)', 'as SO4'], no3: ['N(5)', 'as NO3'], nitrate: ['N(5)', 'as NO3'],
  no2: ['N(3)', 'as NO2'], nitrite: ['N(3)', 'as NO2'], nh4: ['N(-3)', 'as NH4'], ammonium: ['N(-3)', 'as NH4'], po4: ['P', 'as PO4'], phosphate: ['P', 'as PO4'],
  sio2: ['Si', 'as SiO2'], h2s: ['S(-2)', 'as H2S'], sulfide: ['S(-2)', ''], sulphide: ['S(-2)', ''], ch4: ['C(-4)', 'as CH4'], methane: ['C(-4)', 'as CH4'], doc: ['Doc', ''], o2: ['O(0)', 'as O2'], do: ['O(0)', 'as O2'], dissolved_oxygen: ['O(0)', 'as O2'],
  fe2: ['Fe(2)', ''], fe3: ['Fe(3)', ''], fe_total: ['Fe', ''], fetot: ['Fe', ''], tic: ['C(4)', ''], dic: ['C(4)', ''],
};

const SPECIAL_ALIASES: Record<string, string> = {
  sample: 'number', id: 'number', no: 'number', number: 'number', nr: 'number', solution: 'number', num: 'number',
  name: 'desc', description: 'desc', desc: 'desc', site: 'desc', well: 'desc', location: 'desc', label: 'desc',
  temp: 'temp', temperature: 'temp', t: 'temp', temp_c: 'temp', ph: 'pH', pe: 'pe', density: 'density', dens: 'density',
};

const UNIT_RE = /(mg\/?l|mmol\/?l|umol\/?l|µmol\/?l|ug\/?l|µg\/?l|meq\/?l|ppm|ppb|mol\/?kgw|mmol\/?kgw|umol\/?kgw)/i;
const normUnit = (u: string) => {
  const m = u.toLowerCase().replace('µ', 'u').replace(/\s/g, '');
  const table: Record<string, string> = { mgl: 'mg/L', 'mg/l': 'mg/L', mmoll: 'mmol/L', 'mmol/l': 'mmol/L', umoll: 'umol/L', 'umol/l': 'umol/L', ugl: 'ug/L', 'ug/l': 'ug/L',
    meql: 'meq/L', 'meq/l': 'meq/L', ppm: 'ppm', ppb: 'ppb', molkgw: 'mol/kgw', 'mol/kgw': 'mol/kgw', mmolkgw: 'mmol/kgw', 'mmol/kgw': 'mmol/kgw', umolkgw: 'umol/kgw', 'umol/kgw': 'umol/kgw' };
  return table[m] ?? u;
};

/** Guesses the PHREEQC meaning of a column header such as "Ca_mgL", "SO4 (mg/L)" or "Temperature". */
export function guessColumn(header: string, unitRow = ''): Omit<ColumnMap, 'col'> {
  const h = header.trim();
  let unit = '';
  const um = h.match(UNIT_RE);
  if (um) unit = normUnit(um[1]);
  let base = h.replace(/\((?!-?\d+\))[^)]*\)|\[.*?\]/g, ' ').replace(UNIT_RE, ' ').replace(/[_\s]+$/g, '').replace(/^[_\s]+/, '').trim();
  base = base.replace(/[_\s-]+(mg|mmol|ug|meq)$/i, '');
  // spaces and hyphens become '_', except a minus sign inside a valence such as C(-4), S(-2), N(-3)
  const key = base.toLowerCase().replace(/[\s-]+(?![^(]*\))/g, '_').replace(/_+$/, '');
  const asText = unitRow.trim();
  const unitFromRow = asText && !/^as\b/i.test(asText) ? normUnit(asText) : '';
  const asFromRow = /^as\b/i.test(asText) ? asText : '';
  if (SPECIAL_ALIASES[key]) return { header: h, target: SPECIAL_ALIASES[key], unit: '', confident: true };
  if (/^(eh|orp)/.test(key)) return { header: h, target: '', unit: '', confident: false };
  const el = ELEMENTS.find(e => e.toLowerCase() === key || e.toLowerCase().replace(/[()]/g, '') === key.replace(/[()]/g, ''));
  if (el) return { header: h, target: el, unit: [unitFromRow || unit, asFromRow].filter(Boolean).join(' '), confident: true };
  if (ALIASES[key]) {
    const [t, as] = ALIASES[key];
    return { header: h, target: t, unit: [unitFromRow || unit, asFromRow || as].filter(Boolean).join(' '), confident: !/^fe_total|fetot$/.test(key) };
  }
  return { header: h, target: '', unit: '', confident: false };
}

/** Finds the header row, an optional unit row below it, and the data rows of the first useful sheet. */
export function readSamples(sheets: Sheet[]): { sheet: string; columns: ColumnMap[]; data: (string | number | null)[][] } {
  const sheet = sheets.find(s => /solution|sample|data/i.test(s.name)) ?? sheets[0];
  if (!sheet) return { sheet: '', columns: [], data: [] };
  const rows = sheet.rows.filter(r => r.some(c => c !== null && String(c).trim() !== ''));
  const header = (rows[0] ?? []).map(c => String(c ?? '').trim());
  const second = rows[1] ?? [];
  const numericCols = header.map((_, i) => rows.slice(2, 6).some(r => typeof r[i] === 'number' || (r[i] != null && r[i] !== '' && Number.isFinite(Number(r[i])))));
  const isUnitRow = second.length > 0 && header.some((_, i) => numericCols[i] && second[i] != null && String(second[i]).trim() !== '' && !Number.isFinite(Number(second[i])));
  const columns = header.map((hd, i) => ({ col: i, ...guessColumn(hd, isUnitRow ? String(second[i] ?? '') : '') })).filter(c => c.header);
  const data = rows.slice(isUnitRow ? 2 : 1).filter(r => !String(r[0] ?? '').startsWith('#'));
  return { sheet: sheet.name, columns, data };
}

export function buildSolutions(columns: ColumnMap[], data: (string | number | null)[][], units: string, startNumber = 1): string {
  const get = (r: (string | number | null)[], target: string) => {
    const c = columns.find(c => c.target === target);
    return c ? r[c.col] : null;
  };
  const elCols = columns.filter(c => c.target && !SPECIAL.includes(c.target));
  const out: string[] = [];
  data.forEach((r, i) => {
    const num = get(r, 'number');
    const n = num != null && Number.isInteger(Number(num)) && Number(num) > 0 ? Number(num) : startNumber + i;
    const desc = [get(r, 'desc'), num != null && !Number.isInteger(Number(num)) ? num : null].filter(v => v != null && String(v).trim()).join(' ');
    out.push(`SOLUTION ${n}${desc ? '  ' + desc : ''}`);
    out.push(`    units      ${units}`);
    for (const [t, label] of [['temp', 'temp'], ['pH', 'pH'], ['pe', 'pe'], ['density', 'density']] as const) {
      const v = get(r, t);
      if (v != null && String(v).trim() !== '' && Number.isFinite(Number(v))) out.push(`    ${label.padEnd(11)}${v}`);
    }
    for (const c of elCols) {
      const v = r[c.col];
      if (v == null || String(v).trim() === '' || !Number.isFinite(Number(v))) continue;
      let extra = c.unit;
      // drop the unit when it equals the block units
      extra = extra.split(/\s+(?=as\b)/).filter(p => p && p !== units).join(' ');
      out.push(`    ${c.target.padEnd(11)}${String(v).padEnd(10)}${extra}`.trimEnd());
    }
    out.push('');
  });
  return out.join('\n');
}

export function parseCSV(text: string): Sheet {
  const sep = (text.split('\n')[0].match(/;/g)?.length ?? 0) > (text.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : text.includes('\t') ? '\t' : ',';
  const rows: (string | number | null)[][] = [];
  let row: (string | number | null)[] = [], cur = '', q = false;
  const push = () => { const t = cur.trim(); row.push(t === '' ? null : Number.isFinite(Number(t)) ? Number(t) : t); cur = ''; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === sep) push();
    else if (ch === '\n') { push(); rows.push(row); row = []; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur || row.length) { push(); rows.push(row); }
  return { name: 'csv', rows };
}

export async function readWorkbook(file: File): Promise<Sheet[]> {
  if (/\.(csv|txt|tsv)$/i.test(file.name)) return [parseCSV(await file.text())];
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb.worksheets.map(ws => {
    const rows: (string | number | null)[][] = [];
    ws.eachRow({ includeEmpty: true }, (r, i) => {
      const vals = (r.values as unknown[]).slice(1).map(v => {
        if (v == null) return null;
        if (typeof v === 'object') {
          const o = v as { result?: unknown; text?: string; richText?: { text: string }[] };
          if (o.result != null) return o.result as number | string;
          if (o.richText) return o.richText.map(t => t.text).join('');
          if (o.text != null) return o.text;
          return String(v);
        }
        return v as number | string;
      });
      rows[i - 1] = vals;
    });
    return { name: ws.name, rows: Array.from(rows, r => r ?? []) };
  });
}

export async function downloadTemplate() {
  const { default: ExcelJS } = await import('exceljs');
  const { saveBlob } = await import('./download.ts');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aquos Geochemistry';
  const ws = wb.addWorksheet('Solutions');
  const head = ['Sample', 'Description', 'Temp', 'pH', 'pe', 'Ca', 'Mg', 'Na', 'K', 'Fe', 'Mn', 'Si', 'Cl', 'Alkalinity', 'S(6)', 'N(5)', 'F'];
  const unit = ['', '', '°C', '', '', '', '', '', '', '', '', 'as SiO2', '', 'as HCO3', 'as SO4', 'as NO3', ''];
  ws.addRow(head).font = { bold: true };
  const ur = ws.addRow(unit); ur.font = { italic: true, color: { argb: 'FF5A6B73' } };
  ws.addRow([1, 'Well W-01', 28.4, 6.85, 4, 48.2, 12.1, 25.3, 3.1, 0.42, 0.05, 32.0, 30.2, 182, 40.1, 2.3, 0.3]);
  ws.addRow([2, 'Well W-02', 27.9, 7.12, 4, 61.5, 15.4, 30.8, 3.6, 0.18, 0.02, 28.5, 35.7, 214, 55.0, 1.1, 0.2]);
  ws.addRow([3, 'Spring S-01', 29.1, 6.64, 4, 39.8, 9.7, 19.5, 2.4, 1.05, 0.11, 41.2, 22.4, 151, 28.6, 0.4, 0.5]);
  ws.columns.forEach(c => { c.width = 13; });
  ws.views = [{ state: 'frozen', ySplit: 2 }];

  const st = wb.addWorksheet('Settings');
  st.addRow(['Setting', 'Value', 'Notes']).font = { bold: true };
  st.addRow(['units', 'mg/L', UNITS.join(', ')]);
  st.addRow(['database', 'phreeqc.dat', 'Any of the 50 databases in the app']);
  st.columns.forEach(c => { c.width = 22; });

  const g = wb.addWorksheet('Guide');
  g.addRow(['Column', 'Meaning', 'Example']).font = { bold: true };
  const guide: [string, string, string][] = [
    ['Sample', 'Solution number (a whole number). Leave empty to number rows 1, 2, 3 …', '1'],
    ['Description', 'Free text shown after the number', 'Well W-01'],
    ['Temp', 'Temperature in °C', '25'],
    ['pH', 'pH', '7.0'],
    ['pe', 'Redox state as pe (optional)', '4'],
    ['Ca, Mg, Na …', 'One column per element, using PHREEQC names; valence states such as Fe(2), S(6), N(5) are allowed', 'Ca'],
    ['Alkalinity', 'Write "as HCO3" or "as CaCO3" in the second row', 'as HCO3'],
    ['S(6), N(5), Si …', 'Write "as SO4", "as NO3", "as SiO2" in the second row when values are given as the ion or oxide', 'as SO4'],
    ['Second row', 'Optional: a unit (mg/L, mmol/L …) or "as …" for each column', 'mmol/L'],
    ['Names like Ca_mgL, SO4, HCO3, NO3, Calcium', 'Are recognized automatically; check the mapping in the import window', ''],
  ];
  for (const r of guide) g.addRow(r);
  g.columns.forEach((c, i) => { c.width = i === 1 ? 70 : 24; });

  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'aquos-solutions-template.xlsx');
}

export function readSettings(sheets: Sheet[]): { units?: string; database?: string } {
  const s = sheets.find(s => /setting/i.test(s.name));
  if (!s) return {};
  const out: { units?: string; database?: string } = {};
  for (const r of s.rows) {
    const k = String(r[0] ?? '').toLowerCase().trim(), v = String(r[1] ?? '').trim();
    if (k === 'units' && v) out.units = normUnit(v);
    if (k === 'database' && v) out.database = v;
  }
  return out;
}
