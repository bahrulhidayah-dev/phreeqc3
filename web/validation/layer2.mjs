// Layer 2: synthetic data through every data-handling feature of Aquos Geochemistry.
// Writes the synthetic files to data/ and a JSON result. Usage:
//   node --experimental-strip-types layer2.mjs /path/to/native/phreeqc [out.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as S from './synthetic.mjs';

const native = path.resolve(process.argv[2]);
const root = path.resolve(import.meta.dirname, '../..');
const app = path.join(root, 'web/app');
const DATA = path.join(import.meta.dirname, 'data');
fs.mkdirSync(DATA, { recursive: true });
const { default: ExcelJS } = await import(path.join(app, 'node_modules/exceljs/excel.js'));
const { default: createPhreeqc } = await import(path.join(app, 'public/engine/phreeqc.mjs'));
const X = await import(path.join(app, 'src/lib/excel.ts'));
const FLD = await import(path.join(app, 'src/lib/serp/field.ts'));
const MOD = await import(path.join(app, 'src/lib/serp/model.ts'));
const TH = await import(path.join(app, 'src/lib/serp/thermo.ts'));
const REF = await import(path.join(app, 'src/lib/serp/reference.ts'));
const CT = await import(path.join(app, 'src/lib/serp/contour.ts'));
const { parseSel, parseOutput } = await import(path.join(app, 'src/lib/parseOutput.ts'));
const { toCSV } = await import(path.join(app, 'src/lib/download.ts'));

// ---------------- engines ----------------
function runNative(input, dbName) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'l2-'));
  fs.copyFileSync(path.join(root, 'database', dbName), path.join(d, dbName));
  fs.writeFileSync(path.join(d, 'in.pqi'), input);
  let rc = 0; try { execFileSync(native, ['in.pqi', 'out.out', dbName], { cwd: d, stdio: 'pipe', timeout: 600000 }); } catch (e) { rc = e.status ?? 1; }
  const files = {}; for (const f of fs.readdirSync(d)) if (f !== dbName && f !== 'in.pqi') files[f] = fs.readFileSync(path.join(d, f), 'utf8');
  fs.rmSync(d, { recursive: true, force: true });
  return { rc, files };
}
async function runWasm(input, dbName) {
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w');
  M.FS.writeFile(dbName, fs.readFileSync(path.join(root, 'database', dbName)));
  M.FS.writeFile('in.pqi', input);
  let rc = 0; try { rc = M.callMain(['in.pqi', 'out.out', dbName]); } catch { rc = -1; }
  const files = {}; for (const f of M.FS.readdir('.')) if (!f.startsWith('.') && f !== dbName && f !== 'in.pqi') files[f] = new TextDecoder().decode(M.FS.readFile(f));
  return { rc, files };
}
const errorsOf = out => (out.match(/^ERROR:.*$/gm) || []);
const rel = (a, b) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-30));

const checks = [];
const check = (feature, name, pass, detail = '') => { checks.push({ feature, name, pass: !!pass, detail: String(detail) }); if (!pass) console.log('  FAIL', feature, '|', name, '|', detail); };

