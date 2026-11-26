import { useEffect, useRef, useState } from 'react';
import { LANGS, type Lang, type TFn } from '../lib/i18n';

export type Theme = 'light' | 'dark' | 'system';
export type View = 'home' | 'builder' | 'editor' | 'results' | 'database';

const MANUAL = 'https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3.htm';
export const SOURCE = 'https://github.com/usgs-coupled/phreeqc3';
const USGS = 'https://www.usgs.gov/software/phreeqc-version-3';

const I = {
  globe: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6.2" /><path d="M1.8 8h12.4M8 1.8c1.8 1.9 2.6 3.9 2.6 6.2S9.8 12.3 8 14.2C6.2 12.3 5.4 10.3 5.4 8S6.2 3.7 8 1.8z" /></svg>,
  sun: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="3" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" /></svg>,
  moon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" /></svg>,
  sys: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1.8" y="2.5" width="12.4" height="8.5" rx="1.2" /><path d="M5.5 13.5h5M8 11v2.5" /></svg>,
  book: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M3 2.5h7.5a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2z" /><path d="M3 11.5a2 2 0 0 1 2-2h7.5" /></svg>,
  doc: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M4 1.8h5.2L12.5 5v9.2H4z" /><path d="M9 1.8V5h3.5M6 8h4.5M6 10.5h4.5" /></svg>,
  help: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="8" r="6.2" /><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.6M8 11.4v.4" /></svg>,
  home: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 7.2 8 2.5l6 4.7V14H2z" /><path d="M6.3 14V9.8h3.4V14" /></svg>,
  builder: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2.5" width="12" height="3" rx="1" /><rect x="2" y="6.5" width="12" height="3" rx="1" /><rect x="2" y="10.5" width="12" height="3" rx="1" /></svg>,
  editor: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" /></svg>,
  results: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2 14h12M4 11.5V8M7 11.5V4.5M10 11.5V7M13 11.5V9.5" /></svg>,
  db: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><ellipse cx="8" cy="3.8" rx="5.5" ry="2" /><path d="M2.5 3.8v8.4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V3.8M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></svg>,
};

export function Logo() {
  return (
    <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
      <defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5FE0D3" /><stop offset="1" stopColor="#1C9AAA" /></linearGradient></defs>
      <rect x="1" y="1" width="46" height="46" rx="12" fill="rgba(255,255,255,.08)" stroke="rgba(234,248,249,.25)" />
      <path d="M24 7c6 8.2 11 14.4 11 21.2A11 11 0 0 1 13 28.2C13 21.4 18 15.2 24 7z" fill="url(#lg1)" />
      <path d="M24 21.5l5 2.9v5.8l-5 2.9-5-2.9v-5.8z" fill="none" stroke="#063B45" strokeWidth="1.6" />
      <circle cx="24" cy="21.5" r="1.5" fill="#063B45" /><circle cx="29" cy="30.2" r="1.5" fill="#063B45" /><circle cx="19" cy="30.2" r="1.5" fill="#063B45" />
    </svg>
  );
}

interface Props {
  t: TFn; lang: Lang; setLang: (l: Lang) => void; theme: Theme; setTheme: (t: Theme) => void;
  view: View; openGlossary: () => void; openKeywords: () => void;
}

function Menu({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return (
    <div className="rel" ref={ref}>
      <button className="hbtn" type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}>{icon}<span className="txt">{label}</span></button>
      {open && <div className="menu" role="menu" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  );
}

export function Header({ t, lang, setLang, theme, setTheme, view, openGlossary, openKeywords }: Props) {
  const nav: [View, string, React.ReactNode][] = [
    ['home', t('nav_home'), I.home], ['builder', t('nav_builder'), I.builder], ['editor', t('nav_editor'), I.editor],
    ['results', t('nav_results'), I.results], ['database', t('nav_database'), I.db],
  ];
  return (
    <header className="hdr">
      <svg className="hdr-waves" viewBox="0 0 1200 140" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 96c120-26 240-26 360 0s240 26 360 0 240-26 360 0 120 13 120 13" fill="none" stroke="rgba(95,224,211,.22)" strokeWidth="1.5" />
        <path d="M0 116c140-20 280-20 420 0s280 20 420 0 240-18 360-6" fill="none" stroke="rgba(95,224,211,.14)" strokeWidth="1.5" />
        <g fill="none" stroke="rgba(234,248,249,.09)"><path d="M1080 20l18 10v21l-18 10-18-10V30z" /><path d="M1135 50l14 8v16l-14 8-14-8V58z" /></g>
      </svg>
      <div className="hdr-in gut">
        <div className="hdr-row">
          <a className="brand" href="#home">
            <Logo />
            <div style={{ minWidth: 0 }}>
              <div className="brand-name">Aquos <span>Geochemistry</span></div>
              <div className="brand-tag">{t('tagline')}</div>
            </div>
          </a>
          <div className="util">
            <label className="lang-wrap" title={t('language')}>
              {I.globe}
              <select className="hsel" value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('language')}>
                {LANGS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </label>
            <div className="theme-seg" role="group" aria-label="Theme">
              {([['light', I.sun, t('theme_light')], ['dark', I.moon, t('theme_dark')], ['system', I.sys, t('theme_system')]] as const).map(([id, icon, label]) => (
                <button key={id} type="button" title={label} aria-label={label} aria-pressed={theme === id} onClick={() => setTheme(id)}>{icon}</button>
              ))}
            </div>
            <button className="hbtn" type="button" onClick={openGlossary}>{I.book}<span className="txt">{t('glossary')}</span></button>
            <Menu label={t('docs')} icon={I.doc}>
              <a href={MANUAL} target="_blank" rel="noopener noreferrer"><b>{t('doc_manual')}</b><span>{t('doc_manual_s')}</span></a>
              <a href={SOURCE} target="_blank" rel="noopener noreferrer"><b>{t('doc_source')}</b><span>{t('doc_source_s')}</span></a>
              <a href={USGS} target="_blank" rel="noopener noreferrer"><b>{t('doc_usgs')}</b><span>{t('doc_usgs_s')}</span></a>
              <hr />
              <a href={SOURCE + '/blob/master/doc/NOTICE.TXT'} target="_blank" rel="noopener noreferrer"><b>{t('doc_notice')}</b><span>NOTICE.TXT</span></a>
            </Menu>
            <Menu label={t('help')} icon={I.help}>
              <a href="#home"><b>{t('help_start')}</b><span>{t('help_start_s')}</span></a>
              <button type="button" onClick={openKeywords}><b>{t('help_keywords')}</b><span>{t('help_keywords_s')}</span></button>
              <button type="button" onClick={openGlossary}><b>{t('glossary')}</b><span>{t('help_glossary_s')}</span></button>
              <hr />
              <a href={MANUAL} target="_blank" rel="noopener noreferrer"><b>{t('doc_manual')}</b><span>{t('doc_manual_s')}</span></a>
              <span className="note" style={{ padding: '6px 10px' }}>{t('help_keys')}</span>
            </Menu>
          </div>
        </div>
        <nav className="hnav" aria-label="Main">
          {nav.map(([id, label, icon]) => <a key={id} href={'#' + id} aria-current={view === id ? 'page' : undefined}>{icon}{label}</a>)}
        </nav>
      </div>
    </header>
  );
}

export const MANUAL_URL = MANUAL;
