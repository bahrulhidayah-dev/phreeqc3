// Serpentinization lab: the generated PHREEQC inputs run on the WebAssembly engine,
// and the field calculators give the expected numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { presetInput, sweepInput, scenarios, DEFAULT_PARAMS, olivineMoles } from '../src/lib/serp/model.ts';
import { logKInput, fh2Input, activityDiagram, speciationInput, records, MG_MINERALS } from '../src/lib/serp/thermo.ts';
import { toMmol, readField, chargeBalance, headspace, orpToPe, ELECTRODES, fieldSolutions, peFromEh } from '../src/lib/serp/field.ts';
import { isoline, raster, niceLevels } from '../src/lib/serp/contour.ts';
import { airFree, allReferenceSamples, GAS_SITES, gasMapPoints, SITES } from '../src/lib/serp/reference.ts';
import { parseSel } from '../src/lib/parseOutput.ts';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const { default: createPhreeqc } = await import(path.join(app, 'public/engine/phreeqc.mjs'));
async function run(input: string, db = 'llnl.dat') {
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w');
  M.FS.writeFile(db, fs.readFileSync(path.join(root, 'database', db)));
  M.FS.writeFile('input.pqi', input);
  const rc = M.callMain(['input.pqi', 'output.out', db]);
  const read = (f: string) => new TextDecoder().decode(M.FS.readFile(f));
  return { rc, out: read('output.out'), sel: (f: string) => records(parseSel(read(f))) };
}

test('preset: olivine amount follows W/R and Fo', () => {
  assert.ok(Math.abs(olivineMoles(1, 100) - 1000 / 140.693) < 1e-9);
  assert.ok(Math.abs(olivineMoles(2, 90) - 1000 / (2 * (0.9 * 140.693 + 0.1 * 203.777))) < 1e-9);
});

test('preset runs: H2 rises with reaction progress, pH alkaline, gas caps fH2 at P', async () => {
  const r = await run(presetInput({ ...DEFAULT_PARAMS, tempC: 200, wr: 1 }));
  assert.equal(r.rc, 0);
  assert.doesNotMatch(r.out, /^ERROR/m);
  const rows = r.sel('serpentinization.sel');
  assert.equal(rows.length, DEFAULT_PARAMS.steps);
  const h2 = rows.map(x => Number(x.H2_mmol_kgw));
  for (let i = 1; i < h2.length; i++) assert.ok(h2[i] >= h2[i - 1] * 0.99, 'H2 increases');
  assert.ok(Math.abs(Number(rows.at(-1)!['W:R']) - 1) < 0.01);
  assert.ok(Number(rows.at(-1)!.pH) > 6.5);   // neutral pH at 200 °C is ~5.6
  assert.ok(Number(rows.at(-1)!.log_fH2) <= Math.log10(300 / 1.01325) + 0.05);
  assert.ok(Number(rows.at(-1)!.Magnetite_mol) > 0);
});

test('preset variants (no solid solution, antigorite, talc, calcite + DIC, no gas) run', async () => {
  const r = await run(presetInput({ ...DEFAULT_PARAMS, tempC: 100, feSolidSolution: false, serpentine: 'Antigorite', talc: true, calcite: true, dicMmol: 2, caMmol: 1, gasPhase: false, steps: 5 }));
  assert.equal(r.rc, 0);
  assert.equal(r.sel('serpentinization.sel').length, 5);
});

test('sweep: one row per scenario with the requested T, W/R and Fo', async () => {
  const list = scenarios([50, 200], [1, 10], [85, 95]);
  const r = await run(sweepInput(DEFAULT_PARAMS, list));
  assert.equal(r.rc, 0);
  const rows = r.sel('sweep.sel');
  assert.equal(rows.length, 8);
  rows.forEach((x, i) => {
    assert.equal(Number(x.scenario), list[i].i);
    assert.ok(Math.abs(Number(x.T_C) - list[i].tempC) < 1e-6);
    assert.equal(Number(x.WR_target), list[i].wr);
    assert.equal(Number(x.Fo), list[i].fo);
  });
  // more rock per kg water gives more H2
  const h = (t: number, wr: number) => Number(rows.find(x => Number(x.T_C) === t && Number(x.WR_target) === wr && Number(x.Fo) === 85)!.H2_mmol_kgw);
  assert.ok(h(200, 1) > h(200, 10));
});

test('log K and activity diagram: brucite/chrysotile/talc fields from llnl.dat at 25 °C', async () => {
  const phases = [...MG_MINERALS, 'Quartz', 'SiO2(am)'];
  const r = await run(logKInput([25], 1, phases));
  const row = r.sel('logk.sel')[0];
  const K = Object.fromEntries(phases.map(p => [p, Number(row[p.replace(/[()]/g, '')])]));
  assert.ok(Math.abs(K.Brucite - 16.28) < 0.05 && Math.abs(K.Quartz + 4.03) < 0.05);
  const d = activityDiagram(K, ['Brucite', 'Chrysotile', 'Talc'], [-12, -1]);
  assert.deepEqual(d.fields.map(f => f.mineral), ['Brucite', 'Chrysotile', 'Talc']);
  // brucite–chrysotile boundary: 3·KB + 2·Y = KC
  assert.ok(Math.abs(d.fields[0].y1 - (K.Chrysotile - 3 * K.Brucite) / 2) < 1e-9);
});

