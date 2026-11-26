import { useState } from 'react';
import type { TFn } from '../lib/i18n';
import { buildSolutions, downloadTemplate, ELEMENT_CHOICES, readSamples, readSettings, readWorkbook, SPECIAL, UNITS, type ColumnMap } from '../lib/excel';
import { summarize } from '../lib/inputModel';

interface Props {
  t: TFn; onClose: () => void; toast: (m: string) => void;
  onSolutions: (text: string, mode: 'replace' | 'append', database?: string) => void;
  onInput: (name: string, text: string, files: Record<string, string>, view: 'builder' | 'editor') => void;
  initialTab?: 'x' | 'p';
}

function Drop({ label, sub, accept, multiple, onFiles }: { label: string; sub: string; accept: string; multiple?: boolean; onFiles: (f: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <label className="drop" style={over ? { filter: 'brightness(0.95)' } : undefined}
      onDragOver={e => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]); }}>
      <b>{label}</b><span className="note">{sub}</span>
      <input type="file" accept={accept} multiple={multiple} hidden onChange={e => { onFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
    </label>
  );
}

export function ImportDialog({ t, onClose, toast, onSolutions, onInput, initialTab = 'x' }: Props) {
  const [tab, setTab] = useState<'x' | 'p'>(initialTab);
  // Excel state
  const [xlName, setXlName] = useState('');
  const [cols, setCols] = useState<ColumnMap[]>([]);
  const [data, setData] = useState<(string | number | null)[][]>([]);
  const [units, setUnits] = useState('mg/L');
  const [db, setDb] = useState<string | undefined>();
  // PHREEQC input state
  const [pq, setPq] = useState<{ name: string; text: string } | null>(null);
  const [extra, setExtra] = useState<Record<string, string>>({});

  const loadXl = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    try {
      const sheets = await readWorkbook(f);
      const s = readSamples(sheets);
      const st = readSettings(sheets);
      setXlName(f.name); setCols(s.columns); setData(s.data);
      if (st.units) setUnits(st.units);
      setDb(st.database);
    } catch (e) { toast(`${t('xl_err')} ${(e as Error).message}`); }
  };
  const loadPq = async (files: File[]) => {
    const main = files.find(f => !/\.(tsv|csv|dat)$/i.test(f.name)) ?? files[0];
    if (!main) return;
    const text = await main.text();
    setPq({ name: main.name, text });
    const ex: Record<string, string> = {};
    for (const f of files) if (f !== main) ex[f.name] = await f.text();
    setExtra(e => ({ ...e, ...ex }));
  };

  const setCol = (i: number, patch: Partial<ColumnMap>) => setCols(cs => cs.map((c, j) => (j === i ? { ...c, ...patch, confident: true } : c)));
  const nSamples = data.length;
  const sum = pq ? summarize(pq.text) : null;
  const preview = cols.length ? data.slice(0, 3) : [];

  return (
    <div className="back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-label={t('imp_h')}>
        <div className="dlg-h"><h2>{t('imp_h')}</h2><button className="btn sm" type="button" onClick={onClose}>{t('close')}</button></div>
        <div className="dlg-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'x'} onClick={() => setTab('x')}>{t('imp_t1')}</button>
            <button role="tab" aria-selected={tab === 'p'} onClick={() => setTab('p')}>{t('imp_t2')}</button>
          </div>

          {tab === 'x' && <>
            <div className="steps3">
              <div className="st3"><span className="n">1</span><b>{t('xl_1')}</b><p className="note">{t('xl_1s')}</p>
                <button className="btn sm" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => downloadTemplate().catch(e => toast(String(e)))}>{t('xl_tpl')}</button></div>
              <div className="st3"><span className="n">2</span><b>{t('xl_2')}</b>
                <Drop label={t('xl_drop')} sub={t('xl_drop_s')} accept=".xlsx,.csv,.tsv,.txt" onFiles={loadXl} />
                {xlName && <span className="note"><span className="ok">✓</span> {xlName} · {nSamples} {t('xl_samples')}</span>}</div>
              <div className="st3"><span className="n">3</span><b>{t('xl_3')}</b><p className="note">{t('xl_3s')}</p>
                <label className="field"><span className="lab">{t('xl_units')}</span>
                  <select value={units} onChange={e => setUnits(e.target.value)}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></label>
                {nSamples > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn primary sm" type="button" onClick={() => onSolutions(buildSolutions(cols, data, units), 'replace', db)}>{t('xl_replace')}</button>
                  <button className="btn sm" type="button" onClick={() => onSolutions(buildSolutions(cols, data, units), 'append', db)}>{t('xl_append')}</button>
                </div>}
                {nSamples > 0 && <span className="note">{t('xl_create', { n: nSamples })}</span>}</div>
            </div>
            {cols.length > 0 && <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
              <table className="data">
                <thead><tr><th>{t('xl_col')}</th>{preview.map((_, i) => <th key={i}>#{i + 1}</th>)}<th>{t('xl_map')}</th><th>{t('xl_unit')}</th></tr></thead>
                <tbody>{cols.map((c, i) => (
                  <tr key={c.col} style={!c.confident ? { background: 'var(--warn-soft)' } : undefined}>
                    <td className="mono">{c.header}</td>
                    {preview.map((r, j) => <td key={j} className="num">{r[c.col] ?? ''}</td>)}
                    <td><select value={c.target} onChange={e => setCol(i, { target: e.target.value })} aria-label={t('xl_map')}>
                      <option value="">— {t('xl_skip')} —</option>
                      <optgroup label="SOLUTION">{SPECIAL.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      <optgroup label={t('f_element')}>{ELEMENT_CHOICES.map(s => <option key={s} value={s}>{s}</option>)}</optgroup>
                      {c.target && !SPECIAL.includes(c.target) && !ELEMENT_CHOICES.includes(c.target) && <option value={c.target}>{c.target}</option>}
                    </select></td>
                    <td>{c.target && !SPECIAL.includes(c.target) && <input value={c.unit} placeholder="as HCO3 / mmol/L" onChange={e => setCol(i, { unit: e.target.value })} style={{ width: 150 }} aria-label={t('xl_unit')} />}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>}
            <p className="note">{t('xl_note')}</p>
          </>}

          {tab === 'p' && <>
            <div className="steps3 two">
              <div className="st3"><span className="n">1</span><b>{t('ip_1')}</b>
                <Drop label={t('ip_drop')} sub={t('xl_drop_s')} accept=".pqi,.phr,.in,.txt,.inp,.pqo,*" multiple onFiles={loadPq} />
                {pq && <span className="note"><span className="ok">✓</span> {pq.name} · {pq.text.split('\n').length} lines</span>}
                <p className="note">{t('ip_s')}</p></div>
              <div className="st3"><span className="n">2</span><b>{t('ip_2')}</b>
                {sum ? <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span><span className="ok">✓</span> {t('ip_found', { s: sum.simulations, b: sum.blocks })}</span>
                  {sum.database && <span><span className="ok">✓</span> {t('ip_db', { db: sum.database })}</span>}
                </div> : <span className="note">—</span>}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  <button className="btn primary sm" type="button" disabled={!pq} onClick={() => pq && onInput(pq.name, pq.text, extra, 'builder')}>{t('ip_open_b')}</button>
                  <button className="btn sm" type="button" disabled={!pq} onClick={() => pq && onInput(pq.name, pq.text, extra, 'editor')}>{t('ip_open_e')}</button>
                </div>
                <b style={{ marginTop: 8 }}>{t('ip_files')}</b><span className="note">{t('ip_files_s')}</span>
                <label className="btn sm" style={{ alignSelf: 'flex-start' }}>+ {t('ip_files')}<input type="file" multiple hidden onChange={async e => {
                  const ex: Record<string, string> = {};
                  for (const f of [...(e.target.files ?? [])]) ex[f.name] = await f.text();
                  setExtra(x => ({ ...x, ...ex })); e.target.value = '';
                }} /></label>
                {Object.keys(extra).length > 0 && <span className="note mono">{Object.keys(extra).join(', ')}</span>}
              </div>
            </div>
            {pq && <pre className="code" style={{ maxHeight: 240, overflow: 'auto' }}>{pq.text.slice(0, 4000)}</pre>}
            <p className="note">{t('xl_note')}</p>
          </>}
        </div>
      </div>
    </div>
  );
}
