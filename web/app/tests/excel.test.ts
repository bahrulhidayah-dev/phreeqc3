import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessColumn, readSamples, buildSolutions, parseCSV } from '../src/lib/excel.ts';

test('column names are recognized', () => {
  assert.deepEqual(guessColumn('Ca_mgL').target, 'Ca');
  assert.equal(guessColumn('Ca_mgL').unit, 'mg/L');
  assert.deepEqual([guessColumn('HCO3_mgL').target, guessColumn('HCO3_mgL').unit], ['Alkalinity', 'mg/L as HCO3']);
  assert.equal(guessColumn('SO4 (mg/L)').target, 'S(6)');
  assert.equal(guessColumn('Temp_C').target, 'temp');
  assert.equal(guessColumn('Calcium').target, 'Ca');
  assert.equal(guessColumn('Fe_total').confident, false);
  assert.equal(guessColumn('Turbidity').target, '');
});

test('csv with unit row becomes SOLUTION blocks that keep "as"', () => {
  const csv = 'Sample,Description,Temp,pH,Ca,Alkalinity,S(6)\n,,°C,,,as HCO3,as SO4\n1,Well A,25,7.1,48.2,182,40\n2,Well B,26,6.9,61.5,214,55\n';
  const s = readSamples([parseCSV(csv)]);
  assert.equal(s.data.length, 2);
  const text = buildSolutions(s.columns, s.data, 'mg/L');
  assert.match(text, /SOLUTION 1  Well A/);
  assert.match(text, /Alkalinity +182 +as HCO3/);
  assert.match(text, /S\(6\) +40 +as SO4/);
  assert.match(text, /SOLUTION 2  Well B/);
});
