import { useState } from 'react';
import { GROUPS } from '../lib/keywords';
import { pick, type Lang, type TFn } from '../lib/i18n';

export function KeywordPalette({ t, lang, onPick, onClose }: { t: TFn; lang: Lang; onPick: (kw: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const s = q.toLowerCase();
  return (
    <div className="back" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg" role="dialog" aria-label={t('b_add')}>
        <div className="pal-top">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('search') + ' — SOLUTION, KINETICS, TRANSPORT…'} aria-label={t('search')}
            onKeyDown={e => { if (e.key === 'Escape') onClose(); }} />
          <button className="btn sm" type="button" onClick={onClose}>{t('close')}</button>
        </div>
        <div className="pal-body">
          {GROUPS.map(g => {
            const ks = g.keywords.filter(k => !s || k.name.toLowerCase().includes(s) || k.desc.toLowerCase().includes(s));
            if (!ks.length) return null;
            return [
              <div className="pal-grp" key={g.id}>{pick(g.name, lang)}</div>,
              ...ks.map(k => <button className="pal-item" type="button" key={k.name} onClick={() => onPick(k.name)}><b>{k.name}</b><span>{k.desc}</span></button>),
            ];
          })}
        </div>
      </div>
    </div>
  );
}
