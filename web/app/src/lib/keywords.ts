// All 80 PHREEQC 3 keywords (src/PhreeqcKeywords/Keywords.cpp, without UNKNOWN), grouped,
// each with a short description and an insertable template that runs with phreeqc.dat.
import type { L3 } from './i18n.ts';
import { RAW_EXAMPLES } from './rawExamples.ts';

export interface Keyword { name: string; desc: string; template: string }
export interface KeywordGroup { id: string; name: L3; about: L3; keywords: Keyword[] }

const k = (name: string, desc: string, template: string): Keyword => ({ name, desc, template: template.replace(/^\n/, '') });

// a complete state written by DUMP, so the template runs as it stands; users paste their own DUMP output instead
const raw = (name: string, what: string) => k(name, `Raw ${what} state (as written by DUMP)`, `
# Example ${what} state written by DUMP (-${what.replace(/ /g, '_')} option); replace it with your own.
${RAW_EXAMPLES[name]}
`);
const modify = (name: string, what: string) => k(name, `Change a saved ${what}`, `
${name} 1
# Same identifiers as in ${name.replace('_MODIFY', '_RAW')}; only listed values change.
`);
const mix = (name: string, what: string) => k(name, `Make a ${what} as a mixture of saved ones`, `
${name} 3
    1   0.5
    2   0.5
`);

