// Thermodynamic diagrams computed by PHREEQC itself: log K of minerals (LK_PHASE),
// redox buffers in terms of fH2, and speciation of field samples (activities, SI).
import { SERP_DB, BAR_TO_ATM } from './model.ts';
import type { SelTable } from '../parseOutput.ts';

export const MAX_T_LLNL = 300;   // llnl.dat aqueous model limit, °C

export const MG_MINERALS = ['Brucite', 'Chrysotile', 'Antigorite', 'Talc', 'Forsterite', 'Enstatite'] as const;
export type MgMineral = typeof MG_MINERALS[number];
// dissolution reactions in llnl.dat:  mineral + nH H+ = nMg Mg+2 + nSi SiO2 + ... H2O
// with X = log(aMg+2 / aH+^2), Y = log aSiO2(aq):  nMg·X + nSi·Y = log K
export const STOICH: Record<MgMineral, { mg: number; si: number }> = {
  Brucite: { mg: 1, si: 0 }, Chrysotile: { mg: 3, si: 2 }, Antigorite: { mg: 48, si: 34 },
  Talc: { mg: 3, si: 4 }, Forsterite: { mg: 2, si: 1 }, Enstatite: { mg: 1, si: 1 },
};
export const SILICA = ['Quartz', 'SiO2(am)'] as const;

/** One simulation that prints log K of each phase at each temperature. */
export function logKInput(temps: number[], pressureBar: number, phases: string[]) {
  return [
    `TITLE log K of Mg silicates and silica (${SERP_DB})`,
    `SOLUTION 1`, `END`,
    `USE solution 1`,
    `REACTION_TEMPERATURE 1`, `    ${temps.join(' ')}`,
    `REACTION_PRESSURE 1`, `    ${+(pressureBar * BAR_TO_ATM).toPrecision(5)}`,
    `SELECTED_OUTPUT 1`, `    -file  logk.sel`, `    -reset false`,
    `USER_PUNCH`, `    -headings T_C ${phases.map(p => p.replace(/[()]/g, '')).join(' ')}`, `    -start`,
    `    10 PUNCH TC`,
    ...phases.map((p, i) => `    ${20 + i * 10} PUNCH LK_PHASE("${p}")`),
    `    -end`, `END`, '',
  ].join('\n');
}

export interface Field { mineral: string; y0: number; y1: number }
export interface ActivityDiagram { lines: { mineral: string; x: (y: number) => number }[]; envelope: { y: number; x: number; mineral: string }[]; fields: Field[]; silica: { name: string; y: number }[] }

/**
 * Stability fields on log(aMg/aH²) – log aSiO2: at each silica activity the mineral that saturates
 * at the lowest Mg activity is the stable one; below that envelope the water is undersaturated.
 */
export function activityDiagram(logK: Record<string, number>, minerals: MgMineral[], yRange: [number, number]): ActivityDiagram {
  const lines = minerals.filter(m => Number.isFinite(logK[m])).map(m => ({ mineral: m, x: (y: number) => (logK[m] - STOICH[m].si * y) / STOICH[m].mg }));
  const n = 400, env: ActivityDiagram['envelope'] = [];
  for (let i = 0; i <= n; i++) {
    const y = yRange[0] + (yRange[1] - yRange[0]) * i / n;
    let best = { x: Infinity, mineral: '' };
    for (const l of lines) { const x = l.x(y); if (x < best.x) best = { x, mineral: l.mineral }; }
    if (best.mineral) env.push({ y, ...best });
  }
  const fields: Field[] = [];
  for (const e of env) {
    const last = fields[fields.length - 1];
    if (last && last.mineral === e.mineral) last.y1 = e.y; else fields.push({ mineral: e.mineral, y0: last ? last.y1 : e.y, y1: e.y });
  }
  // exact boundaries: where neighbouring lines cross
  for (let i = 1; i < fields.length; i++) {
    const a = STOICH[fields[i - 1].mineral as MgMineral], b = STOICH[fields[i].mineral as MgMineral];
    const Ka = logK[fields[i - 1].mineral], Kb = logK[fields[i].mineral];
    const den = a.si / a.mg - b.si / b.mg;
    if (Math.abs(den) > 1e-12) { const y = (Ka / a.mg - Kb / b.mg) / den; fields[i - 1].y1 = y; fields[i].y0 = y; }
  }
  const silica = SILICA.filter(s => Number.isFinite(logK[s])).map(s => ({ name: s, y: logK[s] }));
  return { lines, envelope: env, fields, silica };
}

/** fH2 of the FMQ and HM redox buffers as a function of temperature. */
export function fh2Input(temps: number[], pressureBar: number) {
  const P = +(pressureBar * BAR_TO_ATM).toPrecision(5);
  const sim = (name: string, phases: string[]) => [
    `# ${name}`, `USE solution 1`, `EQUILIBRIUM_PHASES 1`, ...phases.map(p => `    ${p.padEnd(12)} 0  1`),
    `REACTION_TEMPERATURE 1`, `    ${temps.join(' ')}`, `REACTION_PRESSURE 1`, `    ${P}`,
    `USER_PUNCH`, `    -headings curve T_C log_fH2`, `    -start`, `    10 PUNCH "${name}", TC, SI("H2(g)")`, `    -end`, `END`,
  ].join('\n');
  const parts = [
    `TITLE log fH2 of redox buffers (${SERP_DB})`,
    `SOLUTION 1`, `    pH 7 charge`, `    Na 1`, `    Cl 1`, `END`,
    `SELECTED_OUTPUT 1`, `    -file  fh2.sel`, `    -reset false`,
    `USER_PUNCH`, `    -headings curve T_C log_fH2`, `    -start`, `    10 PUNCH "", TC, SI("H2(g)")`, `    -end`, `END`,
    sim('FMQ', ['Fayalite', 'Magnetite', 'Quartz']),
    sim('HM', ['Hematite', 'Magnetite']),
  ];
  return parts.join('\n') + '\n';
}

/** Speciation of field samples with the activities the diagrams need (one row per SOLUTION, in order). */
export function speciationInput(solutions: string) {
  return [
    `TITLE Field samples speciated for the serpentinization diagrams (${SERP_DB})`,
    `SELECTED_OUTPUT 1`, `    -file  samples.sel`, `    -reset false`,
    `USER_PUNCH`,
    `    -headings T_C pH pct_error la_Mg la_Ca la_SiO2 la_H log_fH2 H2_mmol SI_Chrysotile SI_Brucite SI_Calcite SI_Talc SI_Magnetite`,
    `    -start`,
    `    10 PUNCH TC, -LA("H+"), PERCENT_ERROR`,
    `    20 PUNCH LA("Mg+2"), LA("Ca+2"), LA("SiO2"), LA("H+")`,
    `    30 IF TOT("H(0)") > 1e-12 THEN PUNCH SI("H2(g)") ELSE PUNCH -999`,
    `    40 PUNCH TOT("H(0)") / 2 * 1000`,
    `    50 PUNCH SI("Chrysotile"), SI("Brucite"), SI("Calcite"), SI("Talc"), SI("Magnetite")`,
    `    -end`,
    solutions,
    `END`, '',
  ].join('\n');
}

/** Rows of a selected-output table as objects keyed by column name. */
export function records(t: SelTable): Record<string, number | string>[] {
  return t.rows.map(r => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])));
}
