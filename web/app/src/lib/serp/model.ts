// Serpentinization models built as ordinary PHREEQC input (llnl.dat thermodynamic data).
// Everything here produces text that the unmodified PHREEQC engine runs.

export const SERP_DB = 'llnl.dat';
export const M_FO = 140.693;   // g/mol Mg2SiO4
export const M_FA = 203.777;   // g/mol Fe2SiO4
export const BAR_TO_ATM = 1 / 1.01325;

export type Serpentine = 'Chrysotile' | 'Antigorite';
export interface SerpParams {
  tempC: number;          // °C
  pressureBar: number;    // bar
  wr: number;             // water/rock mass ratio (kg water per kg olivine)
  fo: number;             // forsterite content, mol % (Fo90 = 90)
  naclMmol: number;       // NaCl, mmol/kgw
  dicMmol: number;        // dissolved inorganic carbon, mmol/kgw (0 = carbon-free)
  caMmol: number;         // Ca, mmol/kgw
  steps: number;          // reaction steps from fresh rock to the full W/R
  serpentine: Serpentine;
  feSolidSolution: boolean;  // Fe(OH)2 in brucite, greenalite in serpentine
  talc: boolean;
  calcite: boolean;
  gasPhase: boolean;         // a free gas phase (H2, CH4, H2O) forms when fugacities exceed the pressure
}

export const DEFAULT_PARAMS: SerpParams = {
  tempC: 200, pressureBar: 300, wr: 1, fo: 90, naclMmol: 500, dicMmol: 0, caMmol: 0,
  steps: 12, serpentine: 'Chrysotile', feSolidSolution: true, talc: false, calcite: false, gasPhase: true,
};

/**
 * Fe-bearing solid solutions are only defined when the olivine has Fe: with Fo100 their Fe end-members
 * (Fe(OH)2, greenalite) have nothing to form from and PHREEQC does not converge, so pure phases are used.
 */
export const usesFeSolidSolution = (p: Pick<SerpParams, 'feSolidSolution' | 'fo'>) => p.feSolidSolution && p.fo < 100;

export const olivineMolarMass = (fo: number) => (fo / 100) * M_FO + (1 - fo / 100) * M_FA;
/** Moles of olivine reacted with 1 kg of water at a water/rock mass ratio. */
export const olivineMoles = (wr: number, fo: number) => 1000 / (Math.max(wr, 1e-6) * olivineMolarMass(fo));

const f = (v: number, d = 4) => String(+v.toPrecision(d));
const atm = (bar: number) => f(bar * BAR_TO_ATM, 5);

function solutionBlock(p: SerpParams, n = 1) {
  const lines = [`SOLUTION ${n}  Initial fluid (NaCl ${f(p.naclMmol)} mmol/kgw)`, `    temp      25`, `    pH        7  charge`, `    units     mmol/kgw`];
  if (p.naclMmol > 0) lines.push(`    Na        ${f(p.naclMmol)}`, `    Cl        ${f(p.naclMmol)}`);
  else lines.push(`    Na        0.001`, `    Cl        0.001`);
  if (p.caMmol > 0) lines.push(`    Ca        ${f(p.caMmol)}`, `    Cl        ${f(p.naclMmol + 2 * p.caMmol)}`);
  if (p.dicMmol > 0) lines.push(`    C(4)      ${f(p.dicMmol)}`);
  lines.push(`    Si        0.001`, `    Mg        0.001`, `    Fe        0.0001`);
  // a duplicate Cl line would be an input error: keep the last one only
  const seen = new Map<string, number>();
  lines.forEach((l, i) => { const k = l.trim().split(/\s+/)[0]; if (k === 'Cl') seen.set(k, i); });
  return lines.filter((l, i) => !(l.trim().startsWith('Cl ') && seen.get('Cl') !== i)).join('\n');
}

