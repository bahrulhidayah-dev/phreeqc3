// Reference library: published analyses of fluids from serpentinizing systems.
// Values are transcribed from the tables of the cited papers in their original units and
// converted to mmol/L when loaded. "Below detection" and unreported values are left out.
import { toMmol, type FieldSample } from './field.ts';

export interface RefSource { key: string; cite: string; doi: string; table: string }
export interface RefSite {
  id: string; name: string; country: string; source: string; unit: string;
  setting: [string, string, string];   // en, ja, id
  note?: [string, string, string];
  rows: RefRow[];
}
interface RefRow { id: string; name: string; lat?: number; lon?: number; temp?: number; pH: number; eh?: number; orp?: number; v: Record<string, number> }

export const SOURCES: RefSource[] = [
  { key: 'rempfert2017', cite: 'Rempfert K.R., Miller H.M., Bompard N., Nothaft D., Matter J.M., Kelemen P., Fierer N., Templeton A.S. (2017) Geological and geochemical controls on subsurface microbial life in the Samail Ophiolite, Oman. Frontiers in Microbiology 8:56.', doi: '10.3389/fmicb.2017.00056', table: 'Table 2 (chemistry), Table 1 (well locations, UTM 40Q, converted to WGS84)' },
  { key: 'cardace2015', cite: 'Cardace D., Meyer-Dombard D.R., Woycheese K.M., Arcilla C.A. (2015) Feasible metabolisms in high pH springs of the Philippines. Frontiers in Microbiology 6:10.', doi: '10.3389/fmicb.2015.00010', table: 'Table 2 (2012 expedition)' },
  { key: 'aquino2022', cite: 'Aquino K.A., Früh-Green G.L., Rickli J., Bernasconi S.M., Lang S.Q., Lilley M.D., Butterfield D.A. (2022) Multi-stage evolution of the Lost City hydrothermal vent fluids. Geochimica et Cosmochimica Acta 332, 239–262.', doi: '10.1016/j.gca.2022.06.027', table: 'Table 2 (Mg, SO4, pH at 22 °C), Table 3 (H2, CH4), Table 1 (Beehive position)' },
];

// Oman: Samail ophiolite monitoring wells; mM; Eh in mV; DIC = total carbon
const om = (id: string, lat: number, lon: number, temp: number | undefined, pH: number, eh: number | undefined, v: Record<string, number>, kind: string): RefRow =>
  ({ id: 'OM-' + id, name: `${id} (${kind})`, lat, lon, temp, pH, eh, v });

