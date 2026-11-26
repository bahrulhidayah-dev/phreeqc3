import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitBlocks, joinBlocks, summarize, parseSolution, writeSolution, parsePhases } from '../src/lib/inputModel.ts';

const ex = (f: string) => fs.readFileSync(new URL(`../../../examples/${f}`, import.meta.url), 'utf8');

test('split and join keep every example byte for byte', () => {
  for (const e of ['ex1', 'ex2', 'ex6', 'ex11', 'ex15', 'ex22']) {
    const t = ex(e).replace(/\r\n?/g, '\n');
    assert.equal(joinBlocks(splitBlocks(t)), t, e);
  }
});

test('ex2 summary', () => {
  const s = summarize(ex('ex2'));
  assert.equal(s.simulations, 1);
  assert.deepEqual(splitBlocks(ex('ex2')).filter(b => b.kw).map(b => b.kw),
    ['TITLE', 'SOLUTION', 'EQUILIBRIUM_PHASES', 'REACTION_TEMPERATURE', 'SELECTED_OUTPUT', 'USER_GRAPH', 'END']);
});

test('SOLUTION form round trip from ex1', () => {
  const b = splitBlocks(ex('ex1')).find(b => b.kw === 'SOLUTION')!;
  const f = parseSolution(b);
  assert.equal(f.n, '1');
  assert.equal(f.units, 'ppm');
  assert.equal(f.pH, '8.22');
  assert.ok(f.rows.some(r => r.el === 'Alkalinity' && r.extra.includes('as HCO3')));
  const again = parseSolution({ ...b, text: writeSolution(f), head: writeSolution(f).split('\n')[0] });
  assert.deepEqual(again.rows, f.rows);
});

test('EQUILIBRIUM_PHASES rows', () => {
  const b = splitBlocks(ex('ex2')).find(b => b.kw === 'EQUILIBRIUM_PHASES')!;
  assert.deepEqual(parsePhases(b).rows.map(r => r.phase), ['Gypsum', 'Anhydrite']);
});
