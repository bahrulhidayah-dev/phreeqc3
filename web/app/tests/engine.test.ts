// Runs official examples through the WebAssembly engine and checks results against the
// reference outputs shipped in examples/. Requires public/engine (npm run engine).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { transformUserGraphs, readUserGraph } from '../src/lib/userGraph.ts';
import { parseOutput, parseSel } from '../src/lib/parseOutput.ts';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const { default: createPhreeqc } = await import(path.join(app, 'public/engine/phreeqc.mjs'));

async function run(input: string, db = 'phreeqc.dat', dbPath = path.join(root, 'database', db)) {
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w');
  for (const f of fs.readdirSync(path.join(root, 'examples'))) {
    const p = path.join(root, 'examples', f);
    if (fs.statSync(p).isFile()) M.FS.writeFile(f, fs.readFileSync(p));
  }
  M.FS.writeFile(db, fs.readFileSync(dbPath));
  M.FS.writeFile('input.pqi', input);
  const rc = M.callMain(['input.pqi', 'output.out', db]);
  const read = (f: string) => new TextDecoder().decode(M.FS.readFile(f));
  return { rc, out: read('output.out'), read };
}
function filesOf(r: { read: (f: string) => string }, graphs: { parts: { file: string }[]; overlays: string[] }[]) {
  const files: Record<string, string> = {};
  for (const g of graphs) for (const f of [...g.parts.map(p => p.file), ...g.overlays]) { try { files[f] = r.read(f); } catch { /* not written */ } }
  return files;
}
const ex = (f: string) => fs.readFileSync(path.join(root, 'examples', f), 'utf8');

test('ex2 runs and matches the reference selected output', async () => {
  const r = await run(ex('ex2'));
  assert.equal(r.rc, 0);
  const mine = parseSel(r.read('ex2.sel')), ref = parseSel(ex('ex2.sel'));
  assert.deepEqual(mine.columns, ref.columns);
  const col = ref.columns.indexOf('si_anhydrite');
  for (let i = 0; i < ref.rows.length; i++) assert.ok(Math.abs((mine.rows[i][col] as number) - (ref.rows[i][col] as number)) < 1e-3);
});

test('USER_GRAPH of ex2 is rebuilt from the engine output', async () => {
  const t = transformUserGraphs(ex('ex2'));
  assert.equal(t.graphs.length, 1);
  assert.equal(t.graphs[0].title, 'Gypsum-Anhydrite Stability');
  const r = await run(t.input);
  assert.equal(r.rc, 0);
  const g = readUserGraph(t.graphs[0], filesOf(r, t.graphs));
  assert.deepEqual(g.series.map(s => s.name), ['Gypsum', 'Anhydrite']);
  assert.equal(g.series[0].points.length, 51);
  const ref = parseSel(ex('ex2.sel'));
  const p = g.series[1].points[10];
  const row = ref.rows.find(rw => rw[ref.columns.indexOf('temp')] === p.x)!;
  assert.ok(Math.abs(p.y - (row[ref.columns.indexOf('si_anhydrite')] as number)) < 1e-3);
});

test('ex1 seawater speciation matches reference', async () => {
  const r = await run(ex('ex1'));
  const mine = parseOutput(r.out).simulations[0].calcs[0], ref = parseOutput(ex('ex1.out')).simulations[0].calcs[0];
  assert.deepEqual(mine.description, ref.description);
  assert.deepEqual(mine.si, ref.si);
});

for (const e of ['ex2b', 'ex3', 'ex4', 'ex5', 'ex6', 'ex7', 'ex8', 'ex9', 'ex10', 'ex11', 'ex12', 'ex13a', 'ex14', 'ex16', 'ex18', 'ex19', 'ex20a', 'ex21', 'ex22']) {
  test(`${e} runs without errors and its USER_GRAPHs produce data`, async () => {
    const t = transformUserGraphs(ex(e));
    const r = await run(t.input, e.startsWith('ex20') ? 'iso.dat' : 'phreeqc.dat');
    assert.equal(r.rc, 0, `${e} rc`);
    assert.equal(parseOutput(r.out).errors.length, 0);
    const files = filesOf(r, t.graphs);
    for (const g of t.graphs) assert.ok(readUserGraph(g, files).series.length > 0, `${e} graph ${g.n}`);
  });
}