export const GROUPS: KeywordGroup[] = [
  {
    id: 'solutions', name: ['Solutions', '溶液', 'Larutan'],
    about: ['Water composition, many samples at once, mixing, isotopes.', '水質組成、複数試料、混合、同位体。', 'Komposisi air, banyak sampel, campuran, isotop.'],
    keywords: [
      k('SOLUTION', 'Initial solution composition', `
SOLUTION 1  Sample name
    units      mg/L
    temp       25
    pH         7.0
    pe         4.0
    Ca         40
    Mg         10
    Na         20
    K          2
    Alkalinity 120 as HCO3
    Cl         30
    S(6)       25 as SO4
`),
      k('SOLUTION_SPREAD', 'Many samples in table form', `
SOLUTION_SPREAD
    -units mg/L
Number  Description  pH   Ca   Mg   Na   Alkalinity  Cl   S(6)
                                    as HCO3           as SO4
1       Well-1       7.1  48   12   25   182         30   40
2       Well-2       6.9  62   15   30   214         35   55
`),
      k('MIX', 'Mix solutions by fraction', `
MIX 3
    1   0.8
    2   0.2
`),
      k('ISOTOPES', 'Isotope definitions (use iso.dat)', `
ISOTOPES
    C
        -isotope  [13C]  permil  0.0111802
`),
    ],
  },
  {
    id: 'phases', name: ['Phases and reactions', '相と反応', 'Fase dan reaksi'],
    about: ['Mineral and gas equilibria, stepwise reactions, temperature and pressure.', '鉱物・気体平衡、段階反応、温度と圧力。', 'Kesetimbangan mineral dan gas, reaksi bertahap, suhu dan tekanan.'],
    keywords: [
      k('EQUILIBRIUM_PHASES', 'Minerals and gases at equilibrium', `
EQUILIBRIUM_PHASES 1
#   phase       SI    amount (mol)
    Calcite     0.0   10.0
    CO2(g)     -3.5   10.0
`),
      k('GAS_PHASE', 'Fixed-pressure or fixed-volume gas', `
GAS_PHASE 1
    -fixed_pressure
    -pressure  1.0
    -volume    1.0
    -temperature 25.0
    CO2(g)     0.0
    CH4(g)     0.0
`),
      k('SOLID_SOLUTIONS', 'Ideal and non-ideal solid solutions', `
SOLID_SOLUTIONS 1
    Ca(x)Sr(1-x)CO3
        -comp  Calcite      0.0
        -comp  Strontianite 0.0
`),
      k('REACTION', 'Add reactants stepwise', `
REACTION 1
    NaCl  1.0
    0.1 0.2 0.5 1.0 moles
`),
      k('REACTION_TEMPERATURE', 'Temperature for each step', `
REACTION_TEMPERATURE 1
    25.0  75.0  in 11 steps
`),
      k('REACTION_PRESSURE', 'Pressure for each step', `
REACTION_PRESSURE 1
    1.0  100.0  in 5 steps
`),
      k('INCREMENTAL_REACTIONS', 'Cumulative or incremental reaction steps', `
INCREMENTAL_REACTIONS true
`),
    ],
  },
  {
    id: 'exchange', name: ['Exchange and surfaces', 'イオン交換と表面', 'Tukar ion dan permukaan'],
    about: ['Cation exchange and surface complexation.', '陽イオン交換と表面錯体形成。', 'Pertukaran kation dan kompleksasi permukaan.'],
    keywords: [
      k('EXCHANGE', 'Exchanger composition', `
EXCHANGE 1
    -equilibrate with solution 1
    X   0.01
`),
      k('SURFACE', 'Surface sites, diffuse layer, CD-MUSIC', `
SURFACE 1
    -equilibrate with solution 1
    Hfo_wOH  2e-4   600   0.09
    Hfo_sOH  5e-6
`),
    ],
  },
  {
    id: 'kinetics', name: ['Kinetics', '反応速度', 'Kinetika'],
    about: ['Rate-controlled reactions written in BASIC.', 'BASIC で記述する rate 支配反応。', 'Reaksi terkendali laju dalam BASIC.'],
    keywords: [
      k('KINETICS', 'Kinetic reactants and time steps', `
KINETICS 1
    Calcite
        -m0     1e-3
        -parms  5.0  0.3
        -tol    1e-8
    -steps  3600  in 10 steps   # seconds
`),
      k('RATES', 'Rate expressions in BASIC', `
RATES
    Calcite
-start
10  si_cc = SI("Calcite")
20  IF (M <= 0 AND si_cc < 0) THEN GOTO 200
30  k1 = 10^(0.198 - 444.0 / TK)
40  rate = k1 * (1 - 10^(2/3 * si_cc))
50  moles = rate * 0.001 * TIME
200 SAVE moles
-end
`),
      k('RATE_PARAMETERS_PK', 'Palandri and Kharaka rate parameters', `
RATE_PARAMETERS_PK
# mineral  log k(acid) E(acid) n(H+) log k(neutral) E(neutral) log k(base) E(base) n(OH-)
`),
      k('RATE_PARAMETERS_SVD', 'Sverdrup et al. rate parameters', `
RATE_PARAMETERS_SVD
# Sverdrup, Oelkers and others (2019) parameters for each mineral
`),
      k('RATE_PARAMETERS_HERMANSKA', 'Hermanska et al. rate parameters', `
RATE_PARAMETERS_HERMANSKA
# Hermanska and others (2022, 2023) parameters for each mineral
`),
    ],
  },
  {
    id: 'transport', name: ['Transport', '輸送', 'Transport'],
    about: ['1D advection, dispersion, diffusion, stagnant cells.', '1次元の移流・分散・拡散、停滞セル。', 'Adveksi, dispersi, difusi 1D, sel stagnan.'],
    keywords: [
      k('ADVECTION', 'Cell-by-cell advection', `
# ADVECTION needs solution 0 (inflow) and solutions 1 to -cells (the column)
SOLUTION 0  CaCl2 inflow
    Ca 1
    Cl 2
SOLUTION 1-10  Column water
    Na 1
    K  0.2
    N(5) 1.2
END
ADVECTION
    -cells   10
    -shifts  20
    -punch_cells 10
`),
      k('TRANSPORT', 'Advection, dispersion and diffusion in 1D', `
# TRANSPORT needs solution 0 (inflow) and solutions 1 to -cells (the column)
SOLUTION 0  CaCl2 inflow
    Ca 1
    Cl 2
SOLUTION 1-10  Column water
    Na 1
    K  0.2
    N(5) 1.2
END
TRANSPORT
    -cells          10
    -lengths        0.1
    -shifts         20
    -time_step      720     # seconds
    -flow_direction forward
    -boundary_conditions flux flux
    -dispersivities 0.002
    -diffusion_coefficient 0.0
    -punch_cells    10
`),
    ],
  },
  {
    id: 'inverse', name: ['Inverse modeling', '逆解析', 'Model invers'],
    about: ['Find reactions that explain a change in composition.', '組成変化を説明する反応を求める。', 'Mencari reaksi yang menjelaskan perubahan komposisi.'],
    keywords: [
      k('INVERSE_MODELING', 'Mass-balance inverse models', `
# two analyses along a flow path (initial and final water)
SOLUTION 1  Recharge
    pH 7.2
    Ca 1.0
    Mg 0.3
    Na 0.7
    Cl 0.5
    Alkalinity 2.6
    S(6) 0.1
SOLUTION 2  Downgradient
    pH 7.4
    Ca 2.2
    Mg 0.3
    Na 0.7
    Cl 0.5
    Alkalinity 3.4
    S(6) 0.9
END
INVERSE_MODELING 1
    -solutions      1  2
    -uncertainty    0.05
    -phases
        Calcite
        CO2(g)
        Gypsum
    -balances
        Ca
        Mg
        Na
        Cl
        Alkalinity
`),
    ],
  },
  {
    id: 'thermo', name: ['Thermodynamic data', '熱力学データ', 'Definisi termodinamika'],
    about: ['Add or change species, phases and activity-model parameters.', 'species、phase、活量モデルのパラメータを追加・変更。', 'Tambah atau ubah spesies, fase, dan parameter model aktivitas.'],
    keywords: [
      k('PHASES', 'Minerals and gases', `
PHASES
Fluorite
    CaF2 = Ca+2 + 2F-
    log_k     -10.6
    delta_h    4.69 kcal
`),
      k('SOLUTION_SPECIES', 'Aqueous species', `
SOLUTION_SPECIES
Ca+2 + F- = CaF+
    log_k      0.94
    delta_h    4.12 kcal
`),
      k('SOLUTION_MASTER_SPECIES', 'Aqueous master species', `
SOLUTION_MASTER_SPECIES
#element  species  alk   gfw_formula  element_gfw
Li        Li+      0.0   Li           6.941
`),
      k('EXCHANGE_SPECIES', 'Exchange species', `
EXCHANGE_SPECIES
X- + Na+ = NaX
    log_k   0.0
`),
      k('EXCHANGE_MASTER_SPECIES', 'Exchange master species', `
EXCHANGE_MASTER_SPECIES
    X   X-
`),
      k('SURFACE_SPECIES', 'Surface species', `
SURFACE_SPECIES
Hfo_wOH + Zn+2 = Hfo_wOZn+ + H+
    log_k  -2.32
`),
      k('SURFACE_MASTER_SPECIES', 'Surface master species', `
SURFACE_MASTER_SPECIES
    Hfo_w  Hfo_wOH
    Hfo_s  Hfo_sOH
`),
      k('PITZER', 'Pitzer parameters (use pitzer.dat)', `
PITZER
-B0
    Na+   Cl-   0.0765
`),
      k('SIT', 'SIT parameters (use sit.dat)', `
SIT
-epsilon
    Na+   Cl-   0.03
`),
      k('LLNL_AQUEOUS_MODEL_PARAMETERS', 'LLNL activity model parameters (llnl.dat has them already; add them to another database)', `
LLNL_AQUEOUS_MODEL_PARAMETERS   # values of llnl.dat
-temperatures
    0.01 25 60 100
    150 200 250 300
-dh_a
    0.4939 0.5114 0.5465 0.5995
    0.6855 0.7994 0.9593 1.218
-dh_b
    0.3253 0.3288 0.3346 0.3421
    0.3525 0.3639 0.3766 0.3925
-bdot
    0.0374 0.041 0.0438 0.046
    0.047 0.047 0.034 0
-co2_coefs
    -1.0312 0.0012806
    255.9 0.4445
    -0.001606
`),
      k('GAS_BINARY_PARAMETERS', 'Peng-Robinson binary interaction parameters', `
GAS_BINARY_PARAMETERS
    H2O(g)  CO2(g)  0.19
`),
      k('NAMED_EXPRESSIONS', 'Named log K expressions', `
NAMED_EXPRESSIONS
Log_K_example
    log_k     -1.0
    -analytic  0 0 0 0 0
`),
      k('ISOTOPE_RATIOS', 'Isotope ratios for output (use iso.dat)', `
ISOTOPE_RATIOS
    R(13C)  [13C]
`),
      k('ISOTOPE_ALPHAS', 'Fractionation factors for output (use iso.dat)', `
ISOTOPE_ALPHAS
    Alpha_13C_CO3-2/CO2(aq)  Log_alpha_13C_CO3-2/CO2(aq)
`),
      k('MEAN_GAMMAS', 'Mean activity coefficients for output', `
MEAN_GAMMAS
    CaCl2   Ca+2 1  Cl- 2
`),
      k('CALCULATE_VALUES', 'Named BASIC functions', `
CALCULATE_VALUES
Ratio_Ca_Mg
-start
10 SAVE TOT("Ca") / TOT("Mg")
-end
`),
    ],
  },
  {
    id: 'flow', name: ['Flow control', '実行制御', 'Kontrol alur'],
    about: ['Database, titles, save and reuse states, run cells.', 'データベース、タイトル、状態の保存と再利用。', 'Database, judul, simpan dan pakai keadaan, jalankan sel.'],
    keywords: [
      k('DATABASE', 'Choose a database file (the app sets this for you)', `
DATABASE phreeqc.dat
`),
      k('TITLE', 'Simulation title', `
TITLE My simulation
`),
      k('USE', 'Use a saved state', `
USE solution 1
`),
      k('SAVE', 'Save state after reaction', `
SAVE solution 2
`),
      k('COPY', 'Copy a state', `
COPY solution 1 2
`),
      k('DELETE', 'Delete a state', `
DELETE
    -solution 2
`),
      k('RUN_CELLS', 'Run reactions in cells', `
RUN_CELLS
    -cells    1-5
    -time_step 0
`),
      k('KNOBS', 'Numerical convergence settings', `
KNOBS
    -iterations        200
    -convergence_tolerance 1e-8
    -step_size         100
    -diagonal_scale    true
`),
      k('END', 'End of simulation', `
END
`),
    ],
  },
  {
    id: 'modify', name: ['Modify states', '状態の変更', 'Ubah keadaan'],
    about: ['Edit, mix or rewrite saved states.', '保存状態の編集・混合・書き換え。', 'Edit, campur, atau tulis ulang keadaan tersimpan.'],
    keywords: [
      modify('SOLUTION_MODIFY', 'solution'), mix('SOLUTION_MIX', 'solution'), raw('SOLUTION_RAW', 'solution'),
      modify('EQUILIBRIUM_PHASES_MODIFY', 'phase assemblage'), mix('EQUILIBRIUM_PHASES_MIX', 'phase assemblage'), raw('EQUILIBRIUM_PHASES_RAW', 'equilibrium phases'),
      modify('EXCHANGE_MODIFY', 'exchanger'), mix('EXCHANGE_MIX', 'exchanger'), raw('EXCHANGE_RAW', 'exchange'),
      modify('SURFACE_MODIFY', 'surface'), mix('SURFACE_MIX', 'surface'), raw('SURFACE_RAW', 'surface'),
      modify('GAS_PHASE_MODIFY', 'gas phase'), mix('GAS_PHASE_MIX', 'gas phase'), raw('GAS_PHASE_RAW', 'gas phase'),
      modify('KINETICS_MODIFY', 'kinetics'), mix('KINETICS_MIX', 'kinetics'), raw('KINETICS_RAW', 'kinetics'),
      modify('SOLID_SOLUTIONS_MODIFY', 'solid solution'), mix('SOLID_SOLUTIONS_MIX', 'solid solution'), raw('SOLID_SOLUTIONS_RAW', 'solid solutions'),
      modify('REACTION_MODIFY', 'reaction'), raw('REACTION_RAW', 'reaction'),
      modify('REACTION_TEMPERATURE_MODIFY', 'temperature'), raw('REACTION_TEMPERATURE_RAW', 'reaction temperature'),
      modify('REACTION_PRESSURE_MODIFY', 'pressure'), raw('REACTION_PRESSURE_RAW', 'reaction pressure'),
      raw('MIX_RAW', 'mix'),
      k('DUMP', 'Write states to a file', `
DUMP
    -file  dump.out
    -solution 1
`),
    ],
  },
  {
    id: 'output', name: ['Output', '出力', 'Keluaran'],
    about: ['Tables, charts, custom text and print control.', '表、グラフ、カスタム出力、印刷制御。', 'Tabel, grafik, teks kustom, dan kendali cetak.'],
    keywords: [
      k('SELECTED_OUTPUT', 'Table of chosen values (.sel)', `
SELECTED_OUTPUT 1
    -file   results.sel
    -reset  false
    -step   true
    -pH     true
    -temperature true
    -totals Ca Mg
    -saturation_indices  Calcite  Gypsum
`),
      k('USER_PUNCH', 'Custom table columns in BASIC', `
USER_PUNCH 1
    -headings  Ca_mg/L  SI_calcite
-start
10 PUNCH TOT("Ca") * 40.08e3, SI("Calcite")
-end
`),
      k('USER_PRINT', 'Custom text in the output file', `
USER_PRINT
-start
10 PRINT "Ionic strength:", MU
-end
`),
      k('USER_GRAPH', 'X-Y charts in BASIC (plotted in Results)', `
USER_GRAPH 1
    -headings  pH  SI_calcite
    -axis_titles "pH" "Saturation index"
-start
10 GRAPH_X -LA("H+")
20 GRAPH_Y SI("Calcite")
-end
`),
      k('PRINT', 'Choose printed sections', `
PRINT
    -reset  true
    -species true
    -saturation_indices true
`),
    ],
  },
];

