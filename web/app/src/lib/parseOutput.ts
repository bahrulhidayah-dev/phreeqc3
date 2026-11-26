// Parsers for PHREEQC text output (.out) and selected-output tables (.sel).
// They only read what the engine wrote; nothing is recomputed here.

export interface Description {
  pH?: number; pe?: number; ionicStrength?: number; temperature?: number;
  conductance?: number; density?: number; percentError?: number; activityWater?: number; massWater?: number;
}
export interface SIRow { phase: string; si: number; logIAP: number; logK: number; formula: string }
export interface Species { name: string; molality: number; activity: number; logGamma: number }
export interface SpeciesGroup { element: string; total: number; species: Species[] }
export interface Calc {
  heading: string;          // e.g. "Initial solution 1.	Pure water" or "Reaction step 3."
  phase: string;            // "initial solution", "batch-reaction", "transport", ...
  description: Description;
  si: SIRow[];
  species: SpeciesGroup[];
}
export interface Simulation { n: number; title: string; calcs: Calc[] }
export interface ParsedOutput { simulations: Simulation[]; warnings: string[]; errors: string[] }

const num = (s: string | undefined) => {
  if (s == null) return NaN;
  const v = parseFloat(s.replace(/[^\d.eE+\-]/g, ''));
  return Number.isFinite(v) ? v : NaN;
};

function section(lines: string[], start: number) {
  // lines after a "----Name----" banner until the next banner or a "Beginning of"/"Reaction step" line
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i];
    if (/^-{5,}.*-{5,}\s*$/.test(l) || /^(Beginning of|Reaction step|Reading input data|End of simulation|Initial solution \d|Using )/.test(l)) break;
    out.push(l);
  }
  return out;
}

function parseDescription(block: string[]): Description {
  const d: Description = {};
  for (const l of block) {
    const m = l.match(/^\s*(.+?)\s+=\s+(\S+)/);
    if (!m) continue;
    const k = m[1].trim(), v = num(m[2]);
    if (k === 'pH') d.pH = v;
    else if (k === 'pe') d.pe = v;
    else if (k.startsWith('Ionic strength')) d.ionicStrength = v;
    else if (k.startsWith('Temperature')) d.temperature = v;
    else if (k.startsWith('Specific Conductance')) d.conductance = v;
    else if (k.startsWith('Density')) d.density = v;
    else if (k.startsWith('Percent error')) d.percentError = v;
    else if (k.startsWith('Activity of water')) d.activityWater = v;
    else if (k.startsWith('Mass of water')) d.massWater = v;
  }
  return d;
}

function parseSI(block: string[]): SIRow[] {
  const rows: SIRow[] = [];
  for (const l of block) {
    if (/^\s*Phase\s+SI/.test(l) || !l.trim() || /^\s*\*\*/.test(l)) continue;
    const m = l.match(/^\s+(\S+)\s+(-?[\d.]+(?:e[+-]?\d+)?)\s+(-?[\d.]+(?:e[+-]?\d+)?)\s+(-?[\d.]+(?:e[+-]?\d+)?)\s*(.*)$/i);
    if (m) rows.push({ phase: m[1], si: +m[2], logIAP: +m[3], logK: +m[4], formula: m[5].replace(/\s+For a gas.*$/, '').trim() });
  }
  return rows;
}

function parseSpecies(block: string[]): SpeciesGroup[] {
  const groups: SpeciesGroup[] = [];
  let cur: SpeciesGroup | null = null;
  for (const l of block) {
    if (!l.trim() || /Log\s+Log|Species\s+Molality/.test(l)) continue;
    const head = l.match(/^(\S+)\s+(\S+)\s*$/);
    if (head && !/^\s/.test(l)) { cur = { element: head[1], total: num(head[2]), species: [] }; groups.push(cur); continue; }
    const m = l.match(/^\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+\S+\s+(\S+)/);
    if (m) {
      if (!cur) { cur = { element: '', total: NaN, species: [] }; groups.push(cur); }
      cur.species.push({ name: m[1], molality: num(m[2]), activity: num(m[3]), logGamma: num(m[4]) });
    }
  }
  return groups;
}

