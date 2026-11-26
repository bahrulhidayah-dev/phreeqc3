import type { Lang, TFn } from '../lib/i18n';
import { pick } from '../lib/i18n';
import { GROUPS } from '../lib/keywords';

export interface ExampleInfo { id: string; title: string; database: string }

interface Props {
  t: TFn; lang: Lang; examples: ExampleInfo[]; projectName: string;
  onNew: () => void; onImport: () => void; onOpenFile: () => void; onDrive: () => void;
  onExample: (e: ExampleInfo) => void; onKeyword: (kw: string) => void;
}

export function Home({ t, lang, examples, projectName, onNew, onImport, onOpenFile, onDrive, onExample, onKeyword }: Props) {
  return (
    <main className="view gut">
      <section className="hero">
        <div className="panel start">
          <h1 style={{ fontSize: 26 }}>{t('hero_h')}</h1>
          <p className="muted">{t('hero_p')}</p>
          <div className="start-actions">
            <button className="sa" type="button" onClick={onNew}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 5v14M5 12h14" /></svg>
              <b>{t('new_project')}</b><span>{t('new_project_s')}</span></button>
            <button className="sa" type="button" onClick={onImport}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="3.5" y="3.5" width="17" height="17" rx="2" /><path d="M3.5 9h17M3.5 14.5h17M9 3.5v17" /></svg>
              <b>{t('start_import')}</b><span>{t('start_import_s')}</span></button>
            <button className="sa" type="button" onClick={onOpenFile}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3.5 6.5h6l2 2h9v10h-17z" /></svg>
              <b>{t('open_file')}</b><span>{t('open_file_s')}</span></button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="btn primary" href="#builder">{t('continue')}: {projectName || t('untitled')}</a>
            <button className="btn" type="button" onClick={onDrive}>{t('drive_open')}</button>
          </div>
        </div>
        <div className="panel">
          <div className="panel-h"><h3>{t('examples_h')}</h3><span className="note">{t('examples_s')}</span></div>
          <div className="dblist" style={{ maxHeight: 360 }}>
            {examples.map(e => (
              <button key={e.id} type="button" onClick={() => onExample(e)} title={e.title}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span className="mono" style={{ color: 'var(--accent)', marginRight: 8 }}>{e.id}</span>{e.title.replace(/^Example \d+[A-Z]?\.?--?/i, '') || e.id}
                </span>
                <span className="ds mono">{e.database.replace('@examples/', '')}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="view-head"><h2>{t('caps_h')}</h2><span className="note">{t('caps_s')}</span></div>
        <div className="grid caps">
          {GROUPS.map(g => (
            <div className="panel cap" key={g.id}>
              <div className="cap-h"><h3>{pick(g.name, lang)}</h3><span className="n">{g.keywords.length}</span></div>
              <p>{pick(g.about, lang)}</p>
              <div className="kws">{g.keywords.map(k => <button key={k.name} type="button" className="chip" title={k.desc} onClick={() => onKeyword(k.name)}>{k.name}</button>)}</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
