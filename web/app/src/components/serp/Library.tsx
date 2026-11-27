// Stage 5: reference data from published serpentinization fluids, with full citations.
import type { Lang } from '../../lib/i18n';
import type { STFn } from '../../lib/serp/i18n';
import { GAS_SITES, SITES, SOURCES, airFree, siteSamples } from '../../lib/serp/reference';
import type { FieldSample } from '../../lib/serp/field';
import { fmt } from './common';
import type { RefSource } from '../../lib/serp/reference';

function Cite({ src }: { src: RefSource }) {
  return <p className="src">{src.cite}{src.doi && <> <a href={'https://doi.org/' + src.doi} target="_blank" rel="noopener noreferrer">doi:{src.doi}</a></>} · {src.table}</p>;
}

const L = (x: [string, string, string], lang: Lang) => x[lang === 'ja' ? 1 : lang === 'id' ? 2 : 0];

export function Library({ st, lang, onAdd }: { st: STFn; lang: Lang; onAdd: (s: FieldSample[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="view-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><h2>{st('l_h')}</h2><p className="note">{st('l_s')}</p></div>
      {SITES.map(site => {
        const src = SOURCES.find(s => s.key === site.source)!;
        const samples = siteSamples(site);
        const keys = ['Ca', 'Mg', 'Na', 'K', 'Cl', 'Si', 'S(6)', 'C(4)', 'N(5)', 'N(-3)', 'Fe', 'Ni', 'Cr', 'H2', 'CH4'].filter(k => samples.some(s => s.conc[k] != null));
        return (
          <div className="panel" key={site.id}>
            <div className="panel-h"><h3>{site.name} · {samples.length} {st('l_samples')}</h3>
              <button className="btn sm primary" type="button" onClick={() => onAdd(samples)}>{st('l_add')}</button></div>
            <div className="panel-b ref-card">
              <p className="note">{L(site.setting, lang)}{site.note ? ' ' + L(site.note, lang) : ''}</p>
              <div className="tbl-wrap" style={{ maxHeight: 300 }}>
                <table className="data">
                  <thead><tr><th>{st('sample')}</th><th>T °C</th><th>pH</th><th>Eh / ORP mV</th>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>{samples.map(s => <tr key={s.id}><td>{s.name}</td><td className="num">{s.temp ?? '–'}</td><td className="num">{s.pH ?? '–'}</td>
                    <td className="num">{s.eh != null ? `${s.eh} (Eh)` : s.orp != null ? `${s.orp} (ORP)` : '–'}</td>
                    {keys.map(k => <td key={k} className="num">{s.conc[k] != null ? fmt(s.conc[k], 3) : '–'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="note">mmol/L · {st('l_note')}</p>
              <Cite src={src} />
            </div>
          </div>
        );
      })}
      {GAS_SITES.map(site => {
        const src = SOURCES.find(s => s.key === site.source)!;
        const f1 = (x: number) => (Number.isFinite(x) ? fmt(x, 3) : '–');
        return (
          <div className="panel" key={site.id}>
            <div className="panel-h"><h3>{site.name} · {site.rows.length} {st('l_gas')}</h3></div>
            <div className="panel-b ref-card">
              <p className="note">{L(site.setting, lang)}</p>
              <div className="tbl-wrap" style={{ maxHeight: 300 }}>
                <table className="data">
                  <thead><tr><th>{st('sample')}</th><th>{st('l_kind')}</th><th>O₂</th><th>N₂</th><th>CO₂</th><th>H₂</th><th>CH₄</th><th>C₂H₆</th><th>C₃H₈</th><th>δ¹³C-CH₄ ‰</th>
                    <th>{st('l_af')} H₂</th><th>{st('l_af')} CH₄</th><th>{st('l_af')} N₂*</th><th>H₂/CH₄</th></tr></thead>
                  <tbody>{site.rows.map(g => { const a = airFree(g); return (
                    <tr key={g.id}><td>{g.name}</td><td>{L(g.kind, lang)}</td>
                      {[g.O2, g.N2, g.CO2, g.H2, g.CH4, g.C2, g.C3].map((x, i) => <td key={i} className="num">{x}</td>)}
                      <td className="num">{g.d13C1Alt != null ? `${g.d13C1 ?? '–'} / ${g.d13C1Alt}` : g.d13C1 ?? '–'}</td>
                      <td className="num">{f1(a.H2)}</td><td className="num">{f1(a.CH4)}</td><td className="num">{f1(a.N2x)}</td><td className="num">{f1(a.H2_CH4)}</td></tr>); })}</tbody>
                </table>
              </div>
              <p className="note">mol % · {st('l_gas_note')}{site.note ? ' ' + L(site.note, lang) : ''}</p>
              {[src, ...(site.also ?? []).map(k => SOURCES.find(s => s.key === k)!)].map(x => <Cite key={x.key} src={x} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