export function parseOutput(text: string): ParsedOutput {
  const lines = text.split(/\r?\n/);
  const sims: Simulation[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];
  let sim: Simulation | null = null;
  let calc: Calc | null = null;
  let phase = '';
  let pendingTitle = false;

  const newCalc = (heading: string) => {
    if (!sim) { sim = { n: sims.length + 1, title: '', calcs: [] }; sims.push(sim); }
    calc = { heading: heading.replace(/\t/g, ' ').trim(), phase, description: {}, si: [], species: [] };
    sim.calcs.push(calc);
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^Reading input data for simulation (\d+)/))) {
      sim = { n: +m[1], title: '', calcs: [] }; sims.push(sim); calc = null; pendingTitle = true; continue;
    }
    if (pendingTitle && sim && /^\s*TITLE\b/i.test(l)) {
      const t = l.replace(/^\s*TITLE\s*/i, '').trim();
      if (t) { sim.title = t; pendingTitle = false; }
      continue;
    }
    if (/^-{5,}\s*$/.test(l) && pendingTitle && sim && !sim.title) {
      // title lines are printed between two dashed lines after the input echo
      const t: string[] = [];
      for (let j = i + 1; j < lines.length && !/^-{5,}\s*$/.test(lines[j]); j++) if (lines[j].trim()) t.push(lines[j].trim());
      if (t.length && t.length < 6) sim.title = t.join(' ');
      pendingTitle = false;
      continue;
    }
    if ((m = l.match(/^Beginning of (.+?) calculations\./))) { phase = m[1]; pendingTitle = false; continue; }
    if (/^(Initial solution \d+|Reaction step \d+|Initial exchange|Initial surface|Initial gas)/.test(l) ||
        /^(Transport step|Advection step)/i.test(l.trim())) { newCalc(l); continue; }
    if (/^WARNING:/.test(l)) {
      let w = l.replace(/^WARNING:\s*/, '');
      if (!w.trim() && lines[i + 1]) w = lines[i + 1].trim();
      warnings.push(w.trim()); continue;
    }
    if (/^ERROR:/.test(l)) { errors.push(l.replace(/^ERROR:\s*/, '').trim()); continue; }
    if (/-{5,}Description of solution-{5,}/.test(l)) {
      if (!calc) newCalc(phase || 'Solution');
      calc!.description = parseDescription(section(lines, i)); continue;
    }
    if (/-{5,}Saturation indices-{5,}/.test(l)) {
      if (!calc) newCalc(phase || 'Solution');
      calc!.si = parseSI(section(lines, i)); continue;
    }
    if (/-{5,}Distribution of species-{5,}/.test(l)) {
      if (!calc) newCalc(phase || 'Solution');
      calc!.species = parseSpecies(section(lines, i)); continue;
    }
  }
  return { simulations: sims.filter(s => s.calcs.length || s.title), warnings: [...new Set(warnings)], errors };
}

export interface SelTable { columns: string[]; rows: (number | string)[][] }

export function parseSel(text: string): SelTable {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return { columns: [], rows: [] };
  const split = (l: string) => (l.includes('\t') ? l.split('\t') : l.trim().split(/\s+/)).map(s => s.trim()).filter((s, i, a) => s !== '' || i < a.length - 1);
  const columns = split(lines[0]).filter(Boolean);
  const rows = lines.slice(1).map(l => {
    const cells = split(l).filter(Boolean);
    return columns.map((_, i) => {
      const c = cells[i] ?? '';
      const v = Number(c);
      return c !== '' && Number.isFinite(v) ? v : c;
    });
  });
  return { columns, rows };
}

/** PHREEQC writes -999.999 for "not defined"; treat as missing when plotting. */
export const isMissing = (v: unknown) => typeof v !== 'number' || !Number.isFinite(v) || v <= -999 && v >= -1000;
