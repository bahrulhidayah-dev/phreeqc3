import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOutput, parseSel } from '../src/lib/parseOutput.ts';

const ex = (f: string) => fs.readFileSync(new URL(`../../../examples/${f}`, import.meta.url), 'utf8');

test('ex1: seawater description, SI and species', () => {
  const p = parseOutput(ex('ex1.out'));
  assert.equal(p.simulations.length, 1); // simulation 2 has no calculations
  const c = p.simulations[0].calcs[0];
  assert.match(c.heading, /^Initial solution 1/);
  assert.equal(c.description.pH, 8.22);
  assert.equal(c.description.ionicStrength, 0.6737);
  assert.equal(c.description.percentError, 0.07);
  const calcite = c.si.find(r => r.phase === 'Calcite')!;
  assert.deepEqual([calcite.si, calcite.logK, calcite.formula], [0.78, -8.45, 'CaCO3']);
  const c4 = c.species.find(g => g.element === 'C(4)')!;
  assert.equal(c4.species[0].name, 'HCO3-');
  assert.equal(c4.total, 2.233e-3);
});

test('ex2: reaction steps and selected output', () => {
  const p = parseOutput(ex('ex2.out'));
  const s = p.simulations[0];
  assert.ok(s.calcs.filter(c => c.phase === 'batch-reaction').length >= 51);
  const sel = parseSel(ex('ex2.sel'));
  assert.ok(sel.columns.includes('si_gypsum'));
  assert.equal(sel.rows.length, 52);
  assert.equal(sel.rows[1][sel.columns.indexOf('temp')], 25);
});

test('warnings are collected', () => {
  const p = parseOutput(ex('ex12b.out'));
  assert.ok(p.warnings.some(w => /dispersivities/.test(w)));
});

import { parseDatabase } from '../src/lib/dbParse.ts';
test('database entries from phreeqc.dat', () => {
  const db = parseDatabase(fs.readFileSync(new URL('../../../database/phreeqc.dat', import.meta.url), 'utf8'));
  const calcite = db.find(e => e.kind === 'PHASES' && e.name === 'Calcite')!;
  assert.equal(calcite.logk, '-8.45');
  assert.match(calcite.formula!, /CaCO3/);
  assert.ok(db.some(e => e.kind === 'SOLUTION_SPECIES' && e.name === 'CaCO3'));
  assert.ok(db.filter(e => e.kind === 'PHASES').length > 50);
});
