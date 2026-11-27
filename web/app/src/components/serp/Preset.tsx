// Stage 1: one-click serpentinization model (olivine + fluid → serpentine, brucite, magnetite, H2).
import { useMemo, useState } from 'react';
import type { TFn } from '../../lib/i18n';
import type { STFn } from '../../lib/serp/i18n';
import type { ThemeColors } from '../Chart';
import { ChartPanel } from '../ChartPanel';
import type { ChartStyle } from '../chartStyle';
import { presetInput, usesFeSolidSolution, olivineMoles, olivineMolarMass, BAR_TO_ATM, type SerpParams } from '../../lib/serp/model';
import { records } from '../../lib/serp/thermo';
import { runLab, type LabRun } from '../../lib/serp/engine';
import { safeName, saveText } from '../../lib/download';
import { DataTable, Kpi, NumField, TableDownloads, fmt, num } from './common';

interface Props {
  t: TFn; st: STFn; colors: ThemeColors; params: SerpParams; setParams: (p: SerpParams) => void;
  toast: (m: string) => void; onOpen: (name: string, input: string) => void;
}

export function h2Total(r: Record<string, number | string>) {
  return num(r.H2_mmol_kgw) * (num(r.water_kg) || 1) + (num(r.gas_H2_mol) || 0) * 1000;
}