test('fH2 buffers: HM below FMQ, both rise with T', async () => {
  const r = await run(fh2Input([25, 150, 300], 300));
  assert.equal(r.rc, 0);
  const rows = r.sel('fh2.sel');
  const c = (n: string) => rows.filter(x => x.curve === n).map(x => Number(x.log_fH2));
  assert.equal(c('FMQ').length, 3); assert.equal(c('HM').length, 3);
  c('FMQ').forEach((v, i) => assert.ok(c('HM')[i] < v));
  assert.ok(c('FMQ')[2] > c('FMQ')[0]);
});

test('unit conversion to mmol/L, including H(0) counting H atoms', () => {
  assert.ok(Math.abs(toMmol(40.078, 'Ca', '', 'mg/L') - 1) < 1e-9);
  assert.ok(Math.abs(toMmol(96.06, 'S(6)', 'as SO4', 'mg/L') - 1) < 1e-9);
  assert.ok(Math.abs(toMmol(61.017, 'Alkalinity', 'mg/L as HCO3', 'mg/L') - 1) < 1e-9);
  assert.ok(Math.abs(toMmol(50.0435, 'Alkalinity', '', 'mg/L') - 1) < 1e-6);   // as CaCO3 by default
  assert.ok(Math.abs(toMmol(175, 'H2', 'umol/L', 'mg/L') - 0.175) < 1e-12);
  const f = readField([{ name: 'Field data', rows: [
    ['Sample', 'Site', 'Latitude', 'Longitude', 'Temp', 'pH', 'ORP', 'Ca', 'SO4', 'H2', 'H(0)'],
    ['', '', 'decimal °', 'decimal °', '°C', '', 'mV', 'mg/L', 'mg/L', 'umol/L', 'mg/L'],
    ['S-1', 'Spring', -2.5, 121.3, 30, 11.2, -400, 40.078, 96.06, 175, null],
    ['S-2', 'Well', -2.6, 121.4, 28, 8.4, 100, 20.039, null, null, 2.016],
  ] }]);
  assert.equal(f.samples.length, 2);
  const [a, b] = f.samples;
  assert.equal(a.name, 'Spring'); assert.equal(a.lat, -2.5); assert.equal(a.orp, -400);
  assert.ok(Math.abs(a.conc.Ca - 1) < 1e-9 && Math.abs(a.conc['S(6)'] - 1) < 1e-9 && Math.abs(a.conc.H2 - 0.175) < 1e-12);
  assert.ok(Math.abs(b.conc.H2 - 1) < 1e-3);     // 2.016 mg/L H(0) = 2 mmol H = 1 mmol H2
});

test('field samples become SOLUTIONs that PHREEQC speciates (H2 kept as H2)', async () => {
  const s = [{ id: '1', name: 'Spring', temp: 30, pH: 11, orp: -400, conc: { Ca: 1, Na: 1, Cl: 3, H2: 0.175, Si: 0.01, Mg: 0.001 } }];
  const txt = fieldSolutions(s, 4, ELECTRODES[0]);
  assert.match(txt, /H\(0\)\s+0\.35\b/);
  const r = await run(speciationInput(txt));
  const row = r.sel('samples.sel')[0];
  assert.ok(Math.abs(Number(row.H2_mmol) - 0.175) < 1e-3);   // mmol/L vs mmol/kgw
  assert.ok(Number(row.log_fH2) > -1 && Number(row.log_fH2) < 0);   // 175 µmol/L ≈ 0.22 atm H2
  assert.ok(Number.isFinite(Number(row.la_SiO2)));
});

test('ORP → pe and headspace calculators', () => {
  const r = orpToPe(-400, 25, ELECTRODES[0]);
  assert.ok(Math.abs(r.eh - (-0.19)) < 1e-9);
  assert.ok(Math.abs(r.pe - (-0.19 / 0.05916)) < 0.01);
  assert.ok(Math.abs(peFromEh(0.05916, 25) - 1) < 1e-3);
  // 1 atm pure H2, no headspace gas left: C = kH
  const h = headspace('H2', 1e6, 0, 10, 25, 1);
  assert.ok(Math.abs(h.c0 - 7.8e-4) < 1e-12);
  const h2 = headspace('H2', 1000, 20, 40, 25, 1);
  assert.ok(h2.fracInGas > 0.9 && h2.fracInGas < 1);   // H2 is poorly soluble: most goes to the gas
});

