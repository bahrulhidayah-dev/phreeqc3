// Stage 3: MgO–SiO2–H2O activity diagram, Type I vs Type II waters, log fH2 vs temperature.
import { useMemo, useState } from 'react';
import type { TFn } from '../../lib/i18n';
import type { STFn } from '../../lib/serp/i18n';
import type { ThemeColors } from '../Chart';
import { BAR_TO_ATM, scenarios, sweepInput, type SerpParams } from '../../lib/serp/model';
import { activityDiagram, fh2Input, logKInput, MG_MINERALS, records, SILICA, type MgMineral } from '../../lib/serp/thermo';
import { runLab } from '../../lib/serp/engine';
import type { FieldSample } from '../../lib/serp/field';
import { SITES, siteSamples } from '../../lib/serp/reference';
import { Plot, type PPoly, type PSeries } from './Plot';
import { NumField, num } from './common';
import type { Speciation } from './speciation';
import { parseList } from './Sweep';

export const MINERAL_COLOR: Record<string, string> = {
  Brucite: '#2F6FB0', Chrysotile: '#0C7480', Antigorite: '#2E7D4F', Talc: '#B8671F', Forsterite: '#7B3FA0', Enstatite: '#B03A3A',
};
export const GROUP_COLORS = ['#2F6FB0', '#B8671F', '#7B3FA0', '#2E7D4F', '#B03A3A', '#9A6A00', '#C2589A', '#5A6B73'];
const FIELD_COLOR = '#14232B';

interface Props { t: TFn; st: STFn; colors: ThemeColors; params: SerpParams; field: FieldSample[]; spec: Speciation; toast: (m: string) => void }
type Sub = 'activity' | 'types' | 'fh2';

export function Diagrams({ st, colors, params, field, spec, toast }: Props) {
  const [sub, setSub] = useState<Sub>('activity');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="tabs" role="tablist">
        {([['activity', st('d_activity')], ['types', st('d_types')], ['fh2', st('d_fh2')]] as [Sub, string][]).map(([id, l]) =>
          <button key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}>{l}</button>)}
      </div>
      {sub === 'activity' && <Activity st={st} colors={colors} params={params} field={field} spec={spec} toast={toast} />}
      {sub === 'types' && <Types st={st} colors={colors} field={field} toast={toast} />}
      {sub === 'fh2' && <FH2 st={st} colors={colors} params={params} field={field} spec={spec} toast={toast} />}
    </div>
  );
}

function SamplesButton({ st, field, spec }: { st: STFn; field: FieldSample[]; spec: Speciation }) {
  if (!field.length) return <span className="note">{st('d_need_field')}</span>;
  return <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
    <button className="btn sm" type="button" disabled={spec.busy} onClick={spec.run}>{spec.busy ? st('running') : st('d_speciate')}</button>
    {spec.rows && <span className="note">✓ {st('fd_n', { n: spec.rows.filter(Boolean).length })}</span>}
  </span>;
}

