// Splits PHREEQC input text into keyword blocks and back, so the Model Builder and the
// Input Editor edit the same text. Splitting follows the engine: a line whose first word
// is a keyword starts a block; END closes a simulation.
import { lineKeyword } from './keywords.ts';

const CANON: Record<string, string> = {
  equilibria: 'EQUILIBRIUM_PHASES', equilibrium: 'EQUILIBRIUM_PHASES', equilibrium_phase: 'EQUILIBRIUM_PHASES', pure: 'EQUILIBRIUM_PHASES', pure_phases: 'EQUILIBRIUM_PHASES',
  equilibrium_phase_mix: 'EQUILIBRIUM_PHASES_MIX', mix_equilibrium_phase: 'EQUILIBRIUM_PHASES_MIX', mix_equilibrium_phases: 'EQUILIBRIUM_PHASES_MIX',
  mix_exchange: 'EXCHANGE_MIX', mix_gas_phase: 'GAS_PHASE_MIX', mix_kinetics: 'KINETICS_MIX', mix_solution: 'SOLUTION_MIX', mix_surface: 'SURFACE_MIX',
  mix_solid_solution: 'SOLID_SOLUTIONS_MIX', mix_solid_solutions: 'SOLID_SOLUTIONS_MIX', solid_solution: 'SOLID_SOLUTIONS', solid_solution_mix: 'SOLID_SOLUTIONS_MIX', solid_solution_modify: 'SOLID_SOLUTIONS_MODIFY',
  incremental: 'INCREMENTAL_REACTIONS', llnl_aqueous_model: 'LLNL_AQUEOUS_MODEL_PARAMETERS', reaction_pressures: 'REACTION_PRESSURE',
  named_analytical_expression: 'NAMED_EXPRESSIONS', named_analytical_expressions: 'NAMED_EXPRESSIONS', named_log_k: 'NAMED_EXPRESSIONS',
  select_out: 'SELECTED_OUTPUT', select_output: 'SELECTED_OUTPUT', selected_out: 'SELECTED_OUTPUT', solution_s: 'SOLUTION_SPECIES', spread_solution: 'SOLUTION_SPREAD',
  comment: 'COMMENT', debug: 'KNOBS', eof: 'END',
};
export const canonical = (alias: string) => CANON[alias] ?? alias.toUpperCase();

export interface Block { kw: string; head: string; text: string; sim: number; startLine: number }

export function splitBlocks(input: string): Block[] {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let cur: Block | null = null;
  let sim = 1;
  lines.forEach((line, i) => {
    const kw = lineKeyword(line);
    if (kw) {
      if (cur) blocks.push(cur);
      const c = canonical(kw);
      cur = { kw: c, head: line.trim(), text: line, sim, startLine: i + 1 };
      if (c === 'END') { blocks.push(cur); cur = null; sim++; }
      return;
    }
    if (!cur) cur = { kw: '', head: '', text: line, sim, startLine: i + 1 };
    else cur.text += '\n' + line;
  });
  if (cur) blocks.push(cur);
  return blocks;
}

export function joinBlocks(blocks: Block[]): string {
  return blocks.map(b => b.text).join('\n');
}

/** Number and description after the keyword, e.g. "SOLUTION 2 Seawater" -> ["2", "Seawater"]. */
export function headParts(head: string): { n: string; desc: string } {
  const m = head.match(/^\s*\S+\s*(-?\d+(?:-\d+)?)?\s*(.*)$/);
  return { n: m?.[1] ?? '', desc: (m?.[2] ?? '').trim() };
}

/** Counts simulations (ended by END, or a final unterminated one) and keyword blocks. */
export function summarize(input: string) {
  const blocks = splitBlocks(input).filter(b => b.kw);
  const sims = new Set(blocks.filter(b => b.kw !== 'END').map(b => b.sim)).size;
  const db = blocks.find(b => b.kw === 'DATABASE');
  return { simulations: sims, blocks: blocks.filter(b => b.kw !== 'END').length, database: db ? headParts(db.head).desc || db.head.split(/\s+/)[1] || '' : '' };
}

