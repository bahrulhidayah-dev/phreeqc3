import { useEffect, useMemo, useState } from 'react';
import type { TFn } from '../lib/i18n';
import { fetchText } from '../engine/client';
import { parseDatabase, type DbEntry } from '../lib/dbParse';

interface Props {
  t: TFn; databases: string[]; current: string; onUse: (db: string) => void; onInsert: (e: DbEntry) => void;
}

const DESC: Record<string, string> = {
  'phreeqc.dat': 'general', 'wateq4f.dat': 'trace elements', 'minteq.v4.dat': 'metals', 'minteq.dat': 'metals', 'llnl.dat': 'high T',
  'pitzer.dat': 'brines', 'sit.dat': 'SIT', 'iso.dat': 'isotopes', 'frezchem.dat': 'cold brines', 'ColdChem.dat': 'cold',
  // add-on files and special-range databases: on their own they stop with errors for an ordinary water (see web/validation)
  'Concrete_PHR.dat': 'cement add-on: INCLUDE$ it with phreeqc.dat', 'OtherDatabases/Concrete_PHR.dat': 'cement add-on: INCLUDE$ it with phreeqc.dat',
  'Concrete_PZ.dat': 'cement add-on: INCLUDE$ it with pitzer.dat', 'OtherDatabases/Concrete_PZ.dat': 'cement add-on: INCLUDE$ it with pitzer.dat',
  'EPRI/cdmusic_hiemstra.dat': 'surface add-on (goethite CD-MUSIC), not standalone', 'OtherDatabases/IU-bl-2kb.dat': '180–940 °C at 2 kbar only',
  'llnl-organics/llnl_organics.dat': 'stops with input errors (file as published)', 'Kinec_v3.dat': 'kinetics', 'Kinec_v3_4.dat': 'kinetics', 'Kinec.v2.dat': 'kinetics', 'phreeqc_rates.dat': 'kinetics',
  'Tipping_Hurley.dat': 'humic', 'minimum.dat': 'minimal', 'Amm.dat': 'ammonium', 'core10.dat': 'core', 'stimela.dat': 'drinking water',
  'THEREDA_2026-01_PHRQ_r17.dat': 'actinides', 'PHREEQC_ThermoddemV1.10_15Dec2020.dat': 'Thermoddem',
};

export function DatabaseView({ t, databases, current, onUse, onInsert }: Props) {
  const [db, setDb] = useState(databases.includes(current) ? current : 'phreeqc.dat');
  const [entries, setEntries] = useState<DbEntry[] | null>(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<DbEntry | null>(null);

  useEffect(() => {
    let live = true;
    setEntries(null); setSel(null);
    fetchText('databases/' + db).then(txt => { if (live) setEntries(parseDatabase(txt)); }).catch(() => live && setEntries([]));
    return () => { live = false; };
  }, [db]);

  const groups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const d of databases) { const dir = d.includes('/') ? 'database/' + d.slice(0, d.lastIndexOf('/') + 1) : 'database/'; g.set(dir, [...(g.get(dir) ?? []), d]); }
    return [...g.entries()];
  }, [databases]);

  const s = q.trim().toLowerCase();
  const list = (entries ?? []).filter(e => !s || e.name.toLowerCase().includes(s) || (e.formula ?? '').toLowerCase().includes(s));
  const shown = list.slice(0, 300);
  const cur = sel ?? shown.find(e => e.kind === 'PHASES') ?? shown[0] ?? null;

  return (
    <main className="view gut">
      <div className="view-head"><div><h1>{t('db_h')}</h1><p>{t('db_p')}</p></div></div>
      <div className="grid db">
        <div className="panel">
          <div className="panel-h"><h3>{t('db_files')}</h3><span className="note num">{databases.length}</span></div>
          <div className="dblist">
            {groups.map(([dir, files]) => [
              <p className="dbg" key={dir}>{dir}</p>,
              ...files.map(f => (
                <button key={f} type="button" aria-pressed={f === db} onClick={() => setDb(f)}>
                  <span className="mono" style={{ fontSize: 12.5, overflowWrap: 'anywhere' }}>{f.split('/').pop()}</span>
                  <span className="ds">{f === current ? '● ' + t('db_inuse') : DESC[f] ?? ''}</span>
                </button>
              )),
            ])}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label className="search"><input value={q} onChange={e => { setQ(e.target.value); setSel(null); }} placeholder={t('db_search')} aria-label={t('search')} /></label>
            <span className="note">{entries ? `${list.length} ${t('db_entries')}` : t('db_loading')}</span>
            <button className="btn primary sm" type="button" disabled={db === current} onClick={() => onUse(db)}>{db === current ? t('db_inuse') : t('db_use')}: {db.split('/').pop()}</button>
          </div>
          <div className="minerals">
            {shown.slice(0, 80).map((e, i) => <button key={e.kind + e.name + i} type="button" aria-pressed={cur === e} onClick={() => setSel(e)} title={e.kind}>{e.name}</button>)}
            {list.length > 80 && <span className="note">+{list.length - 80}</span>}
          </div>
          {cur ? (
            <div className="panel">
              <div className="panel-h"><div><h2>{cur.name}</h2><span className="note mono">{cur.kind} · {cur.formula} · {db}</span></div>
                {(cur.kind === 'PHASES') && <button className="btn sm" type="button" onClick={() => onInsert(cur)}>{t('db_insert')}: EQUILIBRIUM_PHASES</button>}</div>
              <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {cur.logk && <div className="props"><div className="prop"><div className="lbl">log K (25 °C)</div><div className="val">{cur.logk}</div></div></div>}
                <pre className="code">{cur.text}</pre>
              </div>
            </div>
          ) : <p className="note">{entries ? t('db_pick') : t('db_loading')}</p>}
        </div>
      </div>
    </main>
  );
}