function phaseBlocks(p: SerpParams, n = 1) {
  const eq = [`EQUILIBRIUM_PHASES ${n}   # secondary minerals; 0 0 = may precipitate, none at the start`, `    Magnetite    0  0`];
  if (!usesFeSolidSolution(p)) eq.push(`    ${p.serpentine.padEnd(12)} 0  0`, `    Brucite      0  0`);
  if (p.talc) eq.push(`    Talc         0  0`);
  if (p.calcite) eq.push(`    Calcite      0  0`);
  const out = [eq.join('\n')];
  if (usesFeSolidSolution(p)) out.push([
    `SOLID_SOLUTIONS ${n}   # Fe may enter brucite and serpentine (ideal solid solutions)`,
    `    Brucite_ss`, `        -comp  Brucite      0`, `        -comp  Fe(OH)2      0`,
    `    Serpentine_ss`, `        -comp  ${p.serpentine.padEnd(12)}0`, `        -comp  Greenalite   0`,
  ].join('\n'));
  if (p.gasPhase) out.push([
    `GAS_PHASE ${n}   # forms only if fH2 + fCH4 + fH2O exceed the pressure`,
    `    -fixed_pressure`, `    -pressure  ${atm(p.pressureBar)}`, `    -volume    1e-6`, `    -temperature ${f(p.tempC)}`,
    `    H2(g)      0`, `    CH4(g)     0`, `    H2O(g)     0`,
  ].join('\n'));
  return out.join('\n');
}

const PUNCH_HEAD = 'olivine_mol W:R rock_g pH pe log_fH2 H2_mmol_kgw CH4_mmol_kgw Mg_mmol Si_mmol Ca_mmol Magnetite_mol Brucite_mol Serpentine_mol FeBrucite_mol Greenalite_mol Talc_mol Calcite_mol gas_H2_mol gas_CH4_mol water_kg';

function punchBlock(p: SerpParams, extraHead = '', extraFirst = '') {
  const serp = p.serpentine;
  const ss = usesFeSolidSolution(p);
  return [
    `USER_PUNCH`,
    `    -headings  ${extraHead}${PUNCH_HEAD}`,
    `    -start`,
    ...(extraFirst ? [extraFirst] : []),
    `    10 M_ol = ${f(olivineMolarMass(p.fo), 6)}`,
    `    20 PUNCH RXN`,
    `    30 IF RXN > 0 THEN PUNCH 1000 / (RXN * M_ol) ELSE PUNCH 0`,
    `    40 PUNCH RXN * M_ol, -LA("H+"), -LA("e-"), SI("H2(g)")`,
    `    50 PUNCH TOT("H(0)") / 2 * 1000, TOT("C(-4)") * 1000   # H(0) counts H atoms: /2 gives mol H2`,
    `    60 PUNCH TOT("Mg") * 1000, TOT("Si") * 1000, TOT("Ca") * 1000`,
    ss ? `    70 PUNCH EQUI("Magnetite"), S_S("Brucite"), S_S("${serp}"), S_S("Fe(OH)2"), S_S("Greenalite")`
       : `    70 PUNCH EQUI("Magnetite"), EQUI("Brucite"), EQUI("${serp}"), 0, 0`,
    `    80 PUNCH ${p.talc ? 'EQUI("Talc")' : '0'}, ${p.calcite ? 'EQUI("Calcite")' : '0'}`,
    `    90 PUNCH ${p.gasPhase ? 'GAS("H2(g)"), GAS("CH4(g)")' : '0, 0'}, TOT("water")`,
    `    -end`,
  ].join('\n');
}

