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
interface RefRow { id: string; name: string; lat?: number; lon?: number; temp?: number; pH?: number; eh?: number; orp?: number; v: Record<string, number> }

export const SOURCES: RefSource[] = [
  { key: 'rempfert2017', cite: 'Rempfert K.R., Miller H.M., Bompard N., Nothaft D., Matter J.M., Kelemen P., Fierer N., Templeton A.S. (2017) Geological and geochemical controls on subsurface microbial life in the Samail Ophiolite, Oman. Frontiers in Microbiology 8:56.', doi: '10.3389/fmicb.2017.00056', table: 'Table 2 (chemistry), Table 1 (well locations, UTM 40Q, converted to WGS84)' },
  { key: 'cardace2015', cite: 'Cardace D., Meyer-Dombard D.R., Woycheese K.M., Arcilla C.A. (2015) Feasible metabolisms in high pH springs of the Philippines. Frontiers in Microbiology 6:10.', doi: '10.3389/fmicb.2015.00010', table: 'Table 2 (2012 expedition)' },
  { key: 'vuillemin2016', cite: 'Vuillemin A., Friese A., Alawi M., Henny C., Nomosatryo S., Wagner D., Crowe S.A., Kallmeyer J. (2016) Geomicrobiological features of ferruginous sediments from Lake Towuti, Indonesia. Frontiers in Microbiology 7:1007.', doi: '10.3389/fmicb.2016.01007', table: 'Table 1 (bottom waters, µM); lake position 2.75° S, 121.5° E from Russell et al. (2020) Palaeo3 556:109905' },
  { key: 'crowe2011', cite: 'Crowe S.A., Katsev S., Leslie K., Sturm A., Magen C., Nomosatryo S., Pack M.A., Kessler J.D., Reeburgh W.S., Roberts J.A., González L., Haffner G.D., Mucci A., Sundby B., Fowle D.A. (2011) The methane cycle in ferruginous Lake Matano. Geobiology 9, 61–78.', doi: '10.1111/j.1472-4669.2010.00257.x', table: 'Table 2 (pH, T, pCH4, pCO2 by depth); lake position 2°28′ S, 121°17′ E' },
  { key: 'ilham2017', cite: 'Ilham I., Hartono D.M., Suganda E., Nurdin M. (2017) Metal distribution at river water of mining and nickel industrial area in Pomalaa, Southeast Sulawesi Province, Indonesia. Oriental Journal of Chemistry 33(5).', doi: '10.13005/ojc/330557', table: 'Table 2 (2016 survey) and station coordinates' },
  { key: 'sanjaya2024', cite: 'Sanjaya I., Jamal, Fatturahkman M.L., Hermansyah, Arifin A.S., Maryanto S., Kim H.S. (2024) Evaluating the natural hydrogen system in Ampana Basin, Central Sulawesi; an implication for natural hydrogen exploration in Indonesia. Jurnal Geologi dan Sumberdaya Mineral 25(3), 135–149.', doi: '10.33332/jgsm.geologi.v25i3.896', table: 'Table 2 (gas composition, mol %, δ13C)' },
  { key: 'paukert2012', cite: 'Paukert A.N., Matter J.M., Kelemen P.B., Shock E.L., Havig J.R. (2012) Reaction path modeling of enhanced in situ CO2 mineralization for carbon sequestration in the peridotite of the Samail Ophiolite, Sultanate of Oman. Chemical Geology 330–331, 86–100.', doi: '10.1016/j.chemgeo.2012.08.013', table: 'Table 1 (field data, UTM WGS-84; zone not printed, 40N assumed and converted here) and Table 2 (major ions, mmol/L)' },
  { key: 'woycheese2015', cite: 'Woycheese K.M., Meyer-Dombard D.R., Cardace D., Argayosa A.M., Arcilla C.A. (2015) Out of the dark: transitional subsurface-to-surface microbial diversity in a terrestrial serpentinizing seep (Manleluag, Pangasinan, the Philippines). Frontiers in Microbiology 6:44.', doi: '10.3389/fmicb.2015.00044', table: 'Methods (site position N15°42′16″ E120°16′52″)' },
  { key: 'satyana2024', cite: 'Satyana A.H. (2024) Exploring natural hydrogen and abiotic methane in Indonesia: case and idea from Tanjung Api gas seeps, East Arm of Sulawesi – building a geologic hydrogen system in a collision zone. Proceedings, Indonesian Petroleum Association 48th Annual Convention & Exhibition.', doi: '', table: 'Table 1: Subroto et al. (2004, Buletin Geologi ITB 36(3), 117–124) and PSG & Lemigas (2023, unpublished)' },
  { key: 'aquino2022', cite: 'Aquino K.A., Früh-Green G.L., Rickli J., Bernasconi S.M., Lang S.Q., Lilley M.D., Butterfield D.A. (2022) Multi-stage evolution of the Lost City hydrothermal vent fluids. Geochimica et Cosmochimica Acta 332, 239–262.', doi: '10.1016/j.gca.2022.06.027', table: 'Table 2 (Mg, SO4, pH at 22 °C), Table 3 (H2, CH4), Table 1 (Beehive position)' },
];