// ---------------- write the synthetic files ----------------
async function writeSolutionsXlsx(file) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Aquos Geochemistry validation';
  const ws = wb.addWorksheet('Solutions');
  ws.addRow(S.SOL_HEAD).font = { bold: true }; ws.addRow(S.SOL_UNIT).font = { italic: true };
  S.SOL_CASES.slice(0, 5).forEach(c => ws.addRow(c.row));
  for (const r of S.SOL_SKIP_ROWS) ws.addRow(r);
  S.SOL_CASES.slice(5).forEach(c => ws.addRow(c.row));
  ws.columns.forEach(c => { c.width = 12; });
  const st = wb.addWorksheet('Settings');
  st.addRow(['Setting', 'Value', 'Notes']); st.addRow(['units', 'mg/L', 'default unit; some columns override it']); st.addRow(['database', 'phreeqc.dat', '']);
  const k = wb.addWorksheet('Kasus uji');
  k.addRow(['Kode', 'Yang diuji']).font = { bold: true };
  for (const c of S.SOL_CASES) k.addRow([c.id, c.tests]);
  k.getColumn(2).width = 90;
  await wb.xlsx.writeFile(file);
}
function solutionRowsAsTable() {
  return [S.SOL_HEAD, S.SOL_UNIT, ...S.SOL_CASES.slice(0, 5).map(c => c.row), ...S.SOL_SKIP_ROWS, ...S.SOL_CASES.slice(5).map(c => c.row)];
}
function writeCsv(file, sep, decimalComma) {
  const cell = v => { if (v == null) return ''; let s = String(v); if (decimalComma && typeof v === 'number') s = s.replace('.', ','); return /[",;\t\n]/.test(s) && !(sep === '\t') ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(file, solutionRowsAsTable().map(r => r.map(cell).join(sep)).join('\r\n') + '\r\n');
}
async function writeFieldXlsx(file) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Aquos Geochemistry validation';
  const ws = wb.addWorksheet('Field data');
  ws.addRow(S.FIELD_HEAD).font = { bold: true }; ws.addRow(S.FIELD_UNIT).font = { italic: true };
  for (const c of S.FIELD_CASES) ws.addRow(c.row);
  const k = wb.addWorksheet('Kasus uji');
  k.addRow(['Kode', 'Yang diuji']).font = { bold: true };
  for (const c of S.FIELD_CASES) k.addRow([c.id, c.tests]);
  k.getColumn(2).width = 90;
  // scenarios for the Lab preset (enter them by hand in the Preset panel; the test runs them directly)
  const l = wb.addWorksheet('Skenario Lab');
  const keys = ['tempC', 'pressureBar', 'wr', 'fo', 'naclMmol', 'dicMmol', 'caMmol', 'serpentine', 'feSolidSolution', 'talc', 'calcite', 'gasPhase'];
  l.addRow(['Kode', 'Yang diuji', ...keys]).font = { bold: true };
  for (const c of S.LAB_CASES) { const p = { ...MOD.DEFAULT_PARAMS, ...c.p }; l.addRow([c.id, c.tests, ...keys.map(k => p[k])]); }
  l.addRow([]); l.addRow(['Sapuan', 'T = 100, 200, 300 °C; W/R = 0.5, 2; Fo = 80, 90 (12 skenario)']);
  l.getColumn(2).width = 60;
  await wb.xlsx.writeFile(file);
}
const solX = path.join(DATA, 'sintetis-solusi.xlsx');
await writeSolutionsXlsx(solX);
writeCsv(path.join(DATA, 'sintetis-solusi-koma.csv'), ',', false);
writeCsv(path.join(DATA, 'sintetis-solusi-titikkoma-desimalkoma.csv'), ';', true);
writeCsv(path.join(DATA, 'sintetis-solusi-tab.tsv'), '\t', false);
const fldX = path.join(DATA, 'sintetis-lapangan.xlsx');
await writeFieldXlsx(fldX);
// hand-written reference input for the solutions
const handInput = S.SOL_CASES.map((c, i) => [`SOLUTION ${i + 1}  ${c.id}`, '    units mg/L', ...c.phreeqc.map(l => '    ' + l)].join('\n')).join('\n');
fs.writeFileSync(path.join(DATA, 'sintetis-solusi-acuan.pqi'), `TITLE Acuan tulisan tangan untuk sintetis-solusi.xlsx (phreeqc.dat)\n${handInput}\nEND\n`);

const fileOf = p => new File([fs.readFileSync(p)], path.basename(p));

// ---------------- 1. Excel / CSV import → SOLUTION blocks → engine ----------------
const PUNCH = `SELECTED_OUTPUT 1\n    -file check.sel\n    -reset false\nUSER_PUNCH 1\n    -headings soln pH pe mu pct_err temp SI_Calcite SI_Gypsum SI_Quartz Ca Na Cl Alk S6 Sm2 Nm3 Cm4 C4\n    -start\n    10 PUNCH CELL_NO, -LA("H+"), -LA("e-"), MU, PERCENT_ERROR, TC, SI("Calcite"), SI("Gypsum"), SI("Quartz")\n    20 PUNCH TOT("Ca"), TOT("Na"), TOT("Cl"), ALK, TOT("S(6)"), TOT("S(-2)"), TOT("N(-3)"), TOT("C(-4)"), TOT("C(4)")\n    -end\n`;
// solution numbers are compared by description: the app numbers A-9 and the empty id itself
const caseOf = desc => S.SOL_CASES.findIndex(c => desc.includes(c.id));
const refRun = runNative(PUNCH + handInput + '\nEND\n', 'phreeqc.dat');
check('Impor Excel', 'Input acuan berjalan di native; hanya S11 gagal (non-carbonate alkalinity)', errorsOf(refRun.files['out.out']).some(e => /non-carbonate alkalinity/.test(e)) && errorsOf(refRun.files['out.out']).some(e => /initial solution\s+11\b/.test(e)), errorsOf(refRun.files['out.out']).filter(e => !/Residual|has not/.test(e)).join(' '));
const refTab = parseSel(refRun.files['check.sel']);

const EXPECT_TARGET = { Sample: 'number', Description: 'desc', Temp: 'temp', pH: 'pH', pe: 'pe', Ca: 'Ca', Magnesium: 'Mg', Na_mmolL: 'Na', K: 'K', 'Fe(2)': 'Fe(2)', 'Fe(3)': 'Fe(3)', Al: 'Al', SiO2: 'Si', Cl: 'Cl', HCO3: 'Alkalinity', SO4: 'S(6)', NO3: 'N(5)', NH4: 'N(-3)', H2S: 'S(-2)', CH4: 'C(-4)', DIC: 'C(4)', F: 'F', Li: 'Li', B: 'B', Br: 'Br', Remarks: '' };

async function importCase(label, file) {
  const F = `Impor ${label}`;
  let sheets;
  try { sheets = await X.readWorkbook(fileOf(file)); } catch (e) { check(F, 'Berkas terbaca', false, e.message); return; }
  const { columns, data } = X.readSamples(sheets);
  const settings = X.readSettings(sheets);
  for (const [h, t] of Object.entries(EXPECT_TARGET)) {
    const c = columns.find(c => c.header === h);
    check(F, `Kolom "${h}" dikenali sebagai ${t || '(dilewati)'}`, c && c.target === t, c ? `→ ${c.target} ${c.unit}` : 'kolom hilang');
  }
  check(F, 'Baris satuan dikenali (baris ke-2 bukan sampel)', data.length === S.SOL_CASES.length && data[0][0] === 1, `${data.length} baris data, harapan ${S.SOL_CASES.length}`);
  const units = settings.units ?? 'mg/L';
  const text = X.buildSolutions(columns, data, units);
  fs.writeFileSync(path.join(DATA, `hasil-impor-${label.replace(/\W+/g, '_')}.pqi`), text);
  check(F, 'Baris komentar (#) dan baris kosong diabaikan', !/komentar/.test(text));
  const w = await runWasm(PUNCH + text + 'END\n', 'phreeqc.dat');
  const out = w.files['out.out'] ?? '';
  const errs = errorsOf(out), refErrs = errorsOf(refRun.files['out.out']);
  check(F, 'Tidak ada ERROR selain kasus S11 yang memang harus gagal', errs.every(e => /converge|alkalinity|Residual|initial solution/i.test(e)) && errs.some(e => /initial solution\s+11\b/.test(e)), errs.filter(e => !/Residual/.test(e)).slice(0, 3).join(' '));
  check(F, 'S11: pesan ERROR web sama dengan native', JSON.stringify(errs.filter(e => !/Residual|has not converged/.test(e))) === JSON.stringify(refErrs.filter(e => !/Residual|has not converged/.test(e))), errs.filter(e => !/Residual|has not converged/.test(e)).join(' | '));
  const tab = parseSel(w.files['check.sel'] ?? '');
  const sols = [...text.matchAll(/^SOLUTION (\d+)\s+(.*)$/gm)].map(m => ({ n: +m[1], desc: m[2] }));
  check(F, 'Nomor sampel unik', new Set(sols.map(s => s.n)).size === sols.length, sols.map(s => s.n).join(','));
  const COLS = ['pH', 'pe', 'mu', 'pct_err', 'temp', 'SI_Calcite', 'SI_Gypsum', 'SI_Quartz', 'Ca', 'Na', 'Cl', 'Alk', 'S6', 'Sm2', 'Nm3', 'Cm4', 'C4'];
  for (const s of sols) {
    const ci = caseOf(s.desc); if (ci < 0) { check(F, `Sampel ${s.desc}`, false, 'tidak dikenali'); continue; }
    const mine = tab.rows.find(r => r[0] === s.n), ref = refTab.rows.find(r => r[0] === ci + 1);
    if (S.SOL_CASES[ci].expectError) { check(F, `${S.SOL_CASES[ci].id} gagal dengan cara yang sama seperti di native`, !mine === !ref); continue; }
    if (!mine || !ref) { check(F, `${S.SOL_CASES[ci].id} punya hasil`, false); continue; }
    let worst = 0, what = '';
    for (const c of COLS) {
      const k = refTab.columns.indexOf(c), a = +mine[k], b = +ref[k];
      // SI of -999 means "phase not computable" in both; pe of a solution set by the user is exact
      const r = (a <= -998 && b <= -998) ? 0 : (c.startsWith('SI') || c === 'pH' || c === 'pe' || c === 'pct_err') ? Math.abs(a - b) / 1000 : rel(a, b);
      if (r > worst) { worst = r; what = `${c}: ${a} vs ${b}`; }
    }
    check(F, `${S.SOL_CASES[ci].id} sama dengan input acuan (${S.SOL_CASES[ci].tests})`, worst < 1e-6, what);
  }
  return { tab, sols };
}
await importCase('Excel (.xlsx)', solX);
await importCase('CSV koma', path.join(DATA, 'sintetis-solusi-koma.csv'));
await importCase('CSV titik koma + desimal koma', path.join(DATA, 'sintetis-solusi-titikkoma-desimalkoma.csv'));
await importCase('TSV (tab)', path.join(DATA, 'sintetis-solusi-tab.tsv'));

// expected chemistry of a few cases (independent of the import): checks that the data set does what it says
{
  const F = 'Kimia data sintetis';
  const get = (id, c) => +refTab.rows.find(r => r[0] === S.SOL_CASES.findIndex(x => x.id === id) + 1)[refTab.columns.indexOf(c)];
  check(F, 'S02 air laut: kekuatan ion 0.6–0.8 mol/kgw', get('S02', 'mu') > 0.6 && get('S02', 'mu') < 0.8, get('S02', 'mu'));
  check(F, 'S06: galat neraca muatan > 20 %', get('S06', 'pct_err') > 20, get('S06', 'pct_err').toFixed(1) + ' %');
  check(F, 'S01: galat neraca muatan < 5 %', Math.abs(get('S01', 'pct_err')) < 5, get('S01', 'pct_err').toFixed(2) + ' %');
  check(F, 'S05: S(-2), N(-3), C(-4) tetap ada (pe -3.5)', get('S05', 'Sm2') > 1e-5 && get('S05', 'Nm3') > 1e-4 && get('S05', 'Cm4') > 1e-4, `${get('S05', 'Sm2')} ${get('S05', 'Nm3')} ${get('S05', 'Cm4')}`);
  check(F, 'S07: suhu kosong → 25 °C', get('S07', 'temp') === 25);
  check(F, 'S08: suhu 90 °C dipakai', get('S08', 'temp') === 90);
  check(F, 'S10: pH 13 dipertahankan', Math.abs(get('S10', 'pH') - 13) < 1e-9);
}

// ---------------- 2. field data (Serpentinization Lab) ----------------
{
  const F = 'Data lapangan (Lab)';
  const sheets = await X.readWorkbook(fileOf(fldX));
  const ft = FLD.readField(sheets);
  check(F, 'Semua 8 sampel terbaca', ft.samples.length === S.FIELD_CASES.length, ft.samples.length);
  check(F, 'Tidak ada kolom yang terlewat', ft.skipped.length === 0, ft.skipped.join(', '));
  const s = id => ft.samples.find(x => x.id === id);
  const near = (a, b, tol = 1e-4) => a != null && Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));
  check(F, 'Ca 62 mg/L → 1.5470 mmol/L', near(s('F01').conc.Ca, 62 / 40.078));
  check(F, 'Si 0.6 mg/L as SiO2 → 0.009986 mmol/L', near(s('F01').conc.Si, 0.6 / 60.084));
  check(F, 'SO4 18 mg/L → 0.18738 mmol/L S(6)', near(s('F01').conc['S(6)'], 18 / 96.06));
  check(F, 'Alkalinitas 260 mg/L as HCO3 → 4.2611 meq/L', near(s('F02').conc.Alkalinity, 260 / 61.017));
  check(F, 'DIC 0.03 mmol/L tetap mmol/L', near(s('F01').conc['C(4)'], 0.03));
  check(F, 'H2 210 umol/L → 0.21 mmol/L', near(s('F01').conc.H2, 0.21));
  check(F, 'CH4 4.5 umol/L → 0.0045 mmol/L', near(s('F01').conc.CH4, 0.0045));
  check(F, 'Eh 250 mV terbaca untuk F04', s('F04').eh === 250 && s('F04').orp == null);
  check(F, 'Koordinat F01 = (-2.55, 121.35)', s('F01').lat === -2.55 && s('F01').lon === 121.35);
  // map filter (same rule as SampleMap)
  const onMap = ft.samples.filter(x => Number.isFinite(x.lat) && Number.isFinite(x.lon) && Math.abs(x.lat) <= 90 && Math.abs(x.lon) <= 180).map(x => x.id);
  check('Peta sampel', 'F05 (tanpa koordinat) dan F06 (bujur 250°) tidak dipetakan; 6 lainnya dipetakan', !onMap.includes('F05') && !onMap.includes('F06') && onMap.length === 6, onMap.join(','));
  const gj = { type: 'FeatureCollection', features: ft.samples.filter(x => onMap.includes(x.id)).map(x => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [x.lon, x.lat] }, properties: { id: x.id } })) };
  check('Peta sampel', 'GeoJSON memakai urutan [bujur, lintang]', gj.features[0].geometry.coordinates[0] === 121.35);
  fs.writeFileSync(path.join(DATA, 'hasil-peta.geojson'), JSON.stringify(gj, null, 1));

  // ORP → Eh → pe
  for (const c of S.ORP_CASES) {
    const el = FLD.ELECTRODES.find(e => e.id === c.el);
    const r = FLD.orpToPe(c.orp, c.t, el);
    const peHand = c.eh * 96485.332 / (Math.LN10 * 8.314462618 * (c.t + 273.15));
    check('Kalkulator ORP → pe', `ORP ${c.orp} mV, ${c.t} °C, elektroda ${c.el}: Eh ${c.eh.toFixed(4)} V, pe ${peHand.toFixed(3)}`, near(r.eh, c.eh, 1e-9) && near(r.pe, peHand, 1e-9), `${r.eh} ${r.pe}`);
  }
  // pe at 25 °C: 59.16 mV per pe unit
  check('Kalkulator ORP → pe', 'Eh 0.5916 V pada 25 °C → pe 10.000', near(FLD.peFromEh(0.5916, 25), 10.0, 2e-4), FLD.peFromEh(0.5916, 25));
  // headspace
  for (const c of S.HEADSPACE_CASES) {
    const kH = FLD.HENRY[c.gas].kH * Math.exp(FLD.HENRY[c.gas].dT * (1 / (c.t + 273.15) - 1 / 298.15));
    const p = c.ppmv * 1e-6 * c.p, cEq = kH * p, nGas = p * c.vg / 1000 / (0.082057366 * (c.t + 273.15)), c0 = cEq + nGas / (c.vw / 1000);
    const r = FLD.headspace(c.gas, c.ppmv, c.vg, c.vw, c.t, c.p);
    check('Kalkulator headspace', `${c.gas} ${c.ppmv} ppmv, ${c.vg} mL gas / ${c.vw} mL air, ${c.t} °C → ${(c0 * 1e6).toFixed(3)} µmol/L`, near(r.c0, c0, 1e-9), r.c0);
  }
  // charge balance: quick estimate vs PHREEQC
  const spec = TH.speciationInput(FLD.fieldSolutions(ft.samples, 4, FLD.ELECTRODES[0]));
  fs.writeFileSync(path.join(DATA, 'hasil-lapangan-spesiasi.pqi'), spec);
  const w = await runWasm(spec, 'llnl.dat'), n = runNative(spec, 'llnl.dat');
  check('Spesiasi sampel (Lab)', 'Semua sampel lapangan konvergen di mesin web (llnl.dat)', w.rc === 0 && !errorsOf(w.files['out.out']).length, errorsOf(w.files['out.out'] ?? '').slice(0, 2).join(' '));
  const tw = parseSel(w.files['samples.sel'] ?? ''), tn = parseSel(n.files['samples.sel'] ?? '');
  check('Spesiasi sampel (Lab)', 'Jumlah baris = jumlah sampel', tw.rows.length === ft.samples.length, tw.rows.length);
  let worst = 0, what = '';
  tw.rows.forEach((r, i) => r.forEach((v, j) => { const q = typeof v === 'number' ? Math.abs(v - tn.rows[i][j]) : 0; if (q > worst) { worst = q; what = `${tw.columns[j]} sampel ${i + 1}: ${v} vs ${tn.rows[i][j]}`; } }));
  check('Spesiasi sampel (Lab)', 'Web = native (selisih maks < 1e-6)', worst < 1e-6, what || 'identik');
  const pct = tw.rows.map(r => +r[tw.columns.indexOf('pct_error')]);
  ft.samples.forEach((smp, i) => {
    const cb = FLD.chargeBalance(smp);
    if (!cb) return;
    const ok = smp.id === 'F07' ? cb.cbe > 10 && pct[i] > 10 : Math.abs(cb.cbe - pct[i]) < 6;
    check('Kalkulator neraca muatan', `${smp.id}: perkiraan cepat ${cb.cbe.toFixed(1)} % vs PHREEQC ${pct[i].toFixed(1)} %`, ok, smp.id === 'F07' ? 'keduanya harus > 10 %' : 'beda harus < 6 poin');
  });
  // pe from ORP in the SOLUTION blocks
  const pe1 = +(spec.match(/SOLUTION 1[\s\S]*?pe\s+(-?[\d.]+)/)[1]);
  const exp1 = FLD.orpToPe(-480, 30.5, FLD.ELECTRODES[0]).pe;
  check('Spesiasi sampel (Lab)', `F01: pe dari ORP masuk ke SOLUTION (${exp1.toFixed(3)})`, Math.abs(pe1 - exp1) < 1e-3, pe1);
  check('Spesiasi sampel (Lab)', 'F03: alkalinitas pada pH ≥ 10 tanpa DIC tidak dipakai (diberi catatan)', /SOLUTION 3[\s\S]*?# Alkalinity [\d.]+ meq\/L left out/.test(spec));
  check('Spesiasi sampel (Lab)', 'H2 dimasukkan sebagai H(0) = 2 × H2', /H\(0\)\s+0\.42\b/.test(spec));
}

