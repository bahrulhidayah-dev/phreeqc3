// Reads entries (phases and species) from a PHREEQC database file for the explorer and autocomplete.
export interface DbEntry { kind: 'PHASES' | 'SOLUTION_SPECIES' | 'EXCHANGE_SPECIES' | 'SURFACE_SPECIES' | 'SOLUTION_MASTER_SPECIES'; name: string; text: string; logk?: string; formula?: string }

const SECTIONS = ['PHASES', 'SOLUTION_SPECIES', 'EXCHANGE_SPECIES', 'SURFACE_SPECIES', 'SOLUTION_MASTER_SPECIES'] as const;
const OTHER = /^(SOLUTION_MASTER_SPECIES|SOLUTION_SPECIES|PHASES|EXCHANGE_MASTER_SPECIES|EXCHANGE_SPECIES|SURFACE_MASTER_SPECIES|SURFACE_SPECIES|RATES|END|PITZER|SIT|LLNL_AQUEOUS_MODEL_PARAMETERS|NAMED_EXPRESSIONS|CALCULATE_VALUES|ISOTOPES|ISOTOPE_RATIOS|ISOTOPE_ALPHAS|MEAN_GAMMAS|RATE_PARAMETERS_\w+|GAS_BINARY_PARAMETERS|SOLUTION|KNOBS|PRINT|DATABASE|TITLE)\b/i;

export function parseDatabase(text: string): DbEntry[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: DbEntry[] = [];
  let section: DbEntry['kind'] | '' = '';
  let cur: DbEntry | null = null;
  const close = () => { if (cur) { cur.text = cur.text.replace(/\n+$/, ''); out.push(cur); cur = null; } };
  for (const line of lines) {
    const m = line.match(OTHER);
    if (m && /^\S/.test(line)) {
      close();
      const k = m[1].toUpperCase();
      section = (SECTIONS as readonly string[]).includes(k) ? (k as DbEntry['kind']) : '';
      continue;
    }
    if (!section) continue;
    const code = line.replace(/#.*$/, '');
    if (section === 'SOLUTION_MASTER_SPECIES') {
      const w = code.trim().split(/\s+/);
      if (w[0] && w[1]) out.push({ kind: section, name: w[0], text: line.trim(), formula: w[1] });
      continue;
    }
    if (section === 'PHASES') {
      if (/^\S/.test(code) && !code.includes('=')) { close(); cur = { kind: section, name: code.trim().split(/\s+/)[0], text: line }; continue; }
      if (cur) {
        cur.text += '\n' + line;
        if (code.includes('=') && !cur.formula) cur.formula = code.split('=')[0].trim();
        const lk = code.match(/^\s*-?log_?k\s+([^\s;]+)/i); if (lk) cur.logk = lk[1];
      }
      continue;
    }
    // species sections: an entry starts with a reaction line "a + b = c"
    if (code.includes('=') && !/^\s*-/.test(code) && !/^\s*(log_?k|delta_h|-analytic)/i.test(code)) {
      close();
      const name = code.split('=')[1].trim().split(/\s+/)[0];
      cur = { kind: section, name, text: line, formula: code.trim() };
      continue;
    }
    if (cur) {
      cur.text += '\n' + line;
      const lk = code.match(/^\s*-?log_?k\s+([^\s;]+)/i); if (lk) cur.logk = lk[1];
    }
  }
  close();
  return out;
}
