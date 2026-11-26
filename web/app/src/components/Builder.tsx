// Model Builder: the input as a sequence of keyword blocks. Common blocks get forms; every
// block can be edited as text. All edits go straight back into the same input text.
import { useEffect, useMemo, useRef, useState } from 'react';
import { splitBlocks, joinBlocks, headParts, parseSolution, writeSolution, parsePhases, writePhases, type Block, type SolutionForm } from '../lib/inputModel';
import { ALL_KEYWORDS } from '../lib/keywords';
import type { TFn } from '../lib/i18n';
import { MANUAL_URL } from './Header';
import { UNITS } from '../lib/excel';

interface Props { t: TFn; input: string; setInput: (s: string) => void; onAdd: () => void; phaseNames: string[]; selected: number; setSelected: (i: number) => void }

/** Keeps a form draft (which may hold half-typed rows) in step with the block text. */
function useDraft<T>(block: Block, parse: (b: Block) => T, write: (d: T) => string, onChange: (text: string) => void) {
  const [draft, setDraft] = useState(() => parse(block));
  const last = useRef(block.text);
  useEffect(() => { if (block.text !== last.current) { last.current = block.text; setDraft(parse(block)); } }, [block.text]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (d: T) => { setDraft(d); const txt = write(d); last.current = txt; onChange(txt); };
  return [draft, update] as const;
}

function SolutionEditor({ t, block, onChange }: { t: TFn; block: Block; onChange: (text: string) => void }) {
  const kw = block.head.split(/\s+/)[0];
  const [f, setF] = useDraft(block, parseSolution, d => writeSolution(d, kw), onChange);
  const up = (patch: Partial<SolutionForm>) => setF({ ...f, ...patch });
  const field = (label: string, key: 'n' | 'desc' | 'temp' | 'pH' | 'pe' | 'density', ph = '') => (
    <div className="field"><label>{label}</label><input value={f[key]} placeholder={ph} onChange={e => up({ [key]: e.target.value })} /></div>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="fields">
        {field(t('f_number'), 'n', '1')}
        <div className="field" style={{ gridColumn: 'span 3' }}><label>{t('f_desc')}</label><input value={f.desc} onChange={e => up({ desc: e.target.value })} /></div>
        <div className="field"><label>{t('f_units')}</label>
          <select value={f.units} onChange={e => up({ units: e.target.value })}>
            <option value="">mmol/kgw (default)</option>{UNITS.map(u => <option key={u}>{u}</option>)}
            {f.units && !UNITS.includes(f.units) && <option>{f.units}</option>}
          </select></div>
        {field(t('f_temp'), 'temp', '25')}{field('pH', 'pH', '7')}{field('pe', 'pe', '4')}{field(t('f_density'), 'density', '1')}
      </div>
      <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table className="comp">
          <thead><tr><th>{t('f_element')}</th><th className="r">{t('f_conc')}</th><th>{t('f_extra')}</th><th /></tr></thead>
          <tbody>
            {f.rows.map((r, i) => (
              <tr key={i}>
                <td><input className="el" style={{ textAlign: 'left' }} value={r.el} onChange={e => { const rows = [...f.rows]; rows[i] = { ...r, el: e.target.value }; up({ rows }); }} aria-label={t('f_element')} /></td>
                <td><input value={r.value} onChange={e => { const rows = [...f.rows]; rows[i] = { ...r, value: e.target.value }; up({ rows }); }} aria-label={t('f_conc')} /></td>
                <td><input style={{ textAlign: 'left' }} value={r.extra} placeholder="as HCO3" onChange={e => { const rows = [...f.rows]; rows[i] = { ...r, extra: e.target.value }; up({ rows }); }} aria-label={t('f_extra')} /></td>
                <td><button className="btn sm" type="button" aria-label="remove" onClick={() => up({ rows: f.rows.filter((_, j) => j !== i) })}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn sm dashed" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => up({ rows: [...f.rows, { el: '', value: '', extra: '' }] })}>+ {t('f_add_row')}</button>
    </div>
  );
}

function PhasesEditor({ t, block, onChange, phaseNames }: { t: TFn; block: Block; onChange: (text: string) => void; phaseNames: string[] }) {
  const kw = block.head.split(/\s+/)[0];
  const [p, setP] = useDraft(block, parsePhases, d => writePhases(d, kw), onChange);
  const up = (rows: typeof p.rows) => setP({ ...p, rows });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <datalist id="phase-names">{phaseNames.map(n => <option key={n} value={n} />)}</datalist>
      <div className="tbl-wrap" style={{ border: '1px solid var(--line)', borderRadius: 8, overflowX: 'auto' }}>
        <table className="comp">
          <thead><tr><th>{t('f_phase')}</th><th className="r">{t('f_si')}</th><th className="r">{t('f_amount')}</th><th>{t('f_extra')}</th><th /></tr></thead>
          <tbody>
            {p.rows.map((r, i) => {
              const set = (k: keyof typeof r, v: string) => { const rows = [...p.rows]; rows[i] = { ...r, [k]: v }; up(rows); };
              return (
                <tr key={i}>
                  <td><input list="phase-names" className="el" style={{ textAlign: 'left' }} value={r.phase} onChange={e => set('phase', e.target.value)} aria-label={t('f_phase')} /></td>
                  <td><input value={r.si} onChange={e => set('si', e.target.value)} aria-label={t('f_si')} /></td>
                  <td><input value={r.amount} onChange={e => set('amount', e.target.value)} aria-label={t('f_amount')} /></td>
                  <td><input style={{ textAlign: 'left' }} value={r.extra} onChange={e => set('extra', e.target.value)} aria-label={t('f_extra')} /></td>
                  <td><button className="btn sm" type="button" aria-label="remove" onClick={() => up(p.rows.filter((_, j) => j !== i))}>×</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="btn sm dashed" type="button" style={{ alignSelf: 'flex-start' }} onClick={() => up([...p.rows, { phase: '', si: '0', amount: '10', extra: '' }])}>+ {t('f_add_phase')}</button>
    </div>
  );
}

export function Builder({ t, input, setInput, onAdd, phaseNames, selected, setSelected }: Props) {
  const blocks = useMemo(() => splitBlocks(input), [input]);
  const [mode, setMode] = useState<'form' | 'text'>('form');
  const real = blocks.map((b, i) => ({ b, i })).filter(x => x.b.kw);
  const sel = blocks[selected]?.kw ? selected : (real[0]?.i ?? -1);
  const cur = sel >= 0 ? blocks[sel] : null;
  const kwInfo = cur ? ALL_KEYWORDS.find(k => k.name === cur.kw) : undefined;
  const hasForm = cur && ['SOLUTION', 'EQUILIBRIUM_PHASES'].includes(cur.kw);

  const replace = (i: number, text: string) => {
    const next = blocks.slice();
    next[i] = { ...next[i], text };
    setInput(joinBlocks(next));
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const next = blocks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setInput(joinBlocks(next));
    setSelected(j);
  };
  const remove = (i: number) => { setInput(joinBlocks(blocks.filter((_, j) => j !== i))); setSelected(Math.max(0, i - 1)); };

  const sims = [...new Set(real.map(x => x.b.sim))];

  return (
    <main className="view gut">
      <div className="grid builder">
        <div className="panel">
          <div className="panel-h"><h3>{t('b_outline')}</h3></div>
          <div className="seq">
            {!real.length && <p className="note" style={{ padding: 8 }}>{t('b_empty')}</p>}
            {sims.map(s => (
              <div key={s}>
                <div className="sim-h"><span>{t('b_sim')} {s}</span></div>
                {real.filter(x => x.b.sim === s).map(({ b, i }) => {
                  const { n, desc } = headParts(b.head);
                  return (
                    <button key={i} type="button" className={'blk' + (b.kw === 'END' ? ' end' : '')} aria-pressed={i === sel} onClick={() => setSelected(i)}>
                      <span className="grip">⋮⋮</span>
                      <span className="tx"><span className="kwn">{b.kw}{n ? ' ' + n : ''}</span>{desc && b.kw !== 'TITLE' && <span className="lbl">{desc}</span>}{b.kw === 'TITLE' && <span className="lbl">{b.head.replace(/^\S+\s*/, '')}</span>}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="seq-actions"><button className="btn dashed" type="button" onClick={onAdd}>+ {t('b_add')}</button></div>
        </div>

        <div className="panel">
          {cur ? <>
            <div className="panel-h">
              <div><h3 className="mono" style={{ color: 'var(--code-kw)' }}>{cur.kw}</h3><span className="note">{kwInfo?.desc}</span></div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {hasForm && <div className="tabs" role="tablist">
                  <button role="tab" aria-selected={mode === 'form'} onClick={() => setMode('form')}>{t('b_form')}</button>
                  <button role="tab" aria-selected={mode === 'text'} onClick={() => setMode('text')}>{t('b_text')}</button>
                </div>}
                <button className="btn sm" type="button" title={t('b_up')} aria-label={t('b_up')} onClick={() => move(sel, -1)}>↑</button>
                <button className="btn sm" type="button" title={t('b_down')} aria-label={t('b_down')} onClick={() => move(sel, 1)}>↓</button>
                <button className="btn sm" type="button" onClick={() => remove(sel)}>{t('b_delete')}</button>
              </div>
            </div>
            <div className="panel-b">
              {hasForm && mode === 'form' && cur.kw === 'SOLUTION' && <SolutionEditor key={sel} t={t} block={cur} onChange={txt => replace(sel, txt)} />}
              {hasForm && mode === 'form' && cur.kw === 'EQUILIBRIUM_PHASES' && <PhasesEditor key={sel} t={t} block={cur} onChange={txt => replace(sel, txt)} phaseNames={phaseNames} />}
              {(!hasForm || mode === 'text') && <>
                {!hasForm && <p className="note" style={{ marginBottom: 8 }}>{t('b_textonly')} <a href={MANUAL_URL} target="_blank" rel="noopener noreferrer">{t('b_manual')}</a></p>}
                <textarea className="code" spellCheck={false} value={cur.text} rows={Math.min(28, Math.max(6, cur.text.split('\n').length + 1))}
                  onChange={e => replace(sel, e.target.value)} style={{ width: '100%', border: '1px solid var(--line)', resize: 'vertical', whiteSpace: 'pre' }} aria-label={cur.kw} />
              </>}
            </div>
          </> : <div className="panel-b"><p className="note">{t('b_empty')}</p></div>}
        </div>

        <div className="panel preview">
          <div className="panel-h"><h3>{t('b_preview')}</h3><a className="btn sm" href="#editor">{t('nav_editor')} →</a></div>
          <pre className="code" style={{ margin: 12, maxHeight: 640, overflow: 'auto' }}>
            {blocks.map((b, i) => <span key={i} className={'row' + (i === sel ? ' on' : '')}>{b.text}{'\n'}</span>)}
          </pre>
        </div>
      </div>
    </main>
  );
}