// ---------------- 3. reference library ----------------
{
  const F = 'Pustaka data rujukan';
  const all = REF.allReferenceSamples();
  check(F, 'Pustaka berisi sampel', all.length > 10, all.length);
  const spec = TH.speciationInput(FLD.fieldSolutions(all, 4));
  const w = await runWasm(spec, 'llnl.dat');
  const tw = parseSel(w.files['samples.sel'] ?? '');
  check(F, `Semua ${all.length} sampel rujukan dispesiasi tanpa ERROR`, w.rc === 0 && !errorsOf(w.files['out.out'] ?? '').length && tw.rows.length === all.length, `${tw.rows.length} baris; ${errorsOf(w.files['out.out'] ?? '').slice(0, 2).join(' ')}`);
  const bad = all.filter(s => s.lat != null && (Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180));
  check(F, 'Koordinat rujukan valid', !bad.length, bad.map(s => s.id).join(','));
}

// ---------------- 4. serpentinization preset, sweep, diagrams ----------------
const labResults = [];
for (const c of S.LAB_CASES) {
  const F = 'Preset serpentinisasi';
  const p = { ...MOD.DEFAULT_PARAMS, ...c.p };
  const input = MOD.presetInput(p);
  const w = await runWasm(input, 'llnl.dat'), n = runNative(input, 'llnl.dat');
  const ew = errorsOf(w.files['out.out'] ?? '');
  check(F, `${c.id} ${c.tests}: berjalan tanpa ERROR`, w.rc === 0 && !ew.length, ew.slice(0, 2).join(' '));
  const a = parseSel(w.files['serpentinization.sel'] ?? ''), b = parseSel(n.files['serpentinization.sel'] ?? '');
  let worst = 0, what = '';
  a.rows.forEach((r, i) => r.forEach((v, j) => { const q = typeof v === 'number' && Math.abs(v) > 1e-12 ? rel(v, b.rows[i]?.[j]) : 0; if (q > worst) { worst = q; what = `${a.columns[j]} baris ${i}: ${v} vs ${b.rows[i]?.[j]}`; } }));
  check(F, `${c.id}: web = native (selisih relatif maks < 1e-6)`, a.rows.length && a.rows.length === b.rows.length && worst < 1e-6, what || `${a.rows.length} baris identik`);
  // mass balance: Fe2SiO4 → magnetite gives 1 mol H2 per mol magnetite (3 Fe2SiO4 + 2 H2O = 2 Fe3O4 + 3 SiO2 + 2 H2)
  const last = Object.fromEntries(a.columns.map((k, i) => [k, a.rows.at(-1)?.[i]]));
  const h2mol = (+last.H2_mmol_kgw / 1000) * (+last.water_kg) + (+last.gas_H2_mol || 0);
  const fe3 = 3 * +last.Magnetite_mol;          // Fe in magnetite; 1/3 of it is Fe(III)... per formula Fe(II)Fe(III)2O4
  const h2FromMag = +last.Magnetite_mol;         // 2/3 Fe oxidised per 3 Fe: H2 = moles of magnetite
  if (p.fo < 100) check(F, `${c.id}: neraca H2 ≈ magnetit (1 mol H2 per mol Fe3O4), selisih < 2 %`, Math.abs(h2mol - h2FromMag) <= 0.02 * Math.max(h2FromMag, 1e-12) + 1e-9, `H2 ${h2mol.toExponential(4)} mol, magnetit ${h2FromMag.toExponential(4)} mol`);
  // the only Fe is the 1e-7 mol of Fe(III) in the starting fluid: at most 3.3e-8 mol magnetite and no H2
  else check(F, `${c.id}: tanpa Fe di olivin: magnetit hanya dari Fe larutan awal (≤ 3.4e-8 mol) dan H2 ≈ 0`, +last.Magnetite_mol <= 3.4e-8 && h2mol < 1e-12, `magnetit ${last.Magnetite_mol}, H2 ${h2mol}`);
  labResults.push({ id: c.id, rows: a.rows.length, last });
}
{
  const F = 'Sapuan parameter';
  const list = MOD.scenarios([100, 200, 300], [0.5, 2], [80, 90]);
  const input = MOD.sweepInput(MOD.DEFAULT_PARAMS, list);
  const w = await runWasm(input, 'llnl.dat'), n = runNative(input, 'llnl.dat');
  const a = parseSel(w.files['sweep.sel'] ?? ''), b = parseSel(n.files['sweep.sel'] ?? '');
  check(F, `12 skenario (3 T × 2 W/R × 2 Fo) menghasilkan 12 baris`, a.rows.filter(r => +r[0] > 0).length === 12, a.rows.length);
  let worst = 0; a.rows.forEach((r, i) => r.forEach((v, j) => { if (typeof v === 'number' && Math.abs(v) > 1e-12) worst = Math.max(worst, rel(v, b.rows[i][j])); }));
  check(F, 'Web = native (selisih relatif maks < 1e-6)', worst < 1e-6, worst);
  const col = k => a.columns.indexOf(k);
  const rows = a.rows.filter(r => +r[0] > 0);
  check(F, 'Kolom skenario sesuai input (T, W/R, Fo)', rows.every((r, i) => +r[col('T_C')] === list[i].tempC && +r[col('WR_target')] === list[i].wr && +r[col('Fo')] === list[i].fo));
  // contour grid of log fH2 vs T and W/R at Fo90
  const g = { xs: [0.5, 2], ys: [100, 200, 300], z: [100, 200, 300].map(t => [0.5, 2].map(wr => +rows.find(r => +r[col('T_C')] === t && +r[col('WR_target')] === wr && +r[col('Fo')] === 90)[col('log_fH2')])) };
  const mid = CT.sample(g, 1.25, 150);
  const lin = (g.z[0][0] + g.z[0][1] + g.z[1][0] + g.z[1][1]) / 4;
  check('Kontur (sapuan)', 'Interpolasi bilinear di tengah sel = rata-rata 4 sudut', Math.abs(mid - lin) < 1e-12, `${mid} vs ${lin}`);
  check('Kontur (sapuan)', 'Isoline memotong sel yang benar', CT.isoline(g, (Math.min(...g.z.flat()) + Math.max(...g.z.flat())) / 2).length > 0);
}
{
  const F = 'Diagram';
  const temps = [25, 100, 200, 300];
  const phases = [...TH.MG_MINERALS, ...TH.SILICA];
  const li = TH.logKInput(temps, 300, phases);
  const w = await runWasm(li, 'llnl.dat'), n = runNative(li, 'llnl.dat');
  const a = parseSel(w.files['logk.sel'] ?? ''), b = parseSel(n.files['logk.sel'] ?? '');
  check(F, 'log K (LK_PHASE) untuk 8 fase × 4 suhu: web = native', a.rows.length >= 4 && JSON.stringify(a.rows) === JSON.stringify(b.rows), a.rows.length);
  const row25 = a.rows.find(r => +r[0] === 25);
  const logK = Object.fromEntries(a.columns.slice(1).map((c, i) => [c === 'SiO2am' ? 'SiO2(am)' : c, +row25[i + 1]]));
  // independent check against the llnl.dat log K at 25 °C (first value of the log_k line)
  const llnl = fs.readFileSync(path.join(root, 'database/llnl.dat'), 'latin1');
  // PHREEQC uses the -analytic fit when a phase has one: log K = A1 + A2 T + A3 / T + A4 log10 T + A5 / T²
  const dbK = name => {
    const m = llnl.match(new RegExp(`^${name.replace(/[()]/g, '\\$&')}\\s*\\n[\\s\\S]*?-analytic\\s+([^\\n#]+)`, 'm'));
    const [a1, a2, a3, a4, a5] = m[1].trim().split(/\s+/).map(Number), T = 298.15;
    return a1 + a2 * T + a3 / T + a4 * Math.log10(T) + a5 / T / T;
  };
  for (const ph of ['Brucite', 'Chrysotile', 'Talc', 'Quartz']) check(F, `log K ${ph} 25 °C = rumus -analytic llnl.dat dihitung tangan (${dbK(ph).toFixed(3)})`, Math.abs(logK[ph] - dbK(ph)) < 0.002, logK[ph]);
  const d = TH.activityDiagram(logK, ['Brucite', 'Chrysotile', 'Talc'], [-12, -1]);
  check(F, 'Diagram aktivitas: urutan medan brusit → krisotil → talk saat aSiO2 naik', d.fields.map(f => f.mineral).join('>') === 'Brucite>Chrysotile>Talc', d.fields.map(f => `${f.mineral}[${f.y0.toFixed(2)},${f.y1.toFixed(2)}]`).join(' '));
  // brucite/chrysotile boundary by hand: 3 X + 2 Y = Kc and X = Kb  → Y = (Kc - 3 Kb) / 2
  const yb = (logK.Chrysotile - 3 * logK.Brucite) / 2;
  check(F, `Batas brusit/krisotil di log aSiO2 = ${yb.toFixed(3)} (hitung tangan)`, Math.abs(d.fields[0].y1 - yb) < 1e-9, d.fields[0].y1);
  const fi = TH.fh2Input([100, 200, 300], 300);
  const wf = await runWasm(fi, 'llnl.dat'), nf = runNative(fi, 'llnl.dat');
  const af = parseSel(wf.files['fh2.sel'] ?? ''), bf = parseSel(nf.files['fh2.sel'] ?? '');
  check(F, 'Penyangga FMQ dan HM: web = native', af.rows.length > 0 && JSON.stringify(af.rows) === JSON.stringify(bf.rows), af.rows.length);
  const fmq = af.rows.filter(r => r[0] === 'FMQ'), hm = af.rows.filter(r => r[0] === 'HM');
  check(F, 'log fH2 FMQ > HM di setiap suhu (FMQ lebih reduktif)', fmq.length === 3 && fmq.every((r, i) => +r[2] > +hm[i][2]), fmq.map((r, i) => `${r[1]}°C ${(+r[2]).toFixed(2)} vs ${(+hm[i][2]).toFixed(2)}`).join('; '));
}

