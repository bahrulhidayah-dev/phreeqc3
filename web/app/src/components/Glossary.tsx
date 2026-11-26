import { useState } from 'react';
import { GLOSSARY } from '../lib/glossary';
import { pick, type Lang, type TFn } from '../lib/i18n';

export function Glossary({ t, lang, onClose }: { t: TFn; lang: Lang; onClose: () => void }) {
  const [q, setQ] = useState('');
  const s = q.toLowerCase();
  const list = GLOSSARY.filter(g => !s || g[0].toLowerCase().includes(s) || g[1].some(x => x.toLowerCase().includes(s)) || pick(g[2], lang).toLowerCase().includes(s));
  return (
    <aside className="drawer" role="dialog" aria-label={t('glossary')}>
      <div className="dlg-h"><h2>{t('glossary')}</h2><button className="btn sm" type="button" onClick={onClose}>{t('close')}</button></div>
      <div className="dlg-b">
        <label className="gsearch"><input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('gl_search')} aria-label={t('gl_search')} /></label>
        {list.map(g => (
          <div className="term" key={g[0]}>
            <div><b>{pick(g[1], lang)}</b><span className="sym">{g[0]}</span></div>
            <p>{pick(g[2], lang)}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
