import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkUserPunch, fixPunchHeadings } from '../src/lib/punchFix.ts';

const base = (body: string) => `SOLUTION 1\nSELECTED_OUTPUT 1\n  -file a.sel\nUSER_PUNCH 1\n${body}\nEND\n`;

test('counts PUNCH values, ignoring commas inside strings and calls', () => {
  const c = checkUserPunch(base('  -headings pH Ca\n  10 PUNCH -LA("H+"), TOT("Ca"), "a,b"\n  20 PUNCH SI("Calcite"): PUNCH MOL("Ca+2")'));
  assert.equal(c.length, 1);
  assert.deepEqual(c[0].headings, ['pH', 'Ca']);
  assert.equal(c[0].values, 5);
});

test('loops and ADD_HEADING make the count unknown', () => {
  assert.equal(checkUserPunch(base('  10 FOR i = 1 TO 3\n  20 PUNCH i\n  30 NEXT i'))[0].values, null);
  assert.equal(checkUserPunch(base('  10 a = ADD_HEADING("x")\n  20 PUNCH 1'))[0].values, null);
});

test('fix adds missing names and trims extra ones', () => {
  const more = fixPunchHeadings(base('  -headings pH\n  10 PUNCH 1, 2, 3'));
  assert.equal(more.fixed, 1);
  assert.match(more.text, /-headings pH value_2 value_3\n/);
  const fewer = fixPunchHeadings(base('  -headings a b c\n  -headings d\n  10 PUNCH 1, 2'));
  assert.match(fewer.text, /-headings a b\n  10 PUNCH/);
  assert.doesNotMatch(fewer.text, /-headings d/);
  const none = fixPunchHeadings(base('  10 PUNCH 1'));
  assert.match(none.text, /USER_PUNCH 1\n    -headings value_1\n/);
  assert.equal(fixPunchHeadings(base('  -headings a\n  10 PUNCH 1')).fixed, 0);
});
