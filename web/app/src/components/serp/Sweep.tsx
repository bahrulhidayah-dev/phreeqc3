// Stage 2: run every T × W/R × Fo combination and map the result as contours.
import { useMemo, useState } from 'react';
import type { TFn } from '../../lib/i18n';
import type { STFn, SKey } from '../../lib/serp/i18n';
import type { ThemeColors } from '../Chart';
import { ChartPanel } from '../ChartPanel';
import type { ChartStyle } from '../chartStyle';
import { scenarios, sweepInput, type Scenario, type SerpParams } from '../../lib/serp/model';
import { records } from '../../lib/serp/thermo';
import { runLab } from '../../lib/serp/engine';
import type { SelTable } from '../../lib/parseOutput';
import { Contour } from './Contour';
import { DataTable, TableDownloads, num } from './common';
import { h2Total } from './Preset';

export interface SweepSpec { t: string; wr: string; fo: string }
export interface SweepResult { table: SelTable; failed: number[]; params: SerpParams; at: number }
type Axis = 'tempC' | 'wr' | 'fo';
const AX: Record<Axis, { col: string; label: SKey }> = { tempC: { col: 'T_C', label: 'ax_tempC' }, wr: { col: 'WR_target', label: 'ax_wr' }, fo: { col: 'Fo', label: 'ax_fo' } };
const METRICS: { id: string; label: SKey; get: (r: Record<string, number | string>) => number }[] = [
  { id: 'h2tot', label: 'm_h2tot', get: h2Total },
  { id: 'h2', label: 'm_h2', get: r => num(r.H2_mmol_kgw) },
  { id: 'fh2', label: 'm_fh2', get: r => num(r.log_fH2) },
  { id: 'ph', label: 'm_ph', get: r => num(r.pH) },
  { id: 'mag', label: 'm_mag', get: r => num(r.Magnetite_mol) },
  { id: 'serp', label: 'm_serp', get: r => num(r.Serpentine_mol) + (num(r.Greenalite_mol) || 0) },
  { id: 'bru', label: 'm_bru', get: r => num(r.Brucite_mol) + (num(r.FeBrucite_mol) || 0) },
  { id: 'ch4', label: 'm_ch4', get: r => num(r.CH4_mmol_kgw) },
];
export const MAX_SCENARIOS = 400;
const CHUNK = 12;

