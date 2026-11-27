// Every keyword template the app inserts must run as it stands (with the database its description names),
// and fixes found by the validation in web/validation stay fixed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_KEYWORDS } from '../src/lib/keywords.ts';
import { transformUserGraphs, dropPrint } from '../src/lib/userGraph.ts';
import { parseCSV } from '../src/lib/excel.ts';
import { presetInput, DEFAULT_PARAMS } from '../src/lib/serp/model.ts';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const { default: createPhreeqc } = await import(path.join(app, 'public/engine/phreeqc.mjs'));

async function run(input: string, db: string) {
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w');
  M.FS.writeFile(db, fs.readFileSync(path.join(root, 'database', db)));
  M.FS.writeFile('input.pqi', input);
  const rc = M.callMain(['input.pqi', 'output.out', db]);
  return { rc, out: new TextDecoder().decode(M.FS.readFile('output.out')) };
}
const BASE = 'SOLUTION 1\n    pH 7\n    Ca 1\n    Cl 2\nSOLUTION 2\n    pH 8\n    Na 10\n    Cl 10\nEND\n';

for (const k of ALL_KEYWORDS) {
  test(`template ${k.name} runs without errors`, async () => {
    const db = k.desc.match(/use (\S+\.dat)/)?.[1] ?? 'phreeqc.dat';
    const input = k.name === 'DATABASE' ? k.template.replace('phreeqc.dat', db) + BASE : BASE + k.template + '\nEND\n';
    const r = await run(transformUserGraphs(input).input, db);
    assert.equal(r.rc, 0, (r.out.match(/^ERROR:.*$/gm) ?? []).join('\n'));
    assert.deepEqual(r.out.match(/^ERROR:.*$/gm) ?? [], []);
  });
}

test('PRINT inside USER_GRAPH is dropped, other statements stay', () => {
  assert.equal(dropPrint('200 IF STEP_NO = 2 THEN print "SSQD: ", GET(10)'), '200 IF STEP_NO = 2 THEN aquos_print = 0 ');
  assert.equal(dropPrint('40 PLOT_XY x, TC : print tc, diff_c("Cl-")'), '40 PLOT_XY x, TC : aquos_print = 0 ');
  assert.equal(dropPrint('10 print "a:b" : PUT(1, 0)'), '10 aquos_print = 0 : PUT(1, 0)');
  assert.equal(dropPrint('10 IF a THEN PRINT a ELSE PLOT_XY 1, 2'), '10 IF a THEN aquos_print = 0 ELSE PLOT_XY 1, 2');
  assert.equal(dropPrint('10 PLOT_XY "print", sprint'), '10 PLOT_XY "print", sprint');
});

test('CSV with ";" and decimal commas gives numbers', () => {
  const s = parseCSV('Sample;pH;Ca\n1;7,25;48,2\n2;-0,5;1e-3\n');
  assert.deepEqual(s.rows[1], [1, 7.25, 48.2]);
  assert.deepEqual(s.rows[2], [2, -0.5, 0.001]);
  // with "," as separator a comma is never a decimal sign
  assert.deepEqual(parseCSV('a,b\n"7,25",3\n').rows[1], ['7,25', 3]);
});

test('serpentinization preset with Fo100 (no Fe) converges', async () => {
  const r = await run(presetInput({ ...DEFAULT_PARAMS, fo: 100 }), 'llnl.dat');
  assert.equal(r.rc, 0);
  assert.deepEqual(r.out.match(/^ERROR:.*$/gm) ?? [], []);
});
