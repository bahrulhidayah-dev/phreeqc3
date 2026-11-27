// Serpentinization Lab: preset model, parameter sweep, diagrams, field calculators,
// reference data and a sample map, all sharing one table of field samples.
import { useMemo, useRef, useState } from 'react';
import type { Lang, TFn } from '../../lib/i18n';
import { makeST } from '../../lib/serp/i18n';
import type { ThemeColors } from '../Chart';
import { DEFAULT_PARAMS, SERP_DB, type SerpParams } from '../../lib/serp/model';
import { ELECTRODES, fieldSolutions, fieldTemplate, readField, type FieldSample, type RefElectrode } from '../../lib/serp/field';
import { readWorkbook } from '../../lib/excel';
import { Preset } from './Preset';
import { Sweep, type SweepResult, type SweepSpec } from './Sweep';
import { Diagrams } from './Diagrams';
import { Calculators } from './Calculators';
import { Library } from './Library';
import { SampleMap } from './SampleMap';
import { useSpeciation } from './speciation';

export interface LabState {
  params: SerpParams; spec: SweepSpec; electrode: RefElectrode; unit: string;
  field: FieldSample[]; sweep: SweepResult | null; tab: Tab;
}
type Tab = 'preset' | 'sweep' | 'diag' | 'calc' | 'lib' | 'map';
export const defaultLab = (): LabState => ({
  params: DEFAULT_PARAMS, spec: { t: '50, 100, 150, 200, 250, 300', wr: '0.5, 1, 2, 5, 10', fo: '90' },
  electrode: ELECTRODES[0], unit: 'mg/L', field: [], sweep: null, tab: 'preset',
});

interface Props {
  t: TFn; lang: Lang; colors: ThemeColors; lab: LabState; setLab: (f: (l: LabState) => LabState) => void;
  toast: (m: string) => void; onOpen: (name: string, input: string, db: string) => void;
}

export function Lab({ t, lang, colors, lab, setLab, toast, onOpen }: Props) {
  const st = useMemo(() => makeST(lang), [lang]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<{ mapped: { header: string; to: string }[]; skipped: string[] } | null>(null);
  const [showRows, setShowRows] = useState(false);
  const set = <K extends keyof LabState>(k: K, v: LabState[K]) => setLab(l => ({ ...l, [k]: v }));
  const spec = useSpeciation(lab.field, lab.electrode, toast, st);

  const load = async (f: File | undefined) => {
    if (!f) return;
    try {
      const r = readField(await readWorkbook(f), lab.unit);
      set('field', r.samples); setInfo(r);
      toast(st('fd_loaded', { n: r.samples.length, name: f.name }));
    } catch (e) { toast(String((e as Error).message || e)); }
  };
  const tabs: [Tab, string][] = [['preset', st('tab_preset')], ['sweep', st('tab_sweep')], ['diag', st('tab_diag')], ['calc', st('tab_calc')], ['lib', st('tab_lib')], ['map', st('tab_map')]];

  return (
    <main className="view gut">
      <div className="view-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
        <h1>{st('lab_h')}</h1><p className="note">{st('lab_s')}</p>
      </div>

      <div className="panel">
        <div className="panel-h"><h3>{st('fd_h')}</h3>
          <span className="note">{lab.field.length ? st('fd_n', { n: lab.field.length }) : ''}</span></div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!lab.field.length && <p className="note">{st('fd_none')}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="field" style={{ width: 130 }}><span className="lab">{st('fd_unit')}</span>
              <select value={lab.unit} onChange={e => set('unit', e.target.value)}>{['mg/L', 'mmol/L', 'umol/L', 'ug/L', 'meq/L'].map(u => <option key={u}>{u}</option>)}</select></label>
            <button className="btn sm primary" type="button" onClick={() => fileRef.current?.click()}>{st('fd_load')}</button>
            <button className="btn sm" type="button" onClick={() => fieldTemplate().catch(e => toast(String(e)))}>{st('fd_tpl')}</button>
            {lab.field.length > 0 && <>
              <button className="btn sm" type="button" onClick={() => setShowRows(s => !s)}>{st('fd_show')}</button>
              <button className="btn sm" type="button" onClick={() => onOpen('Field samples', `TITLE Field samples\n${fieldSolutions(lab.field, 4, lab.electrode)}\nEND\n`, SERP_DB)}>{st('fd_solutions')}</button>
              <button className="btn sm" type="button" onClick={() => { set('field', []); setInfo(null); }}>{st('fd_clear')}</button>
            </>}
          </div>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.csv,.txt,.tsv" onChange={e => { load(e.target.files?.[0]); e.target.value = ''; }} />
          {info && <p className="note"><b>{st('fd_mapped')}:</b> {info.mapped.map(m => `${m.header} → ${m.to}`).join(' · ') || '–'}{info.skipped.length > 0 && <><br /><b>{st('fd_skipped')}:</b> {info.skipped.join(', ')}</>}</p>}
          {showRows && lab.field.length > 0 && <FieldRows samples={lab.field} />}
        </div>
      </div>

      <div className="tabs" role="tablist" style={{ flexWrap: 'wrap' }}>
        {tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={lab.tab === id} onClick={() => set('tab', id)}>{label}</button>)}
      </div>

      {lab.tab === 'preset' && <Preset t={t} st={st} colors={colors} params={lab.params} setParams={p => set('params', p)} toast={toast} onOpen={(n, i) => onOpen(n, i, SERP_DB)} />}
      {lab.tab === 'sweep' && <Sweep t={t} st={st} colors={colors} params={lab.params} spec={lab.spec} setSpec={s => set('spec', s)} result={lab.sweep} setResult={r => set('sweep', r)} toast={toast} />}
      {lab.tab === 'diag' && <Diagrams t={t} st={st} colors={colors} params={lab.params} field={lab.field} spec={spec} toast={toast} />}
      {lab.tab === 'calc' && <Calculators st={st} field={lab.field} electrode={lab.electrode} setElectrode={e => set('electrode', e)} spec={spec} />}
      {lab.tab === 'lib' && <Library st={st} lang={lang} onAdd={s => { setLab(l => ({ ...l, field: [...l.field, ...s] })); toast(st('l_added', { n: s.length })); }} />}
      {lab.tab === 'map' && <SampleMap st={st} colors={colors} field={lab.field} toast={toast} />}
    </main>
  );
}

function FieldRows({ samples }: { samples: FieldSample[] }) {
  const keys = [...new Set(samples.flatMap(s => Object.keys(s.conc)))];
  const f = (v: number | undefined) => (v == null || !Number.isFinite(v) ? '' : String(+v.toPrecision(4)));
  return (
    <div className="tbl-wrap" style={{ maxHeight: 300 }}>
      <table className="data">
        <thead><tr><th>ID</th><th>Name</th><th>Lat</th><th>Lon</th><th>T °C</th><th>pH</th><th>ORP/Eh mV</th>{keys.map(k => <th key={k}>{k} {k === 'Alkalinity' ? 'meq/L' : 'mmol/L'}</th>)}</tr></thead>
        <tbody>{samples.map((s, i) => <tr key={i}><td>{s.id}</td><td>{s.name}</td><td className="num">{f(s.lat)}</td><td className="num">{f(s.lon)}</td><td className="num">{f(s.temp)}</td><td className="num">{f(s.pH)}</td>
          <td className="num">{s.eh != null ? f(s.eh) + ' (Eh)' : f(s.orp)}</td>{keys.map(k => <td key={k} className="num">{f(s.conc[k])}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