export const SITES: RefSite[] = [
  {
    id: 'oman', name: 'Samail ophiolite, Oman', country: 'OM', source: 'rempfert2017', unit: 'mmol/L',
    setting: ['Groundwater wells in peridotite, gabbro and at their contact; hyperalkaline (Type II-like) and alkaline (Type I-like) fluids', '橄欖岩・斑れい岩およびその境界の地下水井戸。高アルカリ（Type II 型）とアルカリ（Type I 型）の流体', 'Sumur air tanah di peridotit, gabro, dan zona kontaknya; fluida hiperalkalin (mirip Tipe II) dan alkalin (mirip Tipe I)'],
    rows: [
      om('NSHQ3B 2015', 22.9264, 58.4147, 30.1, 8.4, 158, { Ca: 0.303, Mg: 1.66, Na: 0.626, Si: 0.247, Cl: 0.88, 'S(6)': 0.28, 'C(4)': 2.5 }, 'alkaline peridotite'),
      om('NSHQ14 2014', 22.8661, 58.7106, 34.9, 11.4, -32, { Ca: 3.69, Mg: 0.005, Na: 12.1, Si: 0.007, Cl: 16.6, 'S(6)': 0.08, H2: 0.67, CH4: 0.17 }, 'hyperalkaline peridotite'),
      om('NSHQ14 2015', 22.8661, 58.7106, 35.3, 11.3, -307, { Ca: 3.42, Mg: 0.001, Na: 11.2, Si: 0.005, Cl: 16.6, 'S(6)': 0.15, 'C(4)': 0.19, H2: 2.9, CH4: 0.12 }, 'hyperalkaline peridotite'),
      om('NSHQ14 2016', 22.8661, 58.7106, 35.8, 11.2, -252, { Ca: 3.78, Mg: 0.002, Na: 9.39, Si: 0.005, Cl: 15.8, 'S(6)': 0.09, H2: 0.22, CH4: 0.05 }, 'hyperalkaline peridotite'),
      om('WAB56 2015', 22.6161, 58.3121, 35.1, 10.6, -251, { Ca: 0.43, Na: 3.07, Si: 0.198, Cl: 3.2, 'S(6)': 0.02, 'C(4)': 0.22, CH4: 0.01 }, 'hyperalkaline peridotite'),
      om('WAB71 2015', 22.9052, 58.6607, 33.1, 11.0, -126, { Ca: 3.82, Mg: 0.001, Na: 5.61, Si: 0.017, Cl: 12.5, 'S(6)': 0.03, 'C(4)': 0.21, CH4: 0.02 }, 'hyperalkaline peridotite'),
      om('WAB71 2016', 22.9052, 58.6607, 34.5, 11.1, -86, { Ca: 3.78, Mg: 0.001, Na: 5.2, Si: 0.024, Cl: 12.9, 'S(6)': 0.05, CH4: 0.02 }, 'hyperalkaline peridotite'),
      om('WAB104 2016', 22.9722, 58.396, 33.4, 8.5, 180, { Ca: 0.115, Mg: 1.89, Na: 0.661, Si: 0.21, Cl: 0.75, 'S(6)': 0.5 }, 'alkaline peridotite'),
      om('WAB105 2016', 22.9305, 58.4109, 31.6, 8.3, 178, { Ca: 0.254, Mg: 1.58, Na: 0.591, Si: 0.043, Cl: 0.77, 'S(6)': 0.29 }, 'alkaline peridotite'),
      om('NSHQ4 2014', 22.8845, 58.6667, 33.3, 10.6, -103, { Ca: 5.16, Mg: 0.62, Na: 6.75, Si: 0.01, Cl: 14.6, 'S(6)': 0.22, H2: 0.18, CH4: 1.4 }, 'contact'),
      om('NSHQ4 2015', 22.8845, 58.6667, 33.3, 10.5, -342, { Ca: 4.13, Mg: 0.003, Na: 8.09, Si: 0.015, Cl: 18.2, 'S(6)': 0.36, 'C(4)': 0.18, CH4: 2.3 }, 'contact'),
      om('WAB55 2015', 22.6566, 58.3118, 30, 9.3, 78, { Ca: 0.074, Mg: 3.14, Na: 3.48, Si: 0.006, Cl: 14.8, 'S(6)': 3.9, 'C(4)': 2.6 }, 'contact'),
      om('WAB188 2015', 22.8673, 58.668, 34.2, 8.7, -220, { Ca: 0.717, Mg: 1.52, Na: 2.51, Si: 0.232, Cl: 3.6, 'S(6)': 0.59, 'C(4)': 2.3, CH4: 0.04 }, 'contact'),
      om('NSHQ21 2015', 22.6838, 58.3003, 33.7, 7.4, 172, { Ca: 1.88, Mg: 2.46, Na: 17.7, Si: 0.782, Cl: 6.2, 'S(6)': 0.78, 'C(4)': 2.6 }, 'gabbro'),
      om('WAB103 2015', 22.8745, 58.4483, 30.4, 8.2, 130, { Ca: 0.419, Mg: 0.236, Na: 11.9, Si: 0.48, Cl: 7.6, 'S(6)': 1.7, 'C(4)': 2.3 }, 'gabbro'),
    ],
  },
  {
    id: 'philippines', name: 'Zambales & Palawan, Philippines', country: 'PH', source: 'cardace2015', unit: 'mg/L',
    setting: ['Springs and a well in the Zambales and Palawan ophiolites (2012 expedition). ORP in mV as reported; the paper gives no coordinates.', 'Zambales と Palawan オフィオライトの湧水と井戸（2012 年調査）。ORP は報告値（mV）。論文に座標はありません。', 'Mata air dan sumur di ofiolit Zambales dan Palawan (ekspedisi 2012). ORP dalam mV sesuai laporan; makalah tidak memuat koordinat.'],
    note: ['Mg reported as 0 ppm is treated as below detection.', 'Mg 0 ppm は検出限界未満として扱います。', 'Mg yang dilaporkan 0 ppm dianggap di bawah batas deteksi.'],
    rows: [
      { id: 'PH-ML1', name: 'Manleluag 1 (ML1)', temp: 34.4, pH: 10.9, orp: -703, v: { Cl: 18, 'S(6)': 0.7, Na: 23, K: 0.2, Ca: 3.1 } },
      { id: 'PH-ML2', name: 'Manleluag 2 (ML2)', temp: 34.3, pH: 10.8, orp: -355, v: { Cl: 18.7, 'S(6)': 0.7, Na: 24.4, K: 0.2, Ca: 3.9 } },
      { id: 'PH-ML3', name: 'Manleluag 3 (ML3)', temp: 33.8, pH: 10.8, orp: -245, v: { Cl: 17, 'S(6)': 0.8, Na: 22.6, K: 0.2, Mg: 0.1, Ca: 3.3 } },
      { id: 'PH-BB1', name: 'Bigbiga well (BB1)', temp: 29.7, pH: 9.3, orp: -146, v: { Cl: 4.4, 'S(6)': 47.3, Na: 100.5, K: 0.5, Ca: 1.5 } },
      { id: 'PH-PB1', name: 'Poon Bato 1 (PB1)', temp: 31.5, pH: 11.3, orp: -136, v: { Cl: 24, 'S(6)': 0.1, Na: 23.9, K: 1.3, Ca: 52.8 } },
      { id: 'PH-PB2', name: 'Poon Bato 2, star pool (PB2)', temp: 27.2, pH: 9.2, orp: -86, v: { Cl: 11.3, 'S(6)': 0.1, Na: 10.3, K: 0.6, Mg: 7.6, Ca: 8 } },
      { id: 'PH-PB3', name: 'Poon Bato 3 (PB3)', temp: 28.6, pH: 11.3, orp: -373, v: { Cl: 17.9, Na: 15.6, K: 0.8, Mg: 0.2, Ca: 50.2 } },
      { id: 'PH-SI1', name: 'San Isidro spring, Palawan (SI1)', temp: 47.7, pH: 10.5, orp: -265, v: { Cl: 57.4, 'S(6)': 3.9, Na: 91.6, K: 0.7, Ca: 3.6 } },
      { id: 'PH-MF1', name: 'Mainit Falls, Palawan (MF1)', temp: 40.6, pH: 9.7, orp: -287, v: { Cl: 228.7, 'S(6)': 9.7, Na: 269.7, K: 4.5, Ca: 2.5 } },
    ],
  },
  {
    id: 'lostcity', name: 'Lost City, Mid-Atlantic Ridge', country: '—', source: 'aquino2022', unit: 'mmol/L',
    setting: ['Submarine carbonate chimneys on the Atlantis Massif, 30° N; measured vent fluids (partly mixed with seawater)', 'Atlantis Massif（北緯 30°）の海底炭酸塩チムニー。実測の噴出流体（一部海水と混合）', 'Cerobong karbonat bawah laut di Atlantis Massif, 30° LU; fluida ventilasi terukur (sebagian bercampur air laut)'],
    note: ['pH was measured on deck at 22 °C, so the temperature is set to 22 °C; the vent temperature is given in the name. Mg, SO4 in mmol/kg (Table 2), H2 and CH4 from the gas-tight samples (Table 3).',
      'pH は船上 22 °C で測定されたため温度は 22 °C としています。噴出温度は名前に記載。Mg・SO4 は mmol/kg（Table 2）、H2・CH4 は gas-tight 試料（Table 3）。',
      'pH diukur di kapal pada 22 °C, jadi suhu diatur 22 °C; suhu ventilasi tertera di nama. Mg, SO4 dalam mmol/kg (Tabel 2), H2 dan CH4 dari sampel gas-tight (Tabel 3).'],
    rows: [
      { id: 'LC-BH', name: 'Beehive (vent 95.7 °C)', lat: 30.1239, lon: -42.12, temp: 22, pH: 10.8, v: { Mg: 0.1, 'S(6)': 3.4, H2: 9.4, CH4: 1.1 } },
      { id: 'LC-MC', name: 'Marker C (vent 79.7 °C)', lat: 30.1239, lon: -42.12, temp: 22, pH: 10.1, v: { Mg: 5.9, 'S(6)': 5.6, H2: 6.9, CH4: 1.0 } },
      { id: 'LC-CH', name: 'Camel Humps (vent 85.0 °C)', lat: 30.1239, lon: -42.12, temp: 22, pH: 9.0, v: { Mg: 26.6, 'S(6)': 14.7, H2: 2.0, CH4: 0.2 } },
      { id: 'LC-SO', name: 'Sombrero (vent 61.6 °C)', lat: 30.1239, lon: -42.12, temp: 22, pH: 9.1, v: { Mg: 25.7, 'S(6)': 14.3, H2: 1.1, CH4: 0.2 } },
    ],
  },
];

export function siteSamples(site: RefSite): FieldSample[] {
  return site.rows.map(r => ({
    id: r.id, name: r.name, lat: r.lat, lon: r.lon, temp: r.temp, pH: r.pH, eh: r.eh, orp: r.orp,
    // mass concentrations of sulfate are reported as SO4
    conc: Object.fromEntries(Object.entries(r.v).map(([k, val]) => [k, toMmol(val, k, k === 'S(6)' && /g\/L/.test(site.unit) ? 'as SO4' : '', site.unit)])),
    group: site.name, ref: site.source,
  }));
}
export const allReferenceSamples = (): FieldSample[] => SITES.flatMap(siteSamples);
