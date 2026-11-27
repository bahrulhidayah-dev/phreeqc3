// Synthetic data set for testing Aquos Geochemistry (layer 2).
// Each sample is written twice: as a spreadsheet row in the app's template layout (header row, unit row,
// one row per sample) and as a hand-written PHREEQC SOLUTION block that states the same analysis
// explicitly. The test imports the spreadsheet through the app and compares with the hand-written block.

// ---------- Solutions sheet (main Excel import) ----------
// header and unit row; aliases (Magnesium, HCO3, SO4, NO3, NH4, H2S, CH4, DIC, SiO2) and units in the header
// (Na_mmolL) are part of the test
export const SOL_HEAD = ['Sample', 'Description', 'Temp', 'pH', 'pe', 'Ca', 'Magnesium', 'Na_mmolL', 'K', 'Fe(2)', 'Fe(3)', 'Al', 'SiO2', 'Cl', 'HCO3', 'SO4', 'NO3', 'NH4', 'H2S', 'CH4', 'DIC', 'F', 'Li', 'B', 'Br', 'Remarks'];
export const SOL_UNIT = ['', '', '°C', '', '', 'mg/L', 'mg/L', '', 'mg/L', 'ug/L', 'ug/L', 'mg/L', 'as SiO2', 'mg/L', 'as HCO3', 'as SO4', 'as NO3', 'as NH4', 'as H2S', 'as CH4', 'mmol/L', 'mg/L', 'ug/L', 'mg/L', 'mg/L', ''];

