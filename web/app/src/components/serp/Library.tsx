// Stage 5: reference data from published serpentinization fluids, with full citations.
import type { Lang } from '../../lib/i18n';
import type { STFn } from '../../lib/serp/i18n';
import { SITES, SOURCES, siteSamples } from '../../lib/serp/reference';
import type { FieldSample } from '../../lib/serp/field';
import { fmt } from './common';

const L = (x: [string, string, string], lang: Lang) => x[lang === 'ja' ? 1 : lang === 'id' ? 2 : 0];

export function Library({ st, lang, onAdd }: { st: STFn; lang: Lang; onAdd: (s: FieldSample[]) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="view-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}><h2>{st('l_h')}</h2><p className="note">{st('l_s')}</p></div>
      {SITES.map(site => {
        const src = SOURCES.find(s => s.key === site.source)!;
        const samples = siteSamples(site);
        const keys = ['Ca', 'Mg', 'Na', 'Cl', 'Si', 'S(6)', 'C(4)', 'H2', 'CH4'].filter(k => samples.some(s => s.conc[k] != null));
        return (
          <div className="panel" key={site.id}>
            <div className="panel-h"><h3>{site.name} · {samples.length} {st('l_samples')}</h3>
              <button className="btn sm primary" type="button" onClick={() => onAdd(samples)}>{st('l_add')}</button></div>
            <div className="panel-b ref-card">
              <p className="note">{L(site.setting, lang)}{site.note ? ' ' + L(site.note, lang) : ''}</p>
              <div className="tbl-wrap" style={{ maxHeight: 300 }}>
                <table className="data">
                  <thead><tr><th>{st('sample')}</th><th>T °C</th><th>pH</th><th>Eh / ORP mV</th>{keys.map(k => <th key={k}>{k}</th>)}</tr></thead>
                  <tbody>{samples.map(s => <tr key={s.id}><td>{s.name}</td><td className="num">{s.temp ?? '–'}</td><td className="num">{s.pH}</td>
                    <td className="num">{s.eh != null ? `${s.eh} (Eh)` : s.orp != null ? `${s.orp} (ORP)` : '–'}</td>
                    {keys.map(k => <td key={k} className="num">{s.conc[k] != null ? fmt(s.conc[k], 3) : '–'}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <p className="note">mmol/L · {st('l_note')}</p>
              <p className="src">{src.cite} <a href={'https://doi.org/' + src.doi} target="_blank" rel="noopener noreferrer">doi:{src.doi}</a> · {src.table}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
