// Stage 4: field calculators: ORP → Eh → pe, headspace → dissolved H2/CH4, charge balance.
import { useMemo, useState } from 'react';
import type { STFn, SKey } from '../../lib/serp/i18n';
import { chargeBalance, ELECTRODES, headspace, HENRY, orpToPe, type FieldSample, type RefElectrode } from '../../lib/serp/field';
import { safeName, saveText, toCSV } from '../../lib/download';
import { Kpi, NumField, fmt, num } from './common';
import type { Speciation } from './speciation';

interface Props { st: STFn; field: FieldSample[]; electrode: RefElectrode; setElectrode: (e: RefElectrode) => void; spec: Speciation }

export function Calculators({ st, field, electrode, setElectrode, spec }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid lab-two">
        <OrpCalc st={st} electrode={electrode} setElectrode={setElectrode} />
        <Headspace st={st} />
      </div>
      <ChargeBalance st={st} field={field} spec={spec} />
    </div>
  );
}

function OrpCalc({ st, electrode, setElectrode }: Omit<Props, 'field' | 'spec'>) {
  const [orp, setOrp] = useState(-350);
  const [T, setT] = useState(25);
  const [sel, setSel] = useState<string>(ELECTRODES.some(e => e.id === electrode.id) ? electrode.id : 'custom');
  const [custom, setCustom] = useState<RefElectrode>({ id: 'custom', e25: electrode.e25, dEdT: electrode.dEdT });
  const el = sel === 'custom' ? custom : ELECTRODES.find(e => e.id === sel)!;
  const r = orpToPe(orp, T, el);
  const same = el.id === electrode.id && el.e25 === electrode.e25 && el.dEdT === electrode.dEdT;
  return (
    <div className="panel">
      <div className="panel-h"><h3>{st('c_orp_h')}</h3></div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="lab-form">
          <NumField label={st('c_orp')} value={orp} onChange={setOrp} />
          <NumField label={st('c_t')} value={T} onChange={setT} />
          <label className="field"><span className="lab">{st('c_el')}</span>
            <select value={sel} onChange={e => setSel(e.target.value)}>
              {ELECTRODES.map(e => <option key={e.id} value={e.id}>{st(('el_' + e.id) as SKey)}</option>)}
              <option value="custom">{st('el_custom')}</option>
            </select></label>
          {sel === 'custom' && <>
            <NumField label={st('c_e25')} value={custom.e25} onChange={v => setCustom({ ...custom, e25: v })} />
            <NumField label={st('c_dedt')} value={custom.dEdT} onChange={v => setCustom({ ...custom, dEdT: v })} />
          </>}
        </div>
        <div className="grid kpis">
          <Kpi label={st('c_eref')} value={fmt(r.eref * 1000, 4)} unit="mV" />
          <Kpi label={st('c_eh')} value={fmt(r.eh * 1000, 4)} unit="mV" />
          <Kpi label={st('c_pe')} value={r.pe.toFixed(2)} />
        </div>
        <p className="note"><b>{st('c_line')}:</b> <code className="mono">pe {r.pe.toFixed(2)}</code></p>
        <button className="btn sm" type="button" style={{ alignSelf: 'flex-start' }} disabled={same} onClick={() => setElectrode({ ...el })}>{same ? '✓ ' : ''}{st('c_use_el')}</button>
        <p className="note">{st('c_orp_note')}</p>
      </div>
    </div>
  );
}