// cases: id, what it tests, row values (same order as SOL_HEAD), hand-written PHREEQC lines (units mg/L default)
export const SOL_CASES = [
  {
    id: 'S01', tests: 'Air tanah normal tipe Ca-HCO3 (acuan)',
    row: [1, 'S01 Normal groundwater', 25, 7.2, 4, 60, 12, 0.87, 3, 50, null, null, 18, 25, 220, 30, 8, null, null, null, null, 0.3, 10, 0.05, null, 'baseline'],
    phreeqc: ['temp 25', 'pH 7.2', 'pe 4', 'Ca 60', 'Mg 12', 'Na 0.87 mmol/L', 'K 3', 'Fe(2) 50 ug/L', 'Si 18 as SiO2', 'Cl 25', 'Alkalinity 220 as HCO3', 'S(6) 30 as SO4', 'N(5) 8 as NO3', 'F 0.3', 'Li 10 ug/L', 'B 0.05'],
  },
  {
    id: 'S02', tests: 'Air laut: kekuatan ion tinggi (I ≈ 0.7)',
    row: [2, 'S02 Seawater', 25, 8.1, 8.45, 412, 1290, 468, 399, null, null, null, 4.28, 19350, 142, 2710, null, null, null, null, null, 1.3, 170, 4.5, 67, 'high ionic strength'],
    phreeqc: ['temp 25', 'pH 8.1', 'pe 8.45', 'Ca 412', 'Mg 1290', 'Na 468 mmol/L', 'K 399', 'Si 4.28 as SiO2', 'Cl 19350', 'Alkalinity 142 as HCO3', 'S(6) 2710 as SO4', 'F 1.3', 'Li 170 ug/L', 'B 4.5', 'Br 67'],
  },
  {
    id: 'S03', tests: 'Air asam tambang: pH 2.6, Fe(2)/Fe(3), Al, SO4 tinggi',
    row: [3, 'S03 Acid mine drainage', 18, 2.6, 14, 180, 90, 0.5, 2, 150000, 80000, 45, 60, 15, null, 1700, null, null, null, null, null, null, null, null, null, 'extreme low pH'],
    phreeqc: ['temp 18', 'pH 2.6', 'pe 14', 'Ca 180', 'Mg 90', 'Na 0.5 mmol/L', 'K 2', 'Fe(2) 150000 ug/L', 'Fe(3) 80000 ug/L', 'Al 45', 'Si 60 as SiO2', 'Cl 15', 'S(6) 1700 as SO4'],
  },
  {
    id: 'S04', tests: 'Mata air hiperalkalin serpentinit: pH 11.6, DIC sebagai C(4), CH4 sebagai C(-4)',
    row: [4, 'S04 Hyperalkaline spring', 32, 11.6, -4, 55, 0.1, 3.5, 3, null, null, null, 0.5, 110, null, 5, null, null, null, 0.05, 0.02, null, null, null, null, 'extreme high pH'],
    phreeqc: ['temp 32', 'pH 11.6', 'pe -4', 'Ca 55', 'Mg 0.1', 'Na 3.5 mmol/L', 'K 3', 'Si 0.5 as SiO2', 'Cl 110', 'S(6) 5 as SO4', 'C(-4) 0.05 as CH4', 'C(4) 0.02 mmol/L'],
  },
  {
    id: 'S05', tests: 'Air anoksik: S(-2), N(-3), C(-4), Fe(2), pe -3.5',
    row: [5, 'S05 Anoxic groundwater', 22, 6.9, -3.5, 80, 20, 1.5, 5, 3000, null, null, 25, 40, 400, 10, null, 2.5, 1.2, 4, null, null, null, null, null, 'redox species'],
    phreeqc: ['temp 22', 'pH 6.9', 'pe -3.5', 'Ca 80', 'Mg 20', 'Na 1.5 mmol/L', 'K 5', 'Fe(2) 3000 ug/L', 'Si 25 as SiO2', 'Cl 40', 'Alkalinity 400 as HCO3', 'S(6) 10 as SO4', 'N(-3) 2.5 as NH4', 'S(-2) 1.2 as H2S', 'C(-4) 4 as CH4'],
  },
  {
    id: 'S06', tests: 'Neraca muatan buruk (Na berlebih, galat ≈ +30 %)',
    row: [6, 'S06 Bad charge balance', 25, 7.2, 4, 60, 12, 4, 3, 50, null, null, 18, 25, 220, 30, 8, null, null, null, null, 0.3, 10, 0.05, null, 'charge balance error'],
    phreeqc: ['temp 25', 'pH 7.2', 'pe 4', 'Ca 60', 'Mg 12', 'Na 4 mmol/L', 'K 3', 'Fe(2) 50 ug/L', 'Si 18 as SiO2', 'Cl 25', 'Alkalinity 220 as HCO3', 'S(6) 30 as SO4', 'N(5) 8 as NO3', 'F 0.3', 'Li 10 ug/L', 'B 0.05'],
  },
  {
    id: 'S07', tests: 'Sel kosong dan teks ("n.d.", "<0.5"): diabaikan; Temp dan pe kosong memakai default PHREEQC',
    row: [7, 'S07 Missing values', null, 7.0, null, 30, 'n.d.', null, '<0.5', null, null, null, null, 20, 90, '', null, null, null, null, null, null, null, null, null, 'empty cells'],
    phreeqc: ['pH 7.0', 'Ca 30', 'Cl 20', 'Alkalinity 90 as HCO3'],
  },
  {
    id: 'S08', tests: 'Air panas bumi 90 °C: SiO2, B, Li tinggi',
    row: [8, 'S08 Geothermal water', 90, 8.8, 4, 4, 0.05, 14, 25, null, null, null, 350, 300, 300, 60, null, null, null, null, null, 6, 2500, 8, null, 'high temperature'],
    phreeqc: ['temp 90', 'pH 8.8', 'pe 4', 'Ca 4', 'Mg 0.05', 'Na 14 mmol/L', 'K 25', 'Si 350 as SiO2', 'Cl 300', 'Alkalinity 300 as HCO3', 'S(6) 60 as SO4', 'F 6', 'Li 2500 ug/L', 'B 8'],
  },
  {
    id: 'S09', tests: 'Kode sampel teks ("A-9") dan air hujan sangat encer pH 5.6',
    row: ['A-9', 'S09 Rainwater', 20, 5.6, 4, 0.3, 0.05, 0.02, 0.1, null, null, null, null, 0.6, null, 1.2, 1.5, 0.4, null, null, null, null, null, null, null, 'text id, dilute'],
    phreeqc: ['temp 20', 'pH 5.6', 'pe 4', 'Ca 0.3', 'Mg 0.05', 'Na 0.02 mmol/L', 'K 0.1', 'Cl 0.6', 'S(6) 1.2 as SO4', 'N(5) 1.5 as NO3', 'N(-3) 0.4 as NH4'],
  },
  {
    id: 'S10', tests: 'Nomor sampel kosong (penomoran otomatis) dan pH 13 (larutan NaOH)',
    row: [null, 'S10 Caustic pH 13', 25, 13.0, 4, null, null, 110, null, null, null, null, null, 10, null, null, null, null, null, null, null, null, null, null, null, 'extreme pH 13'],
    phreeqc: ['temp 25', 'pH 13.0', 'pe 4', 'Na 110 mmol/L', 'Cl 10'],
  },
  {
    id: 'S11', tests: 'Data tidak konsisten yang PHREEQC sendiri tolak: alkalinitas non-karbonat (borat, silikat) > alkalinitas total pada 90 °C. Harus gagal dengan ERROR yang sama di web dan native',
    row: [11, 'S11 Inconsistent alkalinity', 90, 8.8, 4, 4, 0.05, 12, 25, null, null, null, 350, 450, 120, 60, null, null, null, null, null, 6, 2500, 8, null, 'expected PHREEQC error'],
    phreeqc: ['temp 90', 'pH 8.8', 'pe 4', 'Ca 4', 'Mg 0.05', 'Na 12 mmol/L', 'K 25', 'Si 350 as SiO2', 'Cl 450', 'Alkalinity 120 as HCO3', 'S(6) 60 as SO4', 'F 6', 'Li 2500 ug/L', 'B 8'],
    expectError: /non-carbonate alkalinity/,
  },
];
// rows that the import must skip
export const SOL_SKIP_ROWS = [
  ['# baris komentar: diawali #, harus diabaikan', null, 25, 7],
  [],
];