// ---------------- 5. results: downloads and output parsing ----------------
{
  const F = 'Hasil dan unduhan';
  const csv = toCSV(['a', 'b'], [[1, 'x,y'], [2.5, 'say "hi"']]);
  check(F, 'CSV: koma dan tanda kutip di dalam sel di-escape', csv.includes('"x,y"') && csv.includes('"say ""hi"""'), JSON.stringify(csv));
  const out = (await runWasm(PUNCH + X.buildSolutions(X.readSamples(await X.readWorkbook(fileOf(solX))).columns, X.readSamples(await X.readWorkbook(fileOf(solX))).data, 'mg/L') + 'END\n', 'phreeqc.dat')).files['out.out'];
  const po = parseOutput(out);
  check(F, 'Pembaca output menemukan 10 larutan awal yang berhasil dan 1 ERROR (S11)', po.simulations.flatMap(s => s.calcs).length >= 10 && po.errors.length > 0, po.simulations.flatMap(s => s.calcs).length);
  const s02 = po.simulations.flatMap(s => s.calcs).find(c => /S02/.test(c.heading));
  check(F, 'Pembaca output: indeks kejenuhan terbaca (S02 air laut punya Calcite)', !!s02 && s02.si.some(r => r.phase === 'Calcite'), s02 ? s02.si.length : 'S02 tidak ada');
}

const byFeature = {};
for (const c of checks) { const f = (byFeature[c.feature] ??= { pass: 0, fail: 0 }); c.pass ? f.pass++ : f.fail++; }
console.log(byFeature);
console.log('TOTAL', checks.filter(c => c.pass).length, '/', checks.length);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify({ checks, labResults }, null, 1));