export const parseList = (s: string) => [...new Set(s.split(/[,;\s]+/).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);

interface Props {
  t: TFn; st: STFn; colors: ThemeColors; params: SerpParams; spec: SweepSpec; setSpec: (s: SweepSpec) => void;
  result: SweepResult | null; setResult: (r: SweepResult | null) => void; toast: (m: string) => void;
}

export function Sweep({ t, st, colors, params, spec, setSpec, result, setResult, toast }: Props) {
  const T = parseList(spec.t).filter(v => v >= 0 && v <= 300), WR = parseList(spec.wr).filter(v => v > 0), FO = parseList(spec.fo).filter(v => v >= 0 && v <= 100);
  const n = T.length * WR.length * FO.length;
  const [prog, setProg] = useState<{ k: number; n: number } | null>(null);
  const [metric, setMetric] = useState('h2tot');
  const [ax, setAx] = useState<{ x: Axis; y: Axis; fix: number; logX: boolean }>({ x: 'wr', y: 'tempC', fix: 0, logX: true });
  const [style, setStyle] = useState<ChartStyle | undefined>();

  const run = async () => {
    if (!n || n > MAX_SCENARIOS) return;
    const list = scenarios(T, WR, FO);
    const header: string[] = []; const rows: (number | string)[][] = []; const failed: number[] = [];
    setProg({ k: 0, n: list.length });
    try {
      const runChunk = async (part: Scenario[]): Promise<boolean> => {
        const r = await runLab(sweepInput(params, part));
        const tb = r.tables['sweep.sel'];
        if (tb && tb.columns.length) { if (!header.length) header.push(...tb.columns); rows.push(...tb.rows); }
        const got = new Set((tb?.rows ?? []).map(x => x[0]));
        return r.ok && part.every(s => got.has(s.i));
      };
      for (let i = 0; i < list.length; i += CHUNK) {
        const part = list.slice(i, i + CHUNK);
        const before = rows.length;
        if (!(await runChunk(part))) {
          // one scenario that fails to converge stops PHREEQC: redo this chunk one scenario at a time
          rows.length = before;
          for (const s of part) if (!(await runChunk([s]))) failed.push(s.i);
        }
        setProg({ k: Math.min(list.length, i + CHUNK), n: list.length });
      }
      const seen = new Set<number | string>();
      const uniq = rows.filter(r => !seen.has(r[0]) && seen.add(r[0])).sort((a, b) => num(a[0]) - num(b[0]));
      setResult({ table: { columns: header, rows: uniq }, failed, params, at: Date.now() });
      if (failed.length) toast(st('s_failed', { n: failed.length }));
    } catch (e) { if ((e as Error).message !== 'cancelled') toast(String((e as Error).message || e)); }
    finally { setProg(null); }
  };

  const recs = useMemo(() => (result ? records(result.table) : []), [result]);
  const vals = (a: Axis) => [...new Set(recs.map(r => num(r[AX[a].col])))].filter(Number.isFinite).sort((p, q) => p - q);
  const varying = (['tempC', 'wr', 'fo'] as Axis[]).filter(a => vals(a).length > 1);
  const M = METRICS.find(m => m.id === metric) ?? METRICS[0];
  const xA = varying.includes(ax.x) ? ax.x : varying[0];
  const yA = varying.includes(ax.y) && ax.y !== xA ? ax.y : varying.find(a => a !== xA);
  const third = (['tempC', 'wr', 'fo'] as Axis[]).find(a => a !== xA && a !== yA);
  const thirdVals = third ? vals(third) : [];
  const fixV = thirdVals.includes(ax.fix) ? ax.fix : thirdVals[0];
  const match = (r: Record<string, number | string>) => !third || thirdVals.length < 2 || Math.abs(num(r[AX[third].col]) - fixV) < 1e-9;
  const near = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));

  const grid = useMemo(() => {
    if (!xA || !yA) return null;
    const xs = vals(xA), ys = vals(yA);
    const z = ys.map(y => xs.map(x => { const r = recs.find(q => match(q) && near(num(q[AX[xA].col]), x) && near(num(q[AX[yA].col]), y)); const v = r ? M.get(r) : NaN; return Number.isFinite(v) ? v : null; }));
    return { xs, ys, z };
  }, [recs, xA, yA, fixV, metric]); // eslint-disable-line react-hooks/exhaustive-deps
  const desc = `${params.pressureBar} bar, NaCl ${params.naclMmol} mmol/kgw, ${params.serpentine}${params.feSolidSolution ? ' + Fe ss' : ''}${params.gasPhase ? ', gas' : ''}`;
  const lab = (a: Axis) => st(AX[a].label);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel">
        <div className="panel-h"><h3>{st('s_h')}</h3><span className="note">{st('s_count', { n })}</span></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="note">{st('s_s')}</p>
          <div className="lab-form">
            <label className="field"><span className="lab">{st('s_t')}</span><input type="text" value={spec.t} onChange={e => setSpec({ ...spec, t: e.target.value })} /><span className="note">{st('s_list_s')} · 0–300</span></label>
            <label className="field"><span className="lab">{st('s_wr')}</span><input type="text" value={spec.wr} onChange={e => setSpec({ ...spec, wr: e.target.value })} /><span className="note">{st('s_list_s')}</span></label>
            <label className="field"><span className="lab">{st('s_fo')}</span><input type="text" value={spec.fo} onChange={e => setSpec({ ...spec, fo: e.target.value })} /><span className="note">{st('s_list_s')}</span></label>
          </div>
          <p className="note">{st('s_base', { desc })}</p>
          {n > MAX_SCENARIOS && <p className="lab-alert">{st('s_too_many', { max: MAX_SCENARIOS })}</p>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn primary" type="button" disabled={!!prog || !n || n > MAX_SCENARIOS} onClick={run}>{prog ? st('running') : st('s_run')}</button>
            {prog && <><progress max={prog.n} value={prog.k} style={{ width: 200 }} /><span className="note">{st('s_progress', prog)}</span></>}
          </div>
        </div>
      </div>

      {!result && <p className="note">{st('s_none')}</p>}
      {result && recs.length > 0 && <>
        <div className="lab-form">
          <label className="field"><span className="lab">{st('s_metric')}</span>
            <select value={metric} onChange={e => setMetric(e.target.value)}>{METRICS.map(m => <option key={m.id} value={m.id}>{st(m.label)}</option>)}</select></label>
          {varying.length >= 2 && <>
            <label className="field"><span className="lab">{st('s_x')}</span>
              <select value={xA} onChange={e => setAx({ ...ax, x: e.target.value as Axis, logX: e.target.value === 'wr' })}>{varying.map(a => <option key={a} value={a}>{lab(a)}</option>)}</select>
              <label className="opts"><input type="checkbox" checked={ax.logX} onChange={e => setAx({ ...ax, logX: e.target.checked })} /> {st('s_logx')}</label></label>
            <label className="field"><span className="lab">{st('s_y')}</span>
              <select value={yA} onChange={e => setAx({ ...ax, y: e.target.value as Axis })}>{varying.filter(a => a !== xA).map(a => <option key={a} value={a}>{lab(a)}</option>)}</select></label>
            {third && thirdVals.length > 1 && <label className="field"><span className="lab">{st('s_fix', { p: lab(third) })}</span>
              <select value={fixV} onChange={e => setAx({ ...ax, fix: +e.target.value })}>{thirdVals.map(v => <option key={v} value={v}>{v}</option>)}</select></label>}
          </>}
        </div>
        {varying.length >= 2 && grid && xA && yA
          ? <Contour title={st('s_contour', { m: st(M.label) }) + (third && thirdVals.length ? ` · ${lab(third)} ${fixV}` : '')} xLabel={lab(xA)} yLabel={lab(yA)} zLabel={st(M.label)}
              grid={grid} xLog={ax.logX && grid.xs[0] > 0} yLog={false} colors={colors} dlLabel={st('dl')} toast={toast} fileBase={`sweep ${M.id}`} />
          : <>
            <p className="note">{st('s_need2')}</p>
            {varying.length === 1 && <ChartPanel t={t} colors={colors} toast={toast} fileBase={`sweep ${M.id}`} saved={style} onSave={setStyle}
              init={{ title: st(M.label), xTitle: lab(varying[0]), yTitle: st(M.label), xLog: varying[0] === 'wr' }}
              series={[{ key: M.id, name: st(M.label), points: recs.map(r => ({ x: num(r[AX[varying[0]].col]), y: M.get(r) })).filter(q => Number.isFinite(q.y)).sort((a, b) => a.x - b.x) }]} />}
          </>}
        <div className="panel">
          <div className="panel-h"><h3>{st('table')} · {st('s_count', { n: recs.length })}</h3><TableDownloads table={result.table} base="serpentinization sweep" label={st('dl')} /></div>
          <div className="panel-b"><DataTable table={result.table} /></div>
        </div>
      </>}
    </div>
  );
}