function Activity({ st, colors, params, field, spec, toast }: Omit<Props, 't'>) {
  const [T, setT] = useState(25);
  const [P, setP] = useState(params.pressureBar);
  const [mins, setMins] = useState<MgMineral[]>(['Brucite', 'Chrysotile', 'Talc', 'Forsterite']);
  const [yr, setYr] = useState<[number, number]>([-10, -1]);
  const [K, setK] = useState<{ T: number; P: number; k: Record<string, number> } | null>(null);
  const [busy, setBusy] = useState(false);

  const compute = async () => {
    setBusy(true);
    try {
      const phases = [...MG_MINERALS, ...SILICA];
      const r = await runLab(logKInput([T], P, phases));
      const row = records(r.tables['logk.sel'] ?? { columns: [], rows: [] })[0];
      if (!row) { toast(st('failed', { msg: r.error || 'no output' })); return; }
      setK({ T, P, k: Object.fromEntries(phases.map(p => [p, num(row[p.replace(/[()]/g, '')])])) });
    } catch (e) { if ((e as Error).message !== 'cancelled') toast(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  const plot = useMemo(() => {
    if (!K) return null;
    const d = activityDiagram(K.k, mins, yr);
    if (!d.envelope.length) return null;
    const ex = d.envelope.map(e => e.x);
    const lo = Math.floor(Math.min(...ex) - 2), hi = Math.ceil(Math.max(...ex) + 4);
    const env = (y: number) => Math.min(...d.lines.map(l => l.x(y)));
    const polys: PPoly[] = [];
    const strip = (y0: number, y1: number) => Array.from({ length: 21 }, (_, i) => y0 + (y1 - y0) * i / 20);
    for (const f of d.fields) {
      const ys = strip(f.y0, f.y1);
      polys.push({ pts: [...ys.map((y): [number, number] => [y, env(y)]), [f.y1, hi], [f.y0, hi]], fill: MINERAL_COLOR[f.mineral], opacity: 0.2,
        label: f.mineral, labelAt: [(f.y0 + f.y1) / 2, Math.min(hi - 0.6, env((f.y0 + f.y1) / 2) + (hi - lo) * 0.18)] });
    }
    const all = strip(yr[0], yr[1]);
    polys.push({ pts: [...all.map((y): [number, number] => [y, env(y)]), [yr[1], lo], [yr[0], lo]], fill: colors.line, opacity: 0.5, label: st('d_und'), labelAt: [(yr[0] + yr[1]) / 2, lo + (hi - lo) * 0.06] });
    const series: PSeries[] = d.lines.map(l => ({ name: l.mineral, color: MINERAL_COLOR[l.mineral], line: true, dash: true, width: 1.2, points: strip(yr[0], yr[1]).map(y => ({ x: y, y: l.x(y) })) }));
    series.push({ name: 'Stable boundary', color: colors.ink, line: true, width: 2.4, points: d.envelope.map(e => ({ x: e.y, y: e.x })) });
    if (spec.rows) {
      const pts = spec.rows.map((r, i) => r && { x: num(r.la_SiO2), y: num(r.la_Mg) - 2 * num(r.la_H), label: field[i]?.name, info: `T ${num(r.T_C)} °C · pH ${num(r.pH).toFixed(2)}` }).filter((p): p is NonNullable<typeof p> => !!p && Number.isFinite(p.x) && Number.isFinite(p.y));
      series.push({ name: st('d_samples'), color: FIELD_COLOR, symbol: 'circle', labels: pts.length <= 25, points: pts });
    }
    return { polys, series, lo, hi, guides: d.silica.filter(s => s.y > yr[0] && s.y < yr[1]).map(s => ({ x: s.y, label: s.name })) };
  }, [K, mins, yr, spec.rows, colors, field, st]);

  return (
    <>
      <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="lab-form">
          <NumField label={st('d_temp')} value={T} min={0} max={300} onChange={v => setT(Math.min(300, Math.max(0, v)))} />
          <NumField label={st('d_press')} value={P} min={1} onChange={v => setP(Math.max(1, v))} />
          <label className="field"><span className="lab">{st('d_yrange')}</span><div className="two">
            <input type="number" value={yr[0]} step={0.5} onChange={e => Number.isFinite(e.target.valueAsNumber) && setYr([e.target.valueAsNumber, yr[1]])} aria-label="min" />
            <input type="number" value={yr[1]} step={0.5} onChange={e => Number.isFinite(e.target.valueAsNumber) && setYr([yr[0], e.target.valueAsNumber])} aria-label="max" /></div></label>
        </div>
        <div className="lab-checks"><span className="lab note">{st('d_minerals')}:</span>
          {MG_MINERALS.map(m => <label key={m} className="opts"><input type="checkbox" checked={mins.includes(m)} onChange={e => setMins(e.target.checked ? [...mins, m] : mins.filter(x => x !== m))} /> {m}</label>)}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn primary" type="button" disabled={busy || !mins.length || yr[1] <= yr[0]} onClick={compute}>{busy ? st('running') : st('d_compute')}</button>
          <SamplesButton st={st} field={field} spec={spec} />
        </div>
      </div></div>
      {plot && K && <Plot title={`${st('d_activity')} · ${K.T} °C, ${K.P} bar`} xLabel={st('d_x_act')} yLabel={st('d_y_act')} colors={colors}
        xDomain={yr} yDomain={[plot.lo, plot.hi]} series={plot.series} polys={plot.polys} guides={plot.guides}
        fileBase={`MgO-SiO2-H2O ${K.T}C`} dlLabel={st('dl')} toast={toast} note={st('d_note_act') + (spec.rows ? ' ' + st('d_samples_s') : '')} />}
    </>
  );
}

function Types({ st, colors, field, toast }: { st: STFn; colors: ThemeColors; field: FieldSample[]; toast: (m: string) => void }) {
  const [showRef, setShowRef] = useState(true);
  const pt = (s: FieldSample) => ({ x: s.pH ?? NaN, y: (s.conc.Mg ?? NaN) / (s.conc.Ca ?? NaN), label: s.name, info: s.temp != null ? `${s.temp} °C` : undefined });
  const ok = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y > 0;
  const series: PSeries[] = [];
  if (showRef) SITES.forEach((site, i) => {
    const pts = siteSamples(site).map(pt).filter(ok);
    if (pts.length) series.push({ name: site.name, color: GROUP_COLORS[i % GROUP_COLORS.length], symbol: (['square', 'triangle', 'diamond'] as const)[i % 3], points: pts });
  });
  const own = field.filter(s => !s.ref).map(pt).filter(ok);
  series.push({ name: st('d_samples'), color: FIELD_COLOR, symbol: 'circle', labels: own.length <= 25, points: own });
  const polys: PPoly[] = [
    { pts: [[7, 1], [10, 1], [10, 1000], [7, 1000]], fill: '#2F6FB0', opacity: 0.14, label: st('d_type1'), labelAt: [8.5, 300] },
    { pts: [[10.5, 1e-4], [12.8, 1e-4], [12.8, 0.1], [10.5, 0.1]], fill: '#B8671F', opacity: 0.16, label: st('d_type2'), labelAt: [11.65, 0.04] },
  ];
  return (
    <>
      <div className="lab-checks">
        <label className="opts"><input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} /> {st('d_ref')}</label>
        {!field.length && <span className="note">{st('d_need_field')}</span>}
      </div>
      <Plot title={st('d_types')} xLabel="pH" yLabel={st('d_y_type')} colors={colors} xDomain={[6, 13]} yDomain={[1e-4, 1e3]} yLog
        series={series} polys={polys} fileBase="Type I vs Type II" dlLabel={st('dl')} toast={toast} note={st('d_note_type')} />
    </>
  );
}

function FH2({ st, colors, params, field, spec, toast }: Omit<Props, 't'>) {
  const [temps, setTemps] = useState('25, 50, 75, 100, 150, 200, 250, 300');
  const [P, setP] = useState(params.pressureBar);
  const [serp, setSerp] = useState(true);
  const [wr, setWr] = useState(params.wr);
  const [fo, setFo] = useState(params.fo);
  const [res, setRes] = useState<{ P: number; wr: number; fo: number; rows: Record<string, number | string>[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const T = parseList(temps).filter(v => v >= 0 && v <= 300);

  const compute = async () => {
    setBusy(true);
    try {
      const r = await runLab(fh2Input(T, P));
      const rows = records(r.tables['fh2.sel'] ?? { columns: [], rows: [] });
      if (serp) {
        // the serpentinization curve uses the same model as the Preset tab
        const s = await runLab(sweepInput({ ...params, pressureBar: P }, scenarios(T, [wr], [fo])));
        for (const x of records(s.tables['sweep.sel'] ?? { columns: [], rows: [] })) rows.push({ curve: 'serp', T_C: x.T_C, log_fH2: x.log_fH2 });
      }
      if (!rows.length) toast(st('failed', { msg: r.error || 'no output' }));
      else if (!r.ok) toast(st('failed', { msg: r.error }));
      setRes({ P, wr, fo, rows });
    } catch (e) { if ((e as Error).message !== 'cancelled') toast(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  const series: PSeries[] = [];
  if (res) {
    const curve = (c: string) => res.rows.filter(r => String(r.curve) === c).map(r => ({ x: num(r.T_C), y: num(r.log_fH2) })).filter(p => Number.isFinite(p.y));
    series.push({ name: 'FMQ', color: '#7B3FA0', line: true, points: curve('FMQ') });
    series.push({ name: 'HM', color: '#B03A3A', line: true, points: curve('HM') });
    if (serp) series.push({ name: st('d_serp_curve', { wr: res.wr, fo: res.fo }), color: '#0C7480', line: true, symbol: 'circle', width: 2.4, points: curve('serp') });
  }
  if (spec.rows) {
    const pts = spec.rows.map((r, i) => r && { x: num(r.T_C), y: num(r.log_fH2), label: field[i]?.name, info: `H2 ${(num(r.H2_mmol) * 1000).toPrecision(3)} µmol/kgw` })
      .filter((p): p is NonNullable<typeof p> => !!p && Number.isFinite(p.y) && p.y > -998);
    series.push({ name: st('d_samples'), color: FIELD_COLOR, symbol: 'square', labels: pts.length <= 25, points: pts });
  }
  const ys = series.flatMap(s => s.points.map(p => p.y)).filter(Number.isFinite);
  const logP = Math.log10((res?.P ?? P) * BAR_TO_ATM);
  const yDom: [number, number] = ys.length ? [Math.floor(Math.min(...ys, logP) - 0.5), Math.ceil(Math.max(...ys, logP) + 0.5)] : [-8, 4];
  const noH2 = !!spec.rows && !spec.rows.some(r => r && num(r.log_fH2) > -998);

  return (
    <>
      <div className="panel"><div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="lab-form">
          <label className="field"><span className="lab">{st('d_trange')}</span><input type="text" value={temps} onChange={e => setTemps(e.target.value)} /><span className="note">{st('s_list_s')} · 0–300</span></label>
          <NumField label={st('d_press')} value={P} min={1} onChange={v => setP(Math.max(1, v))} />
          <NumField label={st('p_wr')} value={wr} min={0.05} onChange={v => setWr(Math.max(0.05, v))} />
          <NumField label={st('p_fo')} value={fo} min={0} max={100} onChange={v => setFo(Math.min(100, Math.max(0, v)))} />
        </div>
        <label className="opts"><input type="checkbox" checked={serp} onChange={e => setSerp(e.target.checked)} /> {st('d_serp_curve', { wr, fo })}</label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn primary" type="button" disabled={busy || T.length < 2} onClick={compute}>{busy ? st('running') : st('d_compute')}</button>
          <SamplesButton st={st} field={field} spec={spec} />
          {noH2 && <span className="note">{st('d_none_h2')}</span>}
        </div>
      </div></div>
      {(res || spec.rows) && <Plot title={`${st('d_fh2')} · ${res?.P ?? P} bar`} xLabel={st('d_temp')} yLabel={st('d_y_fh2')} colors={colors}
        xDomain={[0, 300]} yDomain={yDom} series={series} guides={[{ y: logP, label: st('d_ptot') }]}
        fileBase="log fH2 vs T" dlLabel={st('dl')} toast={toast} note={st('d_note_fh2') + (spec.rows ? ' ' + st('d_samples_s') : '')} />}
    </>
  );
}
