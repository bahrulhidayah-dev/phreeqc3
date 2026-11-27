// Line-aligned numeric comparison of two PHREEQC output texts (output file, selected output, punch files).
// Lines that only carry run-specific information (file names, timing) are skipped.
const SKIP = /(Seconds\.|Database file:|Input file:|Output file:|Using PHREEQC|^\s*Reading (input|data base))/;
const NUMG = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const skel = l => l.replace(NUMG, '#').replace(/\s+/g, ' ').trim();
const lines = (t, echo = true) => t.replace(/\r/g, '').split('\n').filter(l => !SKIP.test(l) && l.trim() && (echo || !l.startsWith('\t')));

/**
 * Pairs the lines of a and b (allowing a few inserted or missing lines) and compares the numbers on paired lines.
 * A number "differs" when it is off by more than `abs` and by more than `rel` relative (4 significant digits
 * printed on two machines can differ by one unit in the last digit, i.e. up to ~1e-3 relative).
 * Each differing line is reported with its label (first word) so that callers can classify it.
 */
export function compareText(a, b, { rel = 1e-3, abs = 1e-10, echo = true } = {}) {
  const A = lines(a, echo), B = lines(b, echo);
  const r = { linesA: A.length, linesB: B.length, numbers: 0, bad: 0, maxRel: 0, worst: null, unpaired: 0, textMismatch: 0, diffs: [] };
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (skel(A[i]) !== skel(B[j])) {
      let k = 1, hit = null;
      for (; k <= 4 && !hit; k++) {
        if (j + k < B.length && skel(A[i]) === skel(B[j + k])) hit = ['b', k];
        else if (i + k < A.length && skel(A[i + k]) === skel(B[j])) hit = ['a', k];
      }
      if (hit) { r.unpaired += hit[1]; r.diffs.push({ line: (hit[0] === 'a' ? A.slice(i, i + hit[1]) : B.slice(j, j + hit[1])).join(' | '), kind: 'only-' + hit[0] }); if (hit[0] === 'a') i += hit[1]; else j += hit[1]; continue; }
      // same position, different words (e.g. two species of equal concentration printed in the other order)
      r.textMismatch++; r.diffs.push({ line: A[i].trim() + '  <>  ' + B[j].trim(), kind: 'text' });
      i++; j++; continue;
    }
    const x = A[i].match(NUMG) || [], y = B[j].match(NUMG) || [];
    let lineBad = false;
    for (let q = 0; q < x.length; q++) {
      r.numbers++;
      const u = +x[q], v = +y[q], d = Math.abs(u - v), s = Math.max(Math.abs(u), Math.abs(v));
      // one unit in the last printed digit is rounding, not a difference
      const dec = (x[q].split(/[eE]/)[0].split('.')[1] || '').length, ulp = 10 ** -dec * (x[q].match(/[eE]([-+]?\d+)/) ? 10 ** +x[q].match(/[eE]([-+]?\d+)/)[1] : 1);
      const q2 = s > 0 ? d / s : 0;
      if (d > abs && d > ulp * 1.01 && q2 > rel) { lineBad = true; if (q2 > r.maxRel) { r.maxRel = q2; r.worst = `${x[q]} vs ${y[q]}`; } }
    }
    if (lineBad) { r.bad++; r.diffs.push({ line: A[i].trim() + '  <>  ' + B[j].trim(), kind: 'num' }); }
    i++; j++;
  }
  r.unpaired += (A.length - i) + (B.length - j);
  return r;
}

// Quantities that are not fixed by the chemistry of the problem: the pe of a solution without a redox couple
// ("Adjusted to redox equilibrium" from 1e-39 mol of H2 or O2), the trace species and gases that follow from it,
// and the number of solver iterations. Two correct builds may print different values for these.
const INDETERMINATE = /^(pe|Iterations|Gamma|Pressure|H\(0\)|O\(0\)|C\(-4\)|S\(-2\)|H2|O2|CH4|HS-|H2S|S-2|\(H2S\)2|Sulfur|H2\(g\)|O2\(g\)|CH4\(g\)|H2S\(g\)|HD|D2|HD\(g\)|D2\(g\)|\[13C\]\S*|C[HD]\d?[HD]?\d?(\(g\))?|-+)$/;
const ISOTOPOLOGUE = /\[\d+[A-Z][a-z]?\]/;
/** Splits the differences of compareText into indeterminate (redox/solver), ordering (equal values printed in another order) and other. */
export function classify(r) {
  const c = { indeterminate: 0, ordering: 0, other: 0, examples: [] };
  const norm = l => l.replace(/\s+/g, ' ').trim();
  // a line missing on one side that appears, identical, among the lines missing on the other side was only printed in another order
  const pool = { 'only-a': new Map(), 'only-b': new Map() };
  for (const d of r.diffs) if (pool[d.kind]) for (const l of d.line.split(' | ')) pool[d.kind].set(norm(l), (pool[d.kind].get(norm(l)) || 0) + 1);
  for (const d of r.diffs) {
    const label = d.line.trim().split(/\s+/)[0];
    const other = d.kind === 'only-a' ? pool['only-b'] : pool['only-a'];
    if (d.kind === 'num' && (INDETERMINATE.test(label) || (ISOTOPOLOGUE.test(label) && INDETERMINATE.test(label.replace(/\[\d+([A-Z][a-z]?)\]/g, '$1').replace(/D/g, 'H').replace(/O(?=O|$)/, 'O'))))) c.indeterminate++;
    else if (d.kind === 'num' && /^(Alpha|O\[18O\]|\[18O\]2)/.test(label) && d.line.split('<>').every(h => (h.match(/[-+]?\d*\.\d+e[-+]\d+/gi) || []).every(v => Math.abs(+v) < 1e-6 || Math.abs(+v) === 0))) c.indeterminate++;
    else if (d.kind === 'only-b' && /^Pressure/.test(label)) c.indeterminate++;
    // isotope ratios of the redox-trace species (printed or not depending on their 1e-40 mol amounts)
    else if (/\b(O2|CH4|H2|H2S)\(aq\)/.test(d.line)) c.indeterminate++;
    else if ((d.kind === 'only-a' || d.kind === 'only-b') && d.line.split(' | ').every(l => other.get(norm(l)))) c.ordering++;
    else if (d.kind === 'text' && (/^-+$/.test(label) || /^Iterations/.test(label) || ISOTOPOLOGUE.test(d.line))) c.ordering++;
    else { c.other++; if (c.examples.length < 8) c.examples.push(d.kind + ': ' + d.line.slice(0, 160)); }
  }
  return c;
}