// Oman: Samail ophiolite monitoring wells; mM; Eh in mV; DIC = total carbon
const om = (id: string, lat: number, lon: number, temp: number | undefined, pH: number, eh: number | undefined, v: Record<string, number>, kind: string): RefRow =>
  ({ id: 'OM-' + id, name: `${id} (${kind})`, lat, lon, temp, pH, eh, v });

// Oman springs (Paukert et al. 2012): mmol/L, ORP in mV; Fe is ICP-MS Fe
const PK_KIND: Record<string, string> = { S: 'spring outlet', G: 'shallow groundwater', F: 'surface water' };
const pk = (id: string, place: string, k: string, lat: number, lon: number, temp: number, pH: number, orp: number | undefined, v: Record<string, number>): RefRow =>
  ({ id: 'PK-' + id, name: `${id} ${place} (${PK_KIND[k]})`, lat, lon, temp, pH, orp, v });

// degrees-minutes-seconds to decimal degrees (south and west negative)
const dms = (d: number, m: number, s: number, neg = false) => (neg ? -1 : 1) * (d + m / 60 + s / 3600);
const MATANO: [number, number] = [-dms(2, 28, 0), dms(121, 17, 0)];
const MANLELUAG: [number, number] = [dms(15, 42, 16), dms(120, 16, 52)];
const TOWUTI: [number, number] = [-2.75, 121.5];
const mat = (depth: number, pH: number, temp: number): RefRow => ({ id: `MT-${depth}`, name: `Matano ${depth} m`, lat: MATANO[0], lon: MATANO[1], temp, pH, v: {} });
const pom = (n: number, river: string, lat: [number, number, number], lon: [number, number, number], pH: number, Fe: number, Cr: number, Ni: number): RefRow =>
  ({ id: `PO-St${n}`, name: `St.${n} ${river}`, lat: dms(...lat, true), lon: dms(...lon), pH, v: { Fe, Cr, Ni } });

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
    id: 'oman-springs', name: 'Samail ophiolite springs, Oman', country: 'OM', source: 'paukert2012', unit: 'mmol/L',
    setting: ['Hyperalkaline Ca-OH spring outlets (Type II) and, for contrast, Mg-HCO3 shallow groundwater and surface water (Type I) at 13 sites, January 2009 and 2010. Mixed spring/wadi waters and flow-path samples from the paper are not included.', '13 地点の高アルカリ Ca-OH 湧水口（Type II）と、比較用の Mg-HCO3 浅層地下水・表流水（Type I）、2009 年と 2010 年 1 月。論文中の混合水と流路沿い試料は含めていません。', 'Mulut mata air hiperalkalin Ca-OH (Tipe II) dan, sebagai pembanding, air tanah dangkal serta air permukaan Mg-HCO3 (Tipe I) di 13 lokasi, Januari 2009 dan 2010. Sampel campuran mata air/wadi dan sampel sepanjang aliran tidak dimasukkan.'],
    note: ['Coordinates: UTM from Table 1 converted assuming zone 40N (the zone is not printed; place names fit zone 40). Values printed as below detection are left out. DIC is entered as C(4); OH- from titration is not entered. No dissolved H2 or CH4 in this paper.', '座標：表 1 の UTM を 40N 帯と仮定して変換（帯番号は記載なし。地名は 40 帯に一致）。検出限界未満の値は除外。DIC は C(4) として入力。滴定 OH- は入力していません。この論文には溶存 H2・CH4 はありません。', 'Koordinat: UTM dari Tabel 1 dikonversi dengan asumsi zona 40N (zona tidak dicetak; nama tempat cocok dengan zona 40). Nilai di bawah batas deteksi tidak dimasukkan. DIC dimasukkan sebagai C(4); OH- hasil titrasi tidak dimasukkan. Makalah ini tidak memuat H2 atau CH4 terlarut.'],
    rows: [
      pk('OM10_01A', 'Misbit', 'S', 23.29092, 58.23205, 31.6, 11.20, -404, { Cl: 6.97, 'S(6)': 0.07, 'C(4)': 0.11, Ca: 2.12, Na: 6.54, K: 0.15, Mg: 0.0165, Si: 0.04, Fe: 5.19e-05 }),
      pk('OM10_02L', 'Falaij', 'S', 22.83784, 58.05680, 30.8, 11.52, -393, { Cl: 8.19, 'S(6)': 0.01, 'C(4)': 0.07, Ca: 1.83, Na: 9.63, K: 0.26, Mg: 0.0247, Fe: 4.83e-05 }),
      pk('OM10_03R', 'Falaij', 'S', 22.84261, 58.05806, 27.9, 11.63, -390, { Cl: 7.49, 'S(6)': 0.03, 'C(4)': 0.06, Ca: 1.67, Na: 8.14, K: 0.22, Mg: 0.037 }),
      pk('OM10_04S', 'Qafifah', 'S', 22.90444, 58.42467, 22.4, 11.76, -247, { Cl: 5.11, 'S(6)': 0.01, 'C(4)': 0.1, Ca: 1.75, Na: 6.55, K: 0.16, Mg: 0.0189, Fe: 4.17e-05 }),
      pk('OM10_04U', 'Qafifah', 'S', 22.90472, 58.42424, 24.9, 11.71, -611, { Cl: 4.78, 'S(6)': 0.01, 'C(4)': 0.12, Ca: 1.69, Na: 6.25, K: 0.14, Mg: 0.0189 }),
      pk('OM10_05AA', 'West of Al Bana', 'S', 23.29314, 56.87858, 28.5, 11.65, -324, { Cl: 11.38, 'S(6)': 0.01, 'C(4)': 0.04, Ca: 1.66, Na: 13.81, K: 0.31, Mg: 0.03, Fe: 3.76e-05 }),
      pk('OM10_05AD', 'West of Al Bana', 'S', 23.29447, 56.87618, 32.6, 11.68, -393, { Cl: 12.52, 'S(6)': 0.01, 'C(4)': 0.05, Ca: 2.11, Na: 16.78, K: 0.33, Mg: 0.0329, Fe: 3.94e-05 }),
      pk('OM10_05AF', 'West of Al Bana', 'S', 23.28896, 56.88218, 24.2, 11.90, -436, { Cl: 10.51, 'S(6)': 0.01, 'C(4)': 0.1, Ca: 1.57, Na: 13.82, K: 0.26, Mg: 0.0267, Fe: 0.00015 }),
      pk('OM10_07AJ', 'Shumayt', 'S', 23.40596, 56.86341, 33.4, 11.46, -231, { Cl: 5.28, 'C(4)': 0.05, Ca: 1.87, Na: 6.53, K: 0.15, Mg: 0.021, Fe: 3.58e-05 }),
      pk('OM10_08AM', 'Shumayt', 'S', 23.40588, 56.86338, 31.5, 11.53, -323, { Cl: 5.26, 'C(4)': 0.04, Ca: 1.85, Na: 6.45, K: 0.15, Mg: 0.0189 }),
      pk('OM10_09AT', 'Sudari', 'S', 23.96159, 56.44092, 30.4, 11.61, -292, { Cl: 5.91, 'S(6)': 0.01, 'C(4)': 0.04, Ca: 1.78, Na: 7.56, K: 0.17, Mg: 0.0193, Fe: 5.91e-05 }),
      pk('OM10_10AV', 'Uqaybah', 'S', 23.81470, 56.27571, 21.4, 11.61, -200, { Cl: 6.55, 'S(6)': 0.07, 'C(4)': 0.14, Ca: 2.56, Na: 4.28, K: 0.15, Mg: 0.00465 }),
      pk('OM09_W04F', 'Al Hilayw', 'S', 22.81452, 57.83680, 26.3, 11.59, -247, { Cl: 8.33, 'N(5)': 0.01, 'S(6)': 0.04, 'C(4)': 0.22, Ca: 1.4, Na: 11.08, K: 0.25, Mg: 0.00864, Si: 0.09, Fe: 8.42e-05 }),
      pk('OM09_W04G', 'Al Hilayw', 'S', 22.81466, 57.83682, 27.1, 11.60, -220, { Cl: 8.22, 'S(6)': 0.03, 'C(4)': 0.02, Ca: 1.31, Na: 10.91, K: 0.26, Mg: 0.00905, Si: 0.11, Fe: 4.01e-05 }),
      pk('OM09_W05L', 'Qafifah', 'S', 22.90476, 58.42423, 23.8, 11.64, -338, { Cl: 4.67, 'N(5)': 0.01, 'S(6)': 0.01, 'C(4)': 0.38, Ca: 1.66, Na: 6.19, K: 0.19, Mg: 0.065, Si: 0.06, Fe: 0.00174 }),
      pk('OM09_W06O', 'Dima', 'S', 22.98379, 58.59451, 30.3, 11.45, -369, { Cl: 6.73, 'S(6)': 0.01, 'C(4)': 0.16, Ca: 1.82, Na: 7.93, K: 0.23, Mg: 0.00724, Si: 0.04, Fe: 4.05e-05 }),
      pk('OM09_W13F', 'Shumayt', 'S', 23.40596, 56.86341, 28.1, 11.50, -495, { Cl: 4.96, 'S(6)': 0.01, 'C(4)': 0.2, Ca: 1.82, Na: 6.56, K: 0.16, Mg: 0.00715, Si: 0.06, Fe: 0.000104 }),
      pk('OM10_06AI', 'Al Bana', 'G', 23.28913, 56.89811, 29.0, 8.52, undefined, { Cl: 1.1, 'N(5)': 0.13, 'S(6)': 0.46, 'C(4)': 2.62, Ca: 0.38, Na: 0.75, K: 0.04, Mg: 1.7, Si: 0.24 }),
      pk('OM10_12AZ', 'Jabir', 'G', 23.34498, 58.00611, 34.1, 9.36, 94, { Cl: 2.05, 'N(5)': 0.09, 'S(6)': 0.89, 'C(4)': 1.42, Ca: 0.05, Na: 1.43, K: 0.07, Mg: 2.23 }),
      pk('OM10_13BA', 'Lizugh', 'G', 23.34459, 58.10446, 33.9, 7.77, 147, { Cl: 3.79, 'N(5)': 0.41, 'S(6)': 0.94, 'C(4)': 3.14, Ca: 0.7, Na: 3.34, K: 0.09, Mg: 2.49, Si: 0.41 }),
      pk('OM10_15BC', 'Trib. to Mansah', 'G', 23.37512, 58.14399, 34.5, 7.90, 120, { Cl: 4.53, 'N(5)': 0.29, 'S(6)': 0.8, 'C(4)': 2.32, Ca: 1.06, Na: 4.11, K: 0.06, Mg: 1.27, Si: 0.36 }),
      pk('OM09_W08S', 'Qafifah', 'G', 22.90431, 58.42545, 21.6, 8.99, undefined, { Cl: 1.88, 'N(5)': 0.05, 'S(6)': 0.28, 'C(4)': 1.9, Ca: 0.2, Na: 1.64, K: 0.03, Mg: 1.19, Si: 0.13, Fe: 5.01e-05 }),
      pk('OM10_01D', 'Misbit', 'F', 23.29281, 58.23456, 25.2, 8.35, 41, { Cl: 2.8, 'N(5)': 0.28, 'S(6)': 0.75, 'C(4)': 3.08, Ca: 0.84, Na: 3, K: 0.09, Mg: 1.7, Si: 0.39 }),
      pk('OM10_08AP', 'Shumayt', 'F', 23.40599, 56.86361, 27.0, 7.90, undefined, { Cl: 1.38, 'N(5)': 0.12, 'S(6)': 0.64, 'C(4)': 5.17, Ca: 0.57, Na: 1.06, K: 0.1, Mg: 2.9, Si: 0.35 }),
      pk('OM10_09AR', 'Sudari', 'F', 23.96199, 56.44032, 21.5, 8.76, 211, { Cl: 4.9, 'N(5)': 0.01, 'S(6)': 0.5, 'C(4)': 3.04, Ca: 0.45, Na: 4.94, K: 0.12, Mg: 1.67, Si: 0.1, Fe: 2.51e-05 }),
      pk('OM09_W06P', 'Dima', 'F', 22.98374, 58.59439, 20.2, 8.12, 182, { Cl: 5.14, 'S(6)': 0.32, 'C(4)': 3.46, Ca: 0.49, Na: 4.51, K: 0.11, Mg: 1.99, Si: 0.18, Fe: 0.000466 }),
      pk('OM09_W12B', 'Sudari', 'F', 23.96196, 56.44031, 17.1, 8.16, 187, { Cl: 8.61, 'S(6)': 0.68, 'C(4)': 3.14, Ca: 0.48, Na: 8.73, K: 0.16, Mg: 1.69, Si: 0.2, Fe: 0.000591 }),
    ],
  },
  {
    id: 'philippines', name: 'Zambales & Palawan, Philippines', country: 'PH', source: 'cardace2015', unit: 'mg/L',
    setting: ['Springs and a well in the Zambales and Palawan ophiolites (2012 expedition). ORP in mV as reported. Only Manleluag has a published position (Woycheese et al. 2015, Front. Microbiol. 6:44, doi:10.3389/fmicb.2015.00044: N15°42′16″ E120°16′52″); no coordinates were found for Poon Bato, Bigbiga, San Isidro or Mainit, so they are not on the map.', 'Zambales と Palawan オフィオライトの湧水と井戸（2012 年調査）。ORP は報告値（mV）。公表位置があるのは Manleluag のみ（Woycheese ほか 2015、N15°42′16″ E120°16′52″）。Poon Bato、Bigbiga、San Isidro、Mainit の座標は見つからず、地図に表示しません。', 'Mata air dan sumur di ofiolit Zambales dan Palawan (ekspedisi 2012). ORP dalam mV sesuai laporan. Hanya Manleluag yang posisinya terbit (Woycheese dkk. 2015, N15°42′16″ E120°16′52″); koordinat Poon Bato, Bigbiga, San Isidro, dan Mainit tidak ditemukan, sehingga tidak tampil di peta.'],
    note: ['Mg reported as 0 ppm is treated as below detection.', 'Mg 0 ppm は検出限界未満として扱います。', 'Mg yang dilaporkan 0 ppm dianggap di bawah batas deteksi.'],
    rows: [
      { id: 'PH-ML1', name: 'Manleluag 1 (ML1)', lat: MANLELUAG[0], lon: MANLELUAG[1], temp: 34.4, pH: 10.9, orp: -703, v: { Cl: 18, 'S(6)': 0.7, Na: 23, K: 0.2, Ca: 3.1 } },
      { id: 'PH-ML2', name: 'Manleluag 2 (ML2)', lat: MANLELUAG[0], lon: MANLELUAG[1], temp: 34.3, pH: 10.8, orp: -355, v: { Cl: 18.7, 'S(6)': 0.7, Na: 24.4, K: 0.2, Ca: 3.9 } },
      { id: 'PH-ML3', name: 'Manleluag 3 (ML3)', lat: MANLELUAG[0], lon: MANLELUAG[1], temp: 33.8, pH: 10.8, orp: -245, v: { Cl: 17, 'S(6)': 0.8, Na: 22.6, K: 0.2, Mg: 0.1, Ca: 3.3 } },
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
  {
    id: 'towuti', name: 'Lake Towuti, Sulawesi', country: 'ID', source: 'vuillemin2016', unit: 'umol/L',
    setting: ['Ferruginous lake in the East Sulawesi Ophiolite (Malili lakes, Sorowako). Mg-HCO3 (Type I-like) water from a peridotite and laterite catchment; anoxic below ~130 m.', '東スラウェシオフィオライト内の鉄に富む湖（マリリ湖群、ソロワコ）。かんらん岩とラテライトの集水域からの Mg-HCO3（Type I 型）水。約 130 m 以深は無酸素。', 'Danau ferruginus di Ofiolit Sulawesi Timur (danau Malili, Sorowako). Air Mg-HCO3 (mirip Tipe I) dari daerah tangkapan peridotit dan laterit; anoksik di bawah ±130 m.'],
    note: ['Water directly above the sediment at three sites. pH and DIC were not reported with these samples (lake water pH 7.3–7.8, 28–31 °C; Costa et al. 2015). The marker is the lake centre, not the core sites.', '3 地点の堆積物直上水。これらの試料の pH と DIC は未報告（湖水 pH 7.3–7.8、28–31 °C；Costa et al. 2015）。地図の位置は湖の中心で、コア地点ではありません。', 'Air tepat di atas sedimen di tiga lokasi. pH dan DIC tidak dilaporkan untuk sampel ini (air danau pH 7.3–7.8, 28–31 °C; Costa dkk. 2015). Penanda peta adalah pusat danau, bukan lokasi core.'],
    rows: [
      { id: 'TW-60', name: 'Towuti bottom water, 60 m', lat: TOWUTI[0], lon: TOWUTI[1], v: { Ca: 28.6, Mg: 145.4, Cl: 37.3, 'S(6)': 20.2 } },
      { id: 'TW-153', name: 'Towuti bottom water, 153 m', lat: TOWUTI[0], lon: TOWUTI[1], v: { Ca: 25.3, Mg: 134.8, Cl: 38.4, 'S(6)': 11.9, 'N(-3)': 20.3 } },
      { id: 'TW-200', name: 'Towuti bottom water, 200 m', lat: TOWUTI[0], lon: TOWUTI[1], v: { Ca: 23.8, Mg: 148.7, Cl: 20.5, 'S(6)': 11.8, 'N(-3)': 13.8 } },
    ],
  },
  {
    id: 'matano', name: 'Lake Matano, Sulawesi', country: 'ID', source: 'crowe2011', unit: 'mmol/L',
    setting: ['Ferruginous, 590 m deep lake with an ultramafic catchment at Sorowako; anoxic and methane-rich below ~110 m. Profile in the anoxic water column (2006–2007).', 'ソロワコの超苦鉄質集水域をもつ水深 590 m の鉄に富む湖。約 110 m 以深は無酸素でメタンに富む。無酸素水柱のプロファイル（2006–2007 年）。', 'Danau ferruginus sedalam 590 m dengan daerah tangkapan ultramafik di Sorowako; anoksik dan kaya metana di bawah ±110 m. Profil kolom air anoksik (2006–2007).'],
    note: ['Only pH and temperature are listed per depth; the paper gives CH4 as partial pressure (0.44–1.00 atm), up to 1.4 mmol/L in bottom water. Fe(II) reaches 140 µmol/L below 300 m (Crowe et al. 2008). See tutorial Example 10.', '深度ごとの値は pH と温度のみ。CH4 は分圧（0.44–1.00 atm）で示され、底層水で最大 1.4 mmol/L。Fe(II) は 300 m 以深で 140 µmol/L（Crowe et al. 2008）。チュートリアルの例 10 を参照。', 'Per kedalaman hanya pH dan suhu; makalah memberi CH4 sebagai tekanan parsial (0.44–1.00 atm), sampai 1.4 mmol/L di air dasar. Fe(II) mencapai 140 µmol/L di bawah 300 m (Crowe dkk. 2008). Lihat Contoh 10 di tutorial.'],
    rows: [mat(140, 7.00, 26.42), mat(160, 7.04, 26.11), mat(180, 6.93, 25.89), mat(200, 6.95, 25.74), mat(250, 6.98, 25.58), mat(350, 6.92, 25.49), mat(450, 6.96, 25.48), mat(550, 7.04, 25.47)],
  },
  {
    id: 'pomalaa', name: 'Pomalaa rivers, Southeast Sulawesi', country: 'ID', source: 'ilham2017', unit: 'mg/L',
    setting: ['Rivers draining laterite nickel mines and a ferronickel smelter on ultramafic rocks, Kolaka (2016). Metals only: the paper gives no major ions or temperature.', 'コラカの超苦鉄質岩上のラテライトニッケル鉱山とフェロニッケル製錬所を流れる河川（2016 年）。金属のみで、主要イオンと温度は報告されていません。', 'Sungai yang mengalir dari tambang nikel laterit dan smelter feronikel di batuan ultramafik, Kolaka (2016). Hanya logam: makalah tidak memuat ion utama atau suhu.'],
    note: ['Cr(VI) is reported above total Cr at St.6 and St.7, which cannot be right; check those stations before use.', 'St.6 と St.7 では Cr(VI) が全 Cr を上回って報告されており、矛盾しています。使用前に確認してください。', 'Cr(VI) dilaporkan lebih besar daripada Cr total di St.6 dan St.7, yang tidak mungkin; periksa kedua stasiun itu sebelum dipakai.'],
    rows: [
      pom(1, 'Baula', [4, 9, 33.6], [121, 41, 3.8], 7.84, 0.16, 0.0026, 0.0086),
      pom(2, 'Huko-huko', [4, 10, 29.0], [121, 38, 57.8], 7.98, 0.54, 0.0088, 0.0296),
      pom(3, 'Pesouha', [4, 10, 38.6], [121, 38, 34.4], 7.99, 0.4, 0.0025, 0.0128),
      pom(4, 'Kumoro', [4, 11, 43.9], [121, 35, 58.0], 7.06, 0.15, 0.0038, 0.0136),
      pom(5, 'Sopura', [4, 16, 1.2], [121, 33, 51.2], 7.23, 1.7, 0.0192, 0.0368),
      pom(6, 'Oko-oko', [4, 17, 41.9], [121, 33, 35.1], 7.11, 0.36, 0.0106, 0.031),
      pom(7, 'Puuroda estuary', [4, 8, 25.1], [121, 37, 4.8], 6.79, 0.22, 0.0029, 0.0012),
    ],
  },
];

// Free-gas seeps. Values in mol % as reported; air-free values are derived on load.
export interface GasRow { id: string; name: string; kind: [string, string, string]; O2: number; N2: number; CO2: number; H2: number; CH4: number; C2: number; C3: number; d13C1?: number; d13C1Alt?: number }
export interface GasSite { id: string; name: string; source: string; also?: string[]; lat?: number; lon?: number; setting: [string, string, string]; note?: [string, string, string]; rows: GasRow[] }
const SEEP: [string, string, string] = ['gas seep', 'ガス湧出', 'rembesan gas'];
const SPRING: [string, string, string] = ['thermal spring', '温泉', 'mata air panas'];
export const GAS_SITES: GasSite[] = [{
  id: 'tanjungapi', name: 'Tanjung Api & Pulodalagan, Ampana, Sulawesi', source: 'sanjaya2024', also: ['satyana2024'], lat: -0.8129, lon: 121.6222,
  setting: ['Burning gas seeps along ~650 m of coast at the fault contact of serpentinized harzburgite (East Sulawesi Ophiolite) with Quaternary limestone; Pulodalagan is an alkaline (pH 9, 38 °C) thermal spring with travertine. Sampled July 2023.', '蛇紋岩化したハルツバージャイト（東スラウェシオフィオライト）と第四紀石灰岩の断層境界、約 650 m の海岸に沿って燃えるガス湧出。Pulodalagan はトラバーチンを伴うアルカリ性（pH 9、38 °C）温泉。2023 年 7 月採取。', 'Rembesan gas menyala sepanjang ±650 m pantai pada kontak sesar harzburgit terserpentinisasi (Ofiolit Sulawesi Timur) dengan batugamping Kuarter; Pulodalagan adalah mata air panas alkalin (pH 9, 38 °C) dengan travertin. Disampel Juli 2023.'],
  note: ['Air-free: N2 from air = O2 × 78.08/20.95, then renormalised without O2 and air N2 (Ar ignored). The papers give no sample coordinates; the map marker is the Tanjung Api landmark (Wikipedia), not a sample position. The 2023 compositions are the same PSG–Lemigas analyses in Sanjaya et al. (2024) and Satyana (2024), but δ13C-CH4 differs: Sanjaya Table 2 gives −15.2 and −12.3 ‰ (column δ13C), Satyana Table 1 gives −48.5 to −41.1 ‰ (second value, Lemigas GC-IRMS). Satyana lists 23ML06 as a gas seep and gives C3 0.06 % for 23IDS02B (Sanjaya: 0). The δ13C column shows Sanjaya / Satyana. The 2004 row (Subroto et al., via Satyana Table 1) also has 0.03 % C4+, δ13C −18.7/−18.5 ‰ and δD-CH4 −101/−106 ‰ (duplicate runs).', '空気補正：空気由来 N2 = O2 × 78.08/20.95 とし、O2 と空気由来 N2 を除いて再規格化（Ar は無視）。論文に試料座標はなく、地図の位置は Tanjung Api のランドマーク（Wikipedia）です。2023 年の組成は Sanjaya ほか（2024）と Satyana（2024）で同じ PSG–Lemigas 分析ですが、δ13C-CH4 が異なります：Sanjaya の表 2 は −15.2・−12.3 ‰、Satyana の表 1 は −48.5〜−41.1 ‰（2 番目の値、Lemigas GC-IRMS）。Satyana は 23ML06 をガス湧出とし、23IDS02B の C3 を 0.06 %（Sanjaya は 0）としています。δ13C 欄は Sanjaya / Satyana の順。2004 年の行（Subroto ほか、Satyana 表 1 経由）は C4+ 0.03 %、δ13C −18.7/−18.5 ‰、δD-CH4 −101/−106 ‰（重複測定）。', 'Bebas udara: N2 dari udara = O2 × 78.08/20.95, lalu dinormalisasi tanpa O2 dan N2 udara (Ar diabaikan). Makalah tidak memberi koordinat sampel; penanda peta adalah titik Tanjung Api (Wikipedia), bukan posisi sampel. Komposisi 2023 adalah analisis PSG–Lemigas yang sama di Sanjaya dkk. (2024) dan Satyana (2024), tetapi δ13C-CH4 berbeda: Tabel 2 Sanjaya memberi −15,2 dan −12,3 ‰, Tabel 1 Satyana memberi −48,5 s.d. −41,1 ‰ (nilai kedua, GC-IRMS Lemigas). Satyana mencatat 23ML06 sebagai rembesan gas dan memberi C3 0,06 % untuk 23IDS02B (Sanjaya: 0). Kolom δ13C menampilkan Sanjaya / Satyana. Baris 2004 (Subroto dkk., melalui Tabel 1 Satyana) juga memiliki C4+ 0,03 %, δ13C −18,7/−18,5 ‰ dan δD-CH4 −101/−106 ‰ (analisis duplikat).'],
  rows: [
    { id: '23IDS02', name: 'Tanjung Api 23IDS02', kind: SEEP, O2: 6.57, N2: 26.28, CO2: 0.03, H2: 35.04, CH4: 32.02, C2: 0.06, C3: 0, d13C1: -15.2, d13C1Alt: -48.5 },
    { id: '23IDS02B', name: 'Tanjung Api 23IDS02B', kind: SEEP, O2: 3.03, N2: 13.82, CO2: 0.03, H2: 35.56, CH4: 47, C2: 0.5, C3: 0, d13C1Alt: -42.3 },
    { id: '23IDS03', name: 'Tanjung Api 23IDS03', kind: SEEP, O2: 5.85, N2: 24.21, CO2: 0.04, H2: 30.81, CH4: 38.74, C2: 0.3, C3: 0.05, d13C1Alt: -45.4 },
    { id: '23IDS04', name: 'Tanjung Api 23IDS04', kind: SEEP, O2: 6.41, N2: 26.79, CO2: 0.03, H2: 25.86, CH4: 40.57, C2: 0.3, C3: 0.04, d13C1Alt: -42.6 },
    { id: '23IDS06', name: 'Tanjung Api 23IDS06', kind: SEEP, O2: 7.42, N2: 29.6, CO2: 0.03, H2: 20.01, CH4: 42.4, C2: 0.49, C3: 0.05, d13C1Alt: -44.1 },
    { id: '23ML06', name: 'Pulodalagan 23ML06', kind: SPRING, O2: 5.64, N2: 46.88, CO2: 0.02, H2: 0, CH4: 46.86, C2: 0.6, C3: 0, d13C1: -12.3, d13C1Alt: -41.1 },
    { id: 'S2004', name: 'Tanjung Api (Subroto et al. 2004)', kind: SEEP, O2: 7.3, N2: 23.1, CO2: 0, H2: 16.3, CH4: 52.2, C2: 0.82, C3: 0.1, d13C1: -18.5 },
  ],
}];

/** Air correction of a free-gas analysis: removes O2 and the N2 that came with it, renormalises to 100 %. */
export function airFree(g: GasRow) {
  const n2air = g.O2 * 78.08 / 20.95, n2x = Math.max(g.N2 - n2air, 0);
  const sum = g.H2 + g.CH4 + g.C2 + g.C3 + g.CO2 + n2x;
  const f = (x: number) => (sum > 0 ? (100 * x) / sum : NaN);
  return { H2: f(g.H2), CH4: f(g.CH4), C2: f(g.C2), CO2: f(g.CO2), N2x: f(n2x), H2_CH4: g.CH4 > 0 ? g.H2 / g.CH4 : NaN };
}

/** Gas sites as map points (no water chemistry; the H2 colour scale does not apply). */
export const gasMapPoints = (): FieldSample[] => GAS_SITES.filter(g => g.lat != null && g.lon != null)
  .map(g => ({ id: 'GAS-' + g.id, name: g.name + ' (gas)', lat: g.lat, lon: g.lon, conc: {}, group: g.name, ref: g.source }));

export function siteSamples(site: RefSite): FieldSample[] {
  return site.rows.map(r => ({
    id: r.id, name: r.name, lat: r.lat, lon: r.lon, temp: r.temp, pH: r.pH, eh: r.eh, orp: r.orp,
    // mass concentrations of sulfate are reported as SO4
    conc: Object.fromEntries(Object.entries(r.v).map(([k, val]) => [k, toMmol(val, k, k === 'S(6)' && /g\/L/.test(site.unit) ? 'as SO4' : '', site.unit)])),
    group: site.name, ref: site.source,
  }));
}
export const allReferenceSamples = (): FieldSample[] => SITES.flatMap(siteSamples);