test('charge balance of a balanced NaCl + CaSO4 water is ~0 %', () => {
  const cb = chargeBalance({ id: '1', name: '', pH: 7, conc: { Na: 1, Cl: 1, Ca: 1, 'S(6)': 1 } })!;
  assert.ok(Math.abs(cb.cbe) < 0.1);
  const hyper = chargeBalance({ id: '2', name: '', pH: 12, conc: { Ca: 5, Cl: 0 } })!;
  assert.ok(Math.abs(hyper.cbe) < 5, 'OH- balances Ca at pH 12: ' + hyper.cbe);
});

test('contours: isolines of a plane are straight and levels are nice', () => {
  const g = { xs: [0, 1, 2], ys: [0, 1], z: [[0, 1, 2], [0, 1, 2]] };
  const segs = isoline(g, 0.5);
  assert.ok(segs.length >= 1 && segs.every(s => Math.abs(s[0] - 0.5) < 1e-9 && Math.abs(s[2] - 0.5) < 1e-9));
  const f = raster(g, 5, x => x, x => x, y => y, y => y);
  assert.ok(Math.abs((f.z[2][2] as number) - 1) < 1e-9);
  assert.deepEqual(niceLevels(0, 10, 5), [2, 4, 6, 8]);
});

test('reference library: every sample converts and speciates in PHREEQC', async () => {
  const all = allReferenceSamples();
  assert.equal(all.length, SITES.reduce((a, s) => a + s.rows.length, 0));
  assert.ok(all.every(s => Object.values(s.conc).every(v => Number.isFinite(v) && v >= 0)));
  const pb1 = all.find(s => s.id === 'PH-PB1')!;
  assert.ok(Math.abs(pb1.conc.Ca - 52.8 / 40.078) < 1e-9);
  const r = await run(speciationInput(fieldSolutions(all, 4, ELECTRODES[0])));
  assert.equal(r.rc, 0);
  assert.equal(r.sel('samples.sel').length, all.length);
});

test('reference library: Sulawesi sites convert units and gas seeps are air-corrected', () => {
  const all = allReferenceSamples();
  const tw = all.find(s => s.id === 'TW-60')!;
  assert.ok(Math.abs(tw.conc.Mg - 0.1454) < 1e-9);          // µmol/L to mmol/L
  const po = all.find(s => s.id === 'PO-St1')!;
  assert.ok(Math.abs(po.conc.Ni - 0.0086 / 58.693) < 1e-12); // mg/L to mmol/L
  assert.ok(Math.abs(po.lat! + (4 + 9 / 60 + 33.6 / 3600)) < 1e-9 && po.lon! > 121.68 && po.lon! < 121.69);
  const g = airFree(GAS_SITES[0].rows[0]);                   // 23IDS02
  assert.ok(Math.abs(g.H2 - 50.8) < 0.1 && Math.abs(g.CH4 - 46.4) < 0.1 && Math.abs(g.N2x - 2.6) < 0.1);
  assert.ok(Math.abs(g.H2 + g.CH4 + g.C2 + g.CO2 + g.N2x - 100) < 1e-9);
  assert.equal(gasMapPoints().length, 1);
});

test('reference library: Oman springs (Paukert 2012), Manleluag position, Tanjung Api δ13C from two sources', async () => {
  const oman = SITES.find(s => s.id === 'oman-springs')!;
  assert.equal(oman.rows.length, 27);
  const outlets = oman.rows.filter(r => /spring outlet/.test(r.name));
  assert.equal(outlets.length, 17);
  // UTM 40N converted: all within the Samail ophiolite box
  for (const r of oman.rows) assert.ok(r.lat! > 22.5 && r.lat! < 24.5 && r.lon! > 56 && r.lon! < 59.5, r.id);
  // Type II outlets: pH > 11, Ca-OH, Mg far below Ca
  for (const r of outlets) assert.ok(r.pH! > 11 && r.v.Ca > 20 * r.v.Mg, r.id);
  const cv = SITES.find(s => s.id === 'oman-chavagnac')!;
  assert.equal(cv.rows.length, 68);
  for (const r of cv.rows) assert.ok(r.lat! > 22.5 && r.lat! < 24.8 && r.lon! > 56 && r.lon! < 59, r.id);
  assert.equal(cv.rows.find(r => r.id === 'CV-13-2')!.v.Ca, 1.867);
  const ml = allReferenceSamples().filter(s => /Manleluag/.test(s.name));
  assert.equal(ml.length, 3);
  assert.ok(Math.abs(ml[0].lat! - 15.7044) < 1e-3 && Math.abs(ml[0].lon! - 120.2811) < 1e-3);
  const ta = GAS_SITES.find(g => g.id === 'tanjungapi')!;
  assert.equal(ta.rows.find(r => r.id === '23IDS02')!.d13C1Alt, -48.5);
  assert.ok(ta.rows.some(r => r.id === 'S2004'));
});