// ---------- Field data sheet (Serpentinization Lab) ----------
export const FIELD_HEAD = ['Sample', 'Site', 'Latitude', 'Longitude', 'Temp', 'pH', 'ORP', 'Eh', 'Ca', 'Mg', 'Na', 'K', 'Si', 'Cl', 'SO4', 'Alkalinity', 'DIC', 'Fe', 'H2', 'CH4'];
export const FIELD_UNIT = ['', '', 'decimal °', 'decimal °', '°C', '', 'mV', 'mV', 'mg/L', 'mg/L', 'mg/L', 'mg/L', 'mg/L as SiO2', 'mg/L', 'mg/L', 'mg/L as HCO3', 'mmol/L', 'mg/L', 'umol/L', 'umol/L'];
export const FIELD_CASES = [
  { id: 'F01', tests: 'Tipe II (Ca-OH) pH 11.7, H2 dan CH4 terlarut, DIC',
    row: ['F01', 'Spring Ca-OH', -2.55, 121.35, 30.5, 11.7, -480, null, 62, 0.08, 98, 3.9, 0.6, 105, 18, null, 0.03, 0.004, 210, 4.5] },
  { id: 'F02', tests: 'Tipe I (Mg-HCO3) pH 8.3, alkalinitas',
    row: ['F02', 'Stream Mg-HCO3', -2.61, 121.42, 27.2, 8.3, 135, null, 8, 45, 10, 0.7, 22, 14, 24, 260, null, null, null, null] },
  { id: 'F03', tests: 'Zona campuran pH 10.2, alkalinitas diabaikan (pH ≥ 10) karena DIC kosong',
    row: ['F03', 'Mixing zone', -2.58, 121.38, 29, 10.2, -150, null, 25, 12, 40, 1.8, 6, 50, 20, 95, null, null, 15, 0.8] },
  { id: 'F04', tests: 'Eh langsung (vs SHE), bukan ORP',
    row: ['F04', 'Well with Eh', -2.70, 121.50, 26, 7.4, null, 250, 40, 15, 20, 2, 18, 30, 35, 180, null, 0.1, null, null] },
  { id: 'F05', tests: 'Tanpa koordinat (tidak tampil di peta, tetap dihitung)',
    row: ['F05', 'No coordinates', null, null, 25, 9.1, 60, null, 10, 30, 15, 1, 15, 20, 15, 200, null, null, null, null] },
  { id: 'F06', tests: 'Koordinat di luar rentang (bujur 250°): harus ditolak peta',
    row: ['F06', 'Bad longitude', -2.5, 250, 25, 7.5, 100, null, 20, 5, 10, 1, 10, 15, 10, 80, null, null, null, null] },
  { id: 'F07', tests: 'Neraca muatan buruk (Na 12× lipat)',
    row: ['F07', 'Bad balance', -2.65, 121.45, 27, 8.3, 135, null, 8, 45, 120, 0.7, 22, 14, 24, 260, null, null, null, null] },
  { id: 'F08', tests: 'pH 12.4, H2 sangat tinggi (1 mmol/L)',
    row: ['F08', 'Very high H2', -2.56, 121.36, 35, 12.4, -650, null, 80, 0.02, 120, 4, 0.3, 140, 10, null, 0.01, null, 1000, 12] },
];

// headspace and ORP cases with values computed by hand (see the report for the arithmetic)
export const ORP_CASES = [
  // orp mV, T °C, electrode id, expected Eh (V) and pe; Eref = E25 + dE/dT (T - 25); pe = Eh F / (ln10 R T)
  { orp: -480, t: 30.5, el: 'agcl_3m', eh: -0.480 + (0.210 - 0.00073 * 5.5), pe: null },
  { orp: 135, t: 27.2, el: 'agcl_sat', eh: 0.135 + (0.197 - 0.00101 * 2.2), pe: null },
  { orp: 0, t: 25, el: 'she', eh: 0, pe: 0 },
];
export const HEADSPACE_CASES = [
  // gas, ppmv, Vgas mL, Vwater mL, T, P atm
  { gas: 'H2', ppmv: 1000, vg: 20, vw: 40, t: 25, p: 1 },
  { gas: 'CH4', ppmv: 5000, vg: 10, vw: 50, t: 15, p: 1 },
];

// ---------- Lab model scenarios ----------
export const LAB_CASES = [
  { id: 'L01', tests: 'Preset bawaan (200 °C, 300 bar, W/R 1, Fo90)', p: {} },
  { id: 'L02', tests: 'Suhu batas llnl.dat 300 °C, W/R rendah 0.2', p: { tempC: 300, wr: 0.2 } },
  { id: 'L03', tests: 'Suhu rendah 25 °C, W/R tinggi 50', p: { tempC: 25, wr: 50 } },
  { id: 'L04', tests: 'Fo100 (tanpa fayalit: tanpa Fe, tanpa magnetit dan H2)', p: { fo: 100 } },
  { id: 'L05', tests: 'Fo70 kaya Fe, DIC 5 mmol/kgw, kalsit dan talk aktif, tanpa fase gas', p: { fo: 70, dicMmol: 5, caMmol: 2, calcite: true, talc: true, gasPhase: false } },
  { id: 'L06', tests: 'NaCl 0, tanpa larutan padat Fe, antigorit', p: { naclMmol: 0, feSolidSolution: false, serpentine: 'Antigorite' } },
];