export const ALL_KEYWORDS: Keyword[] = GROUPS.flatMap(g => g.keywords);
export const KEYWORD_SET = new Set(ALL_KEYWORDS.map(k => k.name));

/** Every spelling the engine accepts as a keyword (from Keywords.cpp), lower case. */
export const KEYWORD_ALIASES = new Set(`advection calculate_values comment copy database debug delete dump end eof equilibria equilibrium equilibrium_phase equilibrium_phase_mix equilibrium_phases equilibrium_phases_mix equilibrium_phases_modify equilibrium_phases_raw exchange exchange_master_species exchange_mix exchange_modify exchange_raw exchange_species gas_binary_parameters gas_phase gas_phase_mix gas_phase_modify gas_phase_raw incremental incremental_reactions inverse_modeling isotope_alphas isotope_ratios isotopes kinetics kinetics_mix kinetics_modify kinetics_raw knobs llnl_aqueous_model llnl_aqueous_model_parameters mean_gammas mix mix_equilibrium_phase mix_equilibrium_phases mix_exchange mix_gas_phase mix_kinetics mix_raw mix_solid_solution mix_solid_solutions mix_solution mix_surface named_analytical_expression named_analytical_expressions named_expressions named_log_k phases pitzer print pure pure_phases rate_parameters_hermanska rate_parameters_pk rate_parameters_svd rates reaction reaction_modify reaction_pressure reaction_pressure_modify reaction_pressure_raw reaction_pressures reaction_raw reaction_temperature reaction_temperature_modify reaction_temperature_raw run_cells save select_out select_output selected_out selected_output sit solid_solution solid_solution_mix solid_solution_modify solid_solutions solid_solutions_mix solid_solutions_modify solid_solutions_raw solution solution_master_species solution_mix solution_modify solution_raw solution_s solution_species solution_spread spread_solution surface surface_master_species surface_mix surface_modify surface_raw surface_species title transport use user_graph user_print user_punch`.split(' '));

/** True when a line starts a keyword block (the engine reads the first word, case-insensitive). */
export function lineKeyword(line: string): string | null {
  const m = line.match(/^\s*([A-Za-z_]+)(?=\s|$|;)/);
  if (!m) return null;
  const w = m[1].toLowerCase();
  return KEYWORD_ALIASES.has(w) ? w : null;
}