/** Reaction-path model: olivine added step by step to 1 kg of fluid up to the chosen W/R. */
export function presetInput(p: SerpParams): string {
  const total = olivineMoles(p.wr, p.fo);
  const fo = p.fo / 100;
  const n = Math.max(2, Math.min(60, Math.round(p.steps)));
  // geometric steps: early steps resolve the first, fast changes of pH and H2
  const fr = Array.from({ length: n }, (_, i) => Math.pow(10, -3 + 3 * (i / (n - 1))));
  const amounts = fr.map(x => x * total).map(v => f(v, 4));
  const rows: string[] = [];
  for (let i = 0; i < amounts.length; i += 8) rows.push('    ' + amounts.slice(i, i + 8).join(' '));
  return [
    `TITLE Serpentinization of Fo${f(p.fo, 3)} olivine at ${f(p.tempC)} C, ${f(p.pressureBar)} bar, W/R ${f(p.wr)}`,
    `# Aquos Geochemistry · Serpentinization preset (database ${SERP_DB})`,
    `# Olivine (Fo${f(p.fo, 3)}, ${f(olivineMolarMass(p.fo), 5)} g/mol) reacts with 1 kg of fluid.`,
    `# Final step: ${f(total)} mol olivine = ${f(total * olivineMolarMass(p.fo))} g rock, W/R = ${f(p.wr)}.`,
    solutionBlock(p),
    `END`,
    `USE solution 1`,
    phaseBlocks(p),
    `REACTION 1   Olivine Fo${f(p.fo, 3)} = ${f(fo)} Mg2SiO4 + ${f(1 - fo)} Fe2SiO4`,
    `    Forsterite   ${f(fo)}`,
    `    Fayalite     ${f(1 - fo)}`,
    rows.join('\n').replace(/$/, ' moles'),
    `REACTION_TEMPERATURE 1`,
    `    ${f(p.tempC)}`,
    `REACTION_PRESSURE 1`,
    `    ${atm(p.pressureBar)}    # atm (= ${f(p.pressureBar)} bar)`,
    `INCREMENTAL_REACTIONS false`,
    punchBlock(p),
    `SELECTED_OUTPUT 1`,
    `    -file      serpentinization.sel`,
    `    -reset     false`,
    `USER_GRAPH 1  Serpentinization: pH and H2`,
    `    -headings  W:R pH H2_mmol/kgw`,
    `    -axis_titles  "Olivine reacted, mol/kgw" "pH" "H2, mmol/kgw"`,
    `    -axis_scale x_axis auto auto auto auto log`,
    `    -start`,
    `    10 IF RXN <= 0 THEN GOTO 100`,
    `    20 PLOT_XY RXN, -LA("H+"), color = Blue, symbol = Circle`,
    `    30 PLOT_XY RXN, TOT("H(0)") / 2 * 1000, color = Red, symbol = Square, y-axis = 2`,
    `    100 REM`,
    `    -end`,
    `END`,
    '',
  ].join('\n');
}

// ---------------- parameter sweep ----------------
export interface SweepAxis { key: 'tempC' | 'wr' | 'fo'; values: number[] }
export interface Scenario { i: number; tempC: number; wr: number; fo: number }

export function scenarios(t: number[], wr: number[], fo: number[]): Scenario[] {
  const out: Scenario[] = [];
  for (const a of t) for (const b of wr) for (const c of fo) out.push({ i: out.length + 1, tempC: a, wr: b, fo: c });
  return out;
}

/** One PHREEQC input with one simulation per scenario; each prints one row of selected output. */
export function sweepInput(base: SerpParams, list: Scenario[], file = 'sweep.sel'): string {
  const parts = [
    `TITLE Serpentinization sweep (${list.length} scenarios)`,
    `# Aquos Geochemistry · parameter sweep (database ${SERP_DB})`,
    solutionBlock(base),
    `END`,
    `SELECTED_OUTPUT 1`,
    `    -file      ${file}`,
    `    -reset     false`,
    // headings must be known when the selected-output file is opened
    punchBlock(base, 'scenario T_C P_bar Fo WR_target '),
    `END`,
  ];
  for (const s of list) {
    const p = { ...base, fo: s.fo, tempC: s.tempC };
    const fo = s.fo / 100;
    parts.push(
      `# scenario ${s.i}: T ${s.tempC} C, W/R ${s.wr}, Fo${s.fo}`,
      `USE solution 1`,
      phaseBlocks(p),
      `REACTION 1`, `    Forsterite   ${f(fo)}`, `    Fayalite     ${f(1 - fo)}`, `    ${f(olivineMoles(s.wr, s.fo), 5)} moles`,
      `REACTION_TEMPERATURE 1`, `    ${f(s.tempC)}`,
      `REACTION_PRESSURE 1`, `    ${atm(base.pressureBar)}`,
      punchBlock(p, 'scenario T_C P_bar Fo WR_target ', `    1 PUNCH ${s.i}, TC, ${f(base.pressureBar)}, ${f(s.fo, 4)}, ${s.wr}`),
      `END`,
    );
  }
  return parts.join('\n') + '\n';
}