// ---- SOLUTION form model -------------------------------------------------
export interface SolutionRow { el: string; value: string; extra: string }
export interface SolutionForm {
  n: string; desc: string; units: string; temp: string; pH: string; pe: string; density: string;
  rows: SolutionRow[]; other: string[];
}
const SOL_OPTS = ['units', 'temp', 'temperature', 'ph', 'pe', 'density', 'redox', 'water', 'isotope', 'pressure', 'press', 'potential'];

export function parseSolution(b: Block): SolutionForm {
  const { n, desc } = headParts(b.head);
  const f: SolutionForm = { n, desc, units: '', temp: '', pH: '', pe: '', density: '', rows: [], other: [] };
  for (const raw of b.text.split('\n').slice(1)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) { if (raw.trim()) f.other.push(raw); continue; }
    const [w0, ...rest] = line.split(/\s+/);
    const key = w0.replace(/^-/, '').toLowerCase();
    const val = rest.join(' ');
    if (key === 'units' || key === 'unit') f.units = val;
    else if (key === 'temp' || key === 'temperature' || key === 't') f.temp = val;
    else if (key === 'ph') f.pH = val;
    else if (key === 'pe') f.pe = val;
    else if (key === 'density' || key === 'dens') f.density = val;
    else if (SOL_OPTS.includes(key) || w0.startsWith('-')) f.other.push(raw);
    else f.rows.push({ el: w0, value: rest[0] ?? '', extra: rest.slice(1).join(' ') });
  }
  return f;
}

export function writeSolution(f: SolutionForm, kw = 'SOLUTION'): string {
  const pad = (s: string, w: number) => (s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length));
  const out = [`${kw}${f.n ? ' ' + f.n : ''}${f.desc ? '  ' + f.desc : ''}`];
  if (f.units) out.push(`    ${pad('units', 11)}${f.units}`);
  if (f.temp) out.push(`    ${pad('temp', 11)}${f.temp}`);
  if (f.pH) out.push(`    ${pad('pH', 11)}${f.pH}`);
  if (f.pe) out.push(`    ${pad('pe', 11)}${f.pe}`);
  if (f.density) out.push(`    ${pad('density', 11)}${f.density}`);
  for (const r of f.rows) if (r.el) out.push(`    ${pad(r.el, 11)}${pad(r.value, 10)}${r.extra}`.trimEnd());
  out.push(...f.other);
  return out.join('\n');
}

// ---- EQUILIBRIUM_PHASES form model ---------------------------------------
export interface PhaseRow { phase: string; si: string; amount: string; extra: string }
export function parsePhases(b: Block): { n: string; desc: string; rows: PhaseRow[]; other: string[] } {
  const { n, desc } = headParts(b.head);
  const rows: PhaseRow[] = [], other: string[] = [];
  for (const raw of b.text.split('\n').slice(1)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line || line.startsWith('-')) { if (raw.trim()) other.push(raw); continue; }
    const [phase, si = '', amount = '', ...extra] = line.split(/\s+/);
    rows.push({ phase, si, amount, extra: extra.join(' ') });
  }
  return { n, desc, rows, other };
}
export function writePhases(p: { n: string; desc: string; rows: PhaseRow[]; other: string[] }, kw = 'EQUILIBRIUM_PHASES'): string {
  const pad = (s: string, w: number) => (s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length));
  return [`${kw}${p.n ? ' ' + p.n : ''}${p.desc ? '  ' + p.desc : ''}`,
    ...p.rows.filter(r => r.phase).map(r => `    ${pad(r.phase, 14)}${pad(r.si || '0', 8)}${pad(r.amount || '10', 8)}${r.extra}`.trimEnd()),
    ...p.other].join('\n');
}