function Headspace({ st }: { st: STFn }) {
  const [gas, setGas] = useState<'H2' | 'CH4'>('H2');
  const [v, setV] = useState({ ppmv: 2500, blank: 0.5, vg: 20, vw: 40, t: 25, p: 1 });
  const r = headspace(gas, v.ppmv, v.vg, v.vw, v.t, v.p, v.blank);
  const umol = r.c0 * 1e6, mg = r.c0 * HENRY[gas].M * 1000;
  const line = gas === 'H2' ? `H(0)   ${fmt(2 * r.c0 * 1000, 4)}   # mmol/L = ${fmt(r.c0 * 1000, 4)} mmol/L H2` : `C(-4)  ${fmt(r.c0 * 1000, 4)}   # mmol/L CH4`;
  const set = (k: keyof typeof v) => (x: number) => setV({ ...v, [k]: x });
  return (
    <div className="panel">
      <div className="panel-h"><h3>{st('c_hs_h')}</h3></div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="lab-form">
          <label className="field"><span className="lab">{st('c_gas')}</span>
            <select value={gas} onChange={e => setGas(e.target.value as 'H2' | 'CH4')}><option value="H2">H₂</option><option value="CH4">CH₄</option></select></label>
          <NumField label={st('c_ppmv')} value={v.ppmv} min={0} onChange={set('ppmv')} />
          <NumField label={st('c_blank')} value={v.blank} min={0} onChange={set('blank')} />
          <NumField label={st('c_vg')} value={v.vg} min={0} onChange={set('vg')} />
          <NumField label={st('c_vw')} value={v.vw} min={0.001} onChange={x => set('vw')(Math.max(0.001, x))} />
          <NumField label={st('c_teq')} value={v.t} onChange={set('t')} />
          <NumField label={st('c_patm')} value={v.p} min={0} onChange={set('p')} />
        </div>
        <div className="grid kpis">
          <Kpi label={st('c_c0')} value={fmt(umol, 4)} unit="µmol/L" sub={`${fmt(mg, 3)} mg/L`} />
          <Kpi label={st('c_frac')} value={fmt(r.fracInGas * 100, 3)} unit="%" />
          <Kpi label={st('c_kh')} value={r.kH.toExponential(3)} />
        </div>
        <p className="note"><b>{st('c_line')}:</b> <code className="mono">{line}</code></p>
        <p className="note">{st('c_hs_note')}</p>
      </div>
    </div>
  );
}

function ChargeBalance({ st, field, spec }: { st: STFn; field: FieldSample[]; spec: Speciation }) {
  const rows = useMemo(() => field.map((s, i) => ({ s, cb: chargeBalance(s), pq: spec.rows?.[i] ? num(spec.rows[i]!.pct_error) : NaN })), [field, spec.rows]);
  const status = (v: number) => (!Number.isFinite(v) ? '' : Math.abs(v) <= 5 ? 'ok' : Math.abs(v) <= 10 ? 'warn' : 'bad');
  const badge = (v: number) => { const k = status(v); return k ? <span className={'cb-' + k}>{k === 'ok' ? '✓ ' + st('cb_ok') : k === 'warn' ? '! ' + st('cb_warn') : '✕ ' + st('cb_bad')}</span> : null; };
  const csv = () => saveText(toCSV(['sample', 'name', 'cations_meq_L', 'anions_meq_L', 'CBE_quick_pct', 'PHREEQC_pct_error'],
    rows.map(r => [r.s.id, r.s.name, r.cb ? +r.cb.cations.toPrecision(5) : '', r.cb ? +r.cb.anions.toPrecision(5) : '', r.cb ? +r.cb.cbe.toFixed(2) : '', Number.isFinite(r.pq) ? +r.pq.toFixed(2) : ''])),
    safeName('charge balance') + '.csv', 'text/csv');
  return (
    <div className="panel">
      <div className="panel-h"><h3>{st('c_cb_h')}</h3>
        {field.length > 0 && <div className="export">
          <button className="btn sm" type="button" disabled={spec.busy} onClick={spec.run}>{spec.busy ? st('running') : st('c_cb_run')}</button>
          <span className="lbl">{st('dl')}</span><button className="btn sm" type="button" onClick={csv}>CSV</button></div>}
      </div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {!field.length ? <p className="note">{st('d_need_field')}</p> : <div className="tbl-wrap" style={{ maxHeight: 380 }}>
          <table className="data">
            <thead><tr><th>{st('sample')}</th><th>pH</th><th>{st('c_cat')}</th><th>{st('c_an')}</th><th>{st('c_cb_quick')}</th><th></th><th>{st('c_cb_pq')}</th><th></th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i}>
              <td>{r.s.name}</td><td className="num">{r.s.pH ?? ''}</td>
              <td className="num">{r.cb ? fmt(r.cb.cations, 4) : '–'}</td><td className="num">{r.cb ? fmt(r.cb.anions, 4) : '–'}</td>
              <td className="num">{r.cb ? r.cb.cbe.toFixed(1) : '–'}</td><td>{r.cb && badge(r.cb.cbe)}</td>
              <td className="num">{Number.isFinite(r.pq) ? r.pq.toFixed(1) : '–'}</td><td>{badge(r.pq)}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        <p className="note">{st('c_cb_note')}</p>
      </div>
    </div>
  );
}