export function Preset({ t, st, colors, params: p, setParams, toast, onOpen }: Props) {
  const [res, setRes] = useState<LabRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [styles, setStyles] = useState<Record<string, ChartStyle>>({});
  const input = useMemo(() => presetInput(p), [p]);
  const set = <K extends keyof SerpParams>(k: K, v: SerpParams[K]) => setParams({ ...p, [k]: v });
  const title = `Serpentinization Fo${p.fo} ${p.tempC}C WR${p.wr}`;

  const run = async () => {
    setBusy(true);
    try {
      const r = await runLab(input);
      setRes(r);
      if (!r.ok) toast(st('failed', { msg: r.error || 'no output' }));
    } catch (e) { if ((e as Error).message !== 'cancelled') toast(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  const table = res?.tables['serpentinization.sel'];
  const rows = useMemo(() => (table ? records(table) : []), [table]);
  const last = rows[rows.length - 1];
  const pts = (y: (r: Record<string, number | string>) => number) => rows.map(r => ({ x: num(r['W:R']), y: y(r) })).filter(q => Number.isFinite(q.x) && Number.isFinite(q.y));
  const logP = Math.log10(p.pressureBar * BAR_TO_ATM);
  const ss = usesFeSolidSolution(p);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="panel">
        <div className="panel-h"><h3>{st('p_h')}</h3><span className="note">{st('p_tmax')}</span></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p className="note">{st('p_s')}</p>
          <div className="lab-form">
            <NumField label={st('p_temp')} value={p.tempC} min={0} max={300} onChange={v => set('tempC', Math.min(300, Math.max(0, v)))} />
            <NumField label={st('p_press')} value={p.pressureBar} min={1} onChange={v => set('pressureBar', Math.max(1, v))} />
            <NumField label={st('p_wr')} value={p.wr} min={0.05} hint={st('p_wr_s')} onChange={v => set('wr', Math.max(0.05, v))} />
            <NumField label={st('p_fo')} value={p.fo} min={0} max={100} onChange={v => set('fo', Math.min(100, Math.max(0, v)))} />
            <NumField label={st('p_nacl')} value={p.naclMmol} min={0} onChange={v => set('naclMmol', Math.max(0, v))} />
            <NumField label={st('p_dic')} value={p.dicMmol} min={0} hint={st('p_dic_s')} onChange={v => set('dicMmol', Math.max(0, v))} />
            <NumField label={st('p_ca')} value={p.caMmol} min={0} onChange={v => set('caMmol', Math.max(0, v))} />
            <NumField label={st('p_steps')} value={p.steps} min={2} max={60} step={1} onChange={v => set('steps', Math.round(Math.min(60, Math.max(2, v))))} />
            <label className="field"><span className="lab">{st('p_serp')}</span>
              <select value={p.serpentine} onChange={e => set('serpentine', e.target.value as SerpParams['serpentine'])}>
                <option value="Chrysotile">Chrysotile</option><option value="Antigorite">Antigorite</option>
              </select></label>
          </div>
          <div className="lab-checks">
            <label className="opts" title={st('p_ss_s')}><input type="checkbox" checked={p.feSolidSolution} onChange={e => set('feSolidSolution', e.target.checked)} /> {st('p_ss')}</label>
            <label className="opts" title={st('p_gas_s')}><input type="checkbox" checked={p.gasPhase} onChange={e => set('gasPhase', e.target.checked)} /> {st('p_gas')}</label>
            <label className="opts"><input type="checkbox" checked={p.talc} onChange={e => set('talc', e.target.checked)} /> {st('p_talc')}</label>
            <label className="opts"><input type="checkbox" checked={p.calcite} onChange={e => set('calcite', e.target.checked)} /> {st('p_calcite')}</label>
          </div>
          <p className="note">{st('p_rock', { mol: fmt(olivineMoles(p.wr, p.fo), 4), g: fmt(olivineMoles(p.wr, p.fo) * olivineMolarMass(p.fo), 4) })}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" type="button" disabled={busy} onClick={run}>{busy ? st('running') : st('p_run')}</button>
            <button className="btn" type="button" onClick={() => onOpen(title, input)}>{st('open_builder')}</button>
            <button className="btn" type="button" onClick={() => saveText(input, safeName(title) + '.pqi')}>{st('dl_pqi')}</button>
          </div>
          <details><summary className="note">{st('show_input')}</summary><pre className="code lab-pre">{input}</pre></details>
        </div>
      </div>

      {last && <>
        <div className="view-head"><h2>{st('p_res')}</h2><span className="note">W/R {fmt(num(last['W:R']))} · {res?.ms} ms</span></div>
        <div className="grid kpis lab-kpis">
          <Kpi label={st('k_ph')} value={fmt(num(last.pH))} />
          <Kpi label={st('k_h2')} value={fmt(h2Total(last))} unit="mmol" sub={st('k_h2_s')} />
          <Kpi label={st('k_fh2')} value={fmt(num(last.log_fH2))} />
          <Kpi label={st('k_mag')} value={fmt(num(last.Magnetite_mol))} unit="mol" />
          <Kpi label={st('k_serp')} value={fmt(num(last.Serpentine_mol) + (num(last.Greenalite_mol) || 0))} unit="mol" />
          <Kpi label={st('k_bru')} value={fmt(num(last.Brucite_mol) + (num(last.FeBrucite_mol) || 0))} unit="mol" />
        </div>
        {!p.gasPhase && num(last.log_fH2) > logP && <p className="lab-alert" role="alert">{st('p_warn_fh2')}</p>}
        <ChartPanel t={t} colors={colors} toast={toast} fileBase={title + ' H2'} saved={styles.h2} onSave={s => setStyles(o => ({ ...o, h2: s }))}
          init={{ title: st('c_h2'), xTitle: st('x_wr'), yTitle: st('y_h2'), xLog: true, yLog: true }}
          series={[
            { key: 'h2tot', name: st('m_h2tot'), points: pts(h2Total) },
            { key: 'h2aq', name: st('m_h2'), points: pts(r => num(r.H2_mmol_kgw)) },
          ]} />
        <ChartPanel t={t} colors={colors} toast={toast} fileBase={title + ' pH'} saved={styles.ph} onSave={s => setStyles(o => ({ ...o, ph: s }))}
          init={{ title: st('c_ph'), xTitle: st('x_wr'), yTitle: 'pH', xLog: true }}
          series={[{ key: 'ph', name: 'pH', points: pts(r => num(r.pH)) }]} />
        <ChartPanel t={t} colors={colors} toast={toast} fileBase={title + ' minerals'} saved={styles.min} onSave={s => setStyles(o => ({ ...o, min: s }))}
          init={{ title: st('c_min'), xTitle: st('x_wr'), yTitle: st('y_mol'), xLog: true, yLog: true }}
          series={[
            { key: 'serp', name: ss ? `${p.serpentine} (ss)` : p.serpentine, points: pts(r => num(r.Serpentine_mol)) },
            { key: 'bru', name: ss ? 'Brucite (ss)' : 'Brucite', points: pts(r => num(r.Brucite_mol)) },
            { key: 'mag', name: 'Magnetite', points: pts(r => num(r.Magnetite_mol)) },
            ...(ss ? [{ key: 'febru', name: 'Fe(OH)2 (ss)', points: pts(r => num(r.FeBrucite_mol)) }, { key: 'gre', name: 'Greenalite (ss)', points: pts(r => num(r.Greenalite_mol)) }] : []),
          ]} />
        {table && <div className="panel">
          <div className="panel-h"><h3>{st('table')}</h3><TableDownloads table={table} base={title} label={st('dl')} /></div>
          <div className="panel-b"><DataTable table={table} /></div>
        </div>}
      </>}
    </div>
  );
}
