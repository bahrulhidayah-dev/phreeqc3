import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { makeT, type Lang } from './lib/i18n';
import { Header, Logo, SOURCE, type Theme, type View } from './components/Header';
import { Home, type ExampleInfo } from './components/Home';
import { Builder } from './components/Builder';
import { InputEditor, type Message } from './components/InputEditor';
import { Results, type RunOutcome, type TableChart } from './components/Results';
import { DatabaseView } from './components/DatabaseView';
import { ImportDialog } from './components/ImportDialog';
import { Glossary } from './components/Glossary';
import { KeywordPalette } from './components/KeywordPalette';
import { Lab, defaultLab, type LabState } from './components/serp/Lab';
import type { ThemeColors } from './components/Chart';
import type { ChartStyle } from './components/chartStyle';
import { fetchText, runPhreeqc, cancelRun } from './engine/client';
import { parseOutput, parseSel } from './lib/parseOutput';
import { fixPunchHeadings } from './lib/punchFix';
import { transformUserGraphs, readUserGraph } from './lib/userGraph';
import { ALL_KEYWORDS } from './lib/keywords';
import { splitBlocks, joinBlocks, summarize } from './lib/inputModel';
import { parseDatabase, type DbEntry } from './lib/dbParse';
import { autosave, loadAutosave, newProject, parseProject, prefs, serializeProject, type Project } from './lib/project';
import { safeName, saveText } from './lib/download';
import { connectDrive, disconnectDrive, driveConfigured, driveConnected, listProjects, readFile, saveFile, type DriveFile } from './lib/drive';

interface Manifest { databases: string[]; examples: ExampleInfo[]; exampleFiles: string[] }
type ProjectX = Project & { tableCharts?: TableChart[]; driveId?: string; lab?: LabState };

/** Absolute path in the engine's file system for a path written relative to its work folder. */
function resolvePath(p: string) {
  const parts = ('/work/' + p.replace(/\\/g, '/')).split('/');
  const out: string[] = [];
  for (const x of parts) { if (x === '..') out.pop(); else if (x && x !== '.') out.push(x); }
  return '/' + out.join('/');
}

const VIEWS: View[] = ['home', 'builder', 'editor', 'results', 'database', 'lab'];
const viewFromHash = (): View => { const h = location.hash.replace('#', '') as View; return VIEWS.includes(h) ? h : 'home'; };

function readColors(): ThemeColors {
  const cs = getComputedStyle(document.documentElement);
  const v = (k: string, d: string) => cs.getPropertyValue(k).trim() || d;
  return { bg: v('--surface', '#fff'), ink: v('--ink', '#14232B'), muted: v('--muted', '#5A6B73'), line: v('--line', '#D8E1E4') };
}

export default function App() {
  const [lang, setLangS] = useState<Lang>(() => (prefs.get('lang', 'en') as Lang));
  const [theme, setThemeS] = useState<Theme>(() => (prefs.get('theme', 'system') as Theme));
  const [view, setView] = useState<View>(viewFromHash);
  const [manifest, setManifest] = useState<Manifest>({ databases: ['phreeqc.dat'], examples: [], exampleFiles: [] });
  const [project, setProject] = useState<ProjectX>(() => loadAutosave() ?? newProject());
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState('');
  const [dialog, setDialog] = useState<'' | 'import' | 'import-p' | 'palette' | 'drive'>('');
  const [gloss, setGloss] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [colors, setColors] = useState<ThemeColors>(readColors);
  const [names, setNames] = useState<string[]>([]);
  const [insert, setInsert] = useState<{ text: string; n: number } | null>(null);
  const [selected, setSelected] = useState(0);
  const [driveOn, setDriveOn] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const t = useMemo(() => makeT(lang), [lang]);

  const toast = useCallback((m: string) => { setToastMsg(m); window.clearTimeout((toast as unknown as { h?: number }).h); (toast as unknown as { h?: number }).h = window.setTimeout(() => setToastMsg(''), 3600); }, []);

  // language, theme, routing
  const setLang = (l: Lang) => { setLangS(l); prefs.set('lang', l); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setTheme = (th: Theme) => { setThemeS(th); prefs.set('theme', th); };
  useEffect(() => {
    if (theme === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', theme);
    setColors(readColors());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setColors(readColors());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [theme]);
  useEffect(() => { const on = () => setView(viewFromHash()); addEventListener('hashchange', on); return () => removeEventListener('hashchange', on); }, []);
  const go = (v: View) => { if (location.hash !== '#' + v) location.hash = v; setView(v); };

  // manifest of databases and examples (fetched, never linked)
  useEffect(() => { fetch(import.meta.env.BASE_URL + 'manifest.json').then(r => r.json()).then(setManifest).catch(() => toast('manifest.json missing: run npm run sync')); }, [toast]);

  // autosave
  useEffect(() => { const h = setTimeout(() => autosave(project), 400); return () => clearTimeout(h); }, [project]);
  const update = (patch: Partial<ProjectX>) => setProject(p => ({ ...p, ...patch }));
  const setInput = useCallback((input: string) => setProject(p => (p.input === input ? p : { ...p, input })), []);

  // names for completion: phases of the selected database
  const dbPath = project.database;
  const loadDb = useCallback(async (db: string, p: ProjectX = project): Promise<{ name: string; text: string }> => {
    if (db.startsWith('@custom/') && p.customDatabase) return { name: p.customDatabase.name, text: p.customDatabase.text };
    if (db.startsWith('@examples/')) { const f = db.slice(10); return { name: f, text: await fetchText('examples/' + f) }; }
    return { name: db.split('/').pop()!, text: await fetchText('databases/' + db) };
  }, [project]);
  useEffect(() => {
    let live = true;
    loadDb(dbPath).then(d => { if (live) setNames([...new Set(parseDatabase(d.text).filter(e => e.kind === 'PHASES' || e.kind === 'SOLUTION_MASTER_SPECIES').map(e => e.name))]); }).catch(() => {});
    return () => { live = false; };
  }, [dbPath]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- run ----
  const run = useCallback(async () => {
    const p = project;
    setRunning(true); setRunError(null);
    try {
      const db = await loadDb(p.database, p);
      const files: Record<string, string> = { ...p.files };
      // data files of the official examples that the input mentions (tsv, dat, INCLUDE$ files)
      for (const f of manifest.exampleFiles) {
        if (!files[f] && !/^ex\d+[a-z]*$/.test(f) && new RegExp(`(^|[\\s/])${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'm').test(p.input)) {
          try { files[f] = await fetchText('examples/' + f); } catch { /* optional */ }
        }
      }
      // a DATABASE line inside the input: provide that file at the path it names
      const dbLine = splitBlocks(p.input).find(b => b.kw === 'DATABASE');
      if (dbLine) {
        const path = dbLine.head.split(/\s+/)[1] ?? '';
        const base = path.split(/[\\/]/).pop() ?? '';
        const hit = manifest.databases.find(d => d.split('/').pop()?.toLowerCase() === base.toLowerCase());
        if (path && hit) files[resolvePath(path)] = (await loadDb(hit, p)).text;
      }
      const tr = transformUserGraphs(p.input);
      const res = await runPhreeqc({ input: tr.input, database: db, files });
      const parsed = parseOutput(res.output);
      const graphs = tr.graphs.map(g => readUserGraph(g, { ...files, ...res.files })).filter(g => g.series.length);
      const ugFiles = new Set(tr.graphs.flatMap(g => g.parts.map(x => x.file)));
      const tables = Object.entries(res.files).filter(([f, txt]) => !ugFiles.has(f) && !(f in files) && txt.trim() && /\t|\s{2,}/.test(txt.split('\n')[0]))
        .map(([file, txt]) => ({ file, table: parseSel(txt) })).filter(x => x.table.columns.length && x.table.rows.length);
      setOutcome({ run: res, parsed, graphs, tables, database: db.name, at: Date.now() });
      if (view !== 'results' && view !== 'editor') go('results');
      if (view === 'editor' && res.ok && !parsed.errors.length) go('results');
    } catch (e) {
      if ((e as Error).message !== 'cancelled') { const msg = String((e as Error).message || e); setRunError(msg); toast(msg); }
    } finally { setRunning(false); }
  }, [project, manifest, loadDb, view, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const messages: Message[] | null = useMemo(() => {
    if (!outcome) return null;
    const errs = [...new Set([...outcome.parsed.errors, ...outcome.run.errors.split('\n').filter(l => /^ERROR:/.test(l)).map(l => l.replace(/^ERROR:\s*/, ''))])];
    return [...errs.map(text => ({ kind: 'error' as const, text })), ...outcome.parsed.warnings.map(text => ({ kind: 'warning' as const, text }))];
  }, [outcome]);

  // keyboard shortcuts
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveLocal(); }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- project files ----
  const projName = project.name || t('untitled');
  const saveLocal = () => { saveText(serializeProject(project), safeName(projName) + '.aquos', 'application/json'); toast(t('t_saved_local')); };
  const savePqi = () => {
    const dbName = project.database.split('/').pop();
    const head = splitBlocks(project.input).some(b => b.kw === 'DATABASE') ? '' : `# Database used in Aquos Geochemistry: ${dbName}\n`;
    saveText(head + project.input, safeName(projName) + '.pqi');
  };
  const replaceInput = (name: string, text: string, files: Record<string, string> = {}) => {
    setProject(p => ({ ...p, name: name.replace(/\.(pqi|phr|in|txt|inp)$/i, ''), input: text.replace(/\r\n?/g, '\n'), files: { ...files }, tableCharts: [], charts: {}, driveId: undefined }));
    setOutcome(null); setSelected(0);
  };
  const openFiles = async (fl: FileList | null) => {
    const files = [...(fl ?? [])];
    if (!files.length) return;
    const main = files[0];
    const text = await main.text();
    if (/\.aquos$/i.test(main.name) || text.trimStart().startsWith('{')) {
      const p = parseProject(text);
      if (!p) return toast(t('t_badfile'));
      setProject(p); setOutcome(null); setSelected(0);
    } else if (/\.(xlsx|xls|csv)$/i.test(main.name)) {
      setDialog('import'); return;
    } else {
      const extra: Record<string, string> = {};
      for (const f of files.slice(1)) extra[f.name] = await f.text();
      replaceInput(main.name, text, extra);
      go('editor');
    }
    toast(t('t_opened', { name: main.name }));
  };
  const openExample = async (e: ExampleInfo) => {
    try {
      const text = await fetchText('examples/' + e.id);
      replaceInput(e.id, text);
      const db = e.database.startsWith('@examples/') ? e.database : (manifest.databases.find(d => d === e.database) ?? 'phreeqc.dat');
      update({ database: db, name: e.id });
      go('builder');
      toast(t('t_opened', { name: e.id }));
    } catch (err) { toast(String(err)); }
  };
  const newProj = () => { setProject(newProject()); setOutcome(null); setSelected(0); go('builder'); };

  // add a keyword template: after the selected block in the builder, at the cursor in the editor
  const addKeyword = (kw: string) => {
    const k = ALL_KEYWORDS.find(x => x.name === kw);
    if (!k) return;
    setDialog('');
    if (view === 'editor') { setInsert({ text: k.template, n: Date.now() }); toast(t('t_added', { kw })); return; }
    const blocks = splitBlocks(project.input);
    let at = blocks[selected]?.kw ? selected + 1 : blocks.length;
    // keep END last in its simulation
    if (blocks[at - 1]?.kw === 'END') at -= 1;
    // PHREEQC accepts DATABASE only as the first keyword of the input
    if (kw === 'DATABASE') at = 0;
    const nb = { kw, head: k.template.split('\n')[0], text: k.template.replace(/\n$/, ''), sim: 0, startLine: 0 };
    const next = [...blocks.slice(0, at), nb, ...blocks.slice(at)];
    setInput(joinBlocks(next).replace(/\n{3,}/g, '\n\n'));
    setSelected(at);
    if (view !== 'builder') go('builder');
    toast(t('t_added', { kw }));
  };

  const insertPhase = (e: DbEntry) => {
    const blocks = splitBlocks(project.input);
    let idx = -1;
    for (let i = blocks.length - 1; i >= 0; i--) if (blocks[i].kw === 'EQUILIBRIUM_PHASES') { idx = i; break; }
    const line = `    ${e.name.padEnd(14)}0.0     10.0`;
    if (idx >= 0) blocks[idx] = { ...blocks[idx], text: blocks[idx].text.replace(/\n*$/, '') + '\n' + line };
    else {
      const endIdx = blocks.map(b => b.kw).lastIndexOf('END');
      const nb = { kw: 'EQUILIBRIUM_PHASES', head: 'EQUILIBRIUM_PHASES 1', text: 'EQUILIBRIUM_PHASES 1\n' + line, sim: 0, startLine: 0 };
      blocks.splice(endIdx >= 0 ? endIdx : blocks.length, 0, nb);
    }
    setInput(joinBlocks(blocks));
    toast(t('t_added', { kw: e.name }));
  };

  // ---- Google Drive ----
  const driveGuard = () => { if (!driveConfigured()) { toast(t('drive_unconfigured')); return false; } return true; };
  const driveSave = async () => {
    if (!driveGuard()) return;
    try {
      const id = await saveFile(safeName(projName) + '.aquos', serializeProject(project), project.driveId);
      update({ driveId: id }); setDriveOn(true); toast(t('drive_saved'));
    } catch (e) { toast(String((e as Error).message)); }
  };
  const driveOpen = async () => {
    if (!driveGuard()) return;
    setDialog('drive'); setDriveFiles(null);
    try { await connectDrive(); setDriveOn(true); setDriveFiles(await listProjects()); } catch (e) { setDialog(''); toast(String((e as Error).message)); }
  };
  const driveLoad = async (f: DriveFile) => {
    try {
      const p = parseProject(await readFile(f.id));
      if (!p) return toast(t('t_badfile'));
      setProject({ ...p, driveId: f.id }); setOutcome(null); setDialog(''); toast(t('t_opened', { name: f.name })); go('builder');
    } catch (e) { toast(String((e as Error).message)); }
  };
  const driveToggle = async () => {
    if (driveOn || driveConnected()) { disconnectDrive(); setDriveOn(false); return; }
    if (!driveGuard()) return;
    try { await connectDrive(); setDriveOn(true); } catch (e) { toast(String((e as Error).message)); }
  };

  const sum = useMemo(() => summarize(project.input), [project.input]);
  const dbGroups = useMemo(() => {
    const g = new Map<string, string[]>();
    for (const d of manifest.databases) { const dir = d.includes('/') ? d.slice(0, d.lastIndexOf('/') + 1) : ''; g.set(dir, [...(g.get(dir) ?? []), d]); }
    return [...g.entries()];
  }, [manifest.databases]);

  const chooseDb = async (v: string) => {
    if (v === '@upload') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.dat,.txt';
      inp.onchange = async () => { const f = inp.files?.[0]; if (f) { update({ database: '@custom/' + f.name, customDatabase: { name: f.name, text: await f.text() } }); toast(t('t_db', { db: f.name })); } };
      inp.click();
      return;
    }
    update({ database: v }); toast(t('t_db', { db: v.split('/').pop()! }));
  };

  return (
    <div className="page">
      <Header t={t} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} view={view} openGlossary={() => setGloss(true)} openKeywords={() => setDialog('palette')} />

      <div className="pbar">
        <div className="pbar-in gut" style={{ maxWidth: 1360, margin: '0 auto' }}>
          <div className="proj">
            <input className="projname" value={project.name} placeholder={t('untitled')} onChange={e => update({ name: e.target.value })} aria-label={t('project_name')} />
            <span>{sum.simulations} {t('simulations')} · {sum.blocks} {t('blocks')} · {t('autosaved')}</span>
          </div>
          <div className="rel">
            <button className="btn sm" type="button" aria-expanded={saveOpen} onClick={() => setSaveOpen(o => !o)}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M2.5 2.5h9l2 2v9h-11z" /><path d="M5 2.5v3.5h5.5V2.5M4.5 13.5V9h7v4.5" /></svg>{t('save')}</button>
            {saveOpen && <div className="menu" style={{ left: 0, right: 'auto' }} onMouseLeave={() => setSaveOpen(false)} onClick={() => setSaveOpen(false)}>
              <button type="button" onClick={saveLocal}><b>{t('save_device')}</b><span>{t('save_device_s')}</span></button>
              <button type="button" onClick={savePqi}><b>{t('save_pqi')}</b><span>{t('save_pqi_s')}</span></button>
              <button type="button" onClick={() => fileRef.current?.click()}><b>{t('open_file')}</b><span>{t('open_file_s')}</span></button>
              <hr />
              <button type="button" onClick={driveSave}><b>{t('drive_save')}</b><span>{driveConfigured() ? 'drive.file' : t('drive_unconfigured')}</span></button>
              <button type="button" onClick={driveOpen}><b>{t('drive_open')}</b><span>.aquos</span></button>
              <hr />
              <button type="button" onClick={newProj}><b>{t('new_project')}</b><span>{t('new_project_s')}</span></button>
            </div>}
          </div>
          <button className={'drive' + (driveOn ? ' on' : '')} type="button" onClick={driveToggle} title={driveOn ? t('drive_disconnect') : t('drive_open')}><span className="dot" />{driveOn ? t('drive_on') : t('drive_off')}</button>
          <button className="btn sm" type="button" onClick={() => setDialog('import')}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M2 6h12M2 10h12M6 2v12" /></svg>{t('import')}</button>
          <label className="dbpick"><span>{t('database_lbl')}</span>
            <select value={project.database} onChange={e => chooseDb(e.target.value)}>
              {dbGroups.map(([dir, ds]) => <optgroup key={dir} label={'database/' + dir}>{ds.map(d => <option key={d} value={d}>{d.split('/').pop()}</option>)}</optgroup>)}
              {project.database.startsWith('@') && <option value={project.database}>{project.database.split('/').pop()}</option>}
              <option value="@upload">{t('db_custom')}</option>
            </select></label>
          {running
            ? <button className="btn primary" type="button" onClick={() => { cancelRun(); setRunning(false); }}>■ {t('stop')}</button>
            : <button className="btn primary" type="button" onClick={run}><svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z" fill="currentColor" /></svg>{t('run')}</button>}
        </div>
      </div>
      <input ref={fileRef} type="file" hidden multiple accept=".aquos,.pqi,.phr,.in,.txt,.inp,.json,.xlsx,.csv,.dat,.tsv" onChange={e => { openFiles(e.target.files); e.target.value = ''; }} />

      {view === 'home' && <Home t={t} lang={lang} examples={manifest.examples} projectName={project.name} onNew={newProj} onImport={() => setDialog('import')}
        onOpenFile={() => fileRef.current?.click()} onDrive={driveOpen} onExample={openExample} onKeyword={addKeyword} />}
      {view === 'builder' && <Builder t={t} input={project.input} setInput={setInput} onAdd={() => setDialog('palette')} phaseNames={names} selected={selected} setSelected={setSelected} />}
      {view === 'editor' && <InputEditor t={t} lang={lang} input={project.input} setInput={setInput} names={names} onRun={run} messages={messages} insert={insert} onInsert={addKeyword} jumpTo={null} />}
      {view === 'results' && <Results t={t} colors={colors} outcome={outcome} running={running} projectName={projName} charts={project.charts}
        saveChart={(id, s: ChartStyle) => setProject(p => ({ ...p, charts: { ...p.charts, [id]: s } }))}
        tableCharts={project.tableCharts ?? []} setTableCharts={c => update({ tableCharts: c })} toast={toast}
        runError={runError} onRun={run} input={project.input}
        onFixHeadings={() => { const r = fixPunchHeadings(project.input); if (r.fixed) { update({ input: r.text }); toast(t('ph_done', { n: r.fixed })); } }} />}
      {view === 'lab' && <Lab t={t} lang={lang} colors={colors} toast={toast}
        lab={{ ...defaultLab(), ...project.lab }}
        setLab={f => setProject(p => ({ ...p, lab: f({ ...defaultLab(), ...p.lab }) }))}
        onOpen={(name, input, db) => { replaceInput(name, input); update({ database: db }); go('builder'); toast(t('t_opened', { name })); }} />}
      {view === 'database' && <DatabaseView t={t} databases={manifest.databases} current={project.database} onUse={d => { update({ database: d }); toast(t('t_db', { db: d })); }} onInsert={insertPhase} />}

      <footer className="foot">
        <div className="foot-in gut">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 760 }}>
            <div style={{ width: 34, flex: 'none', filter: 'saturate(.9)' }}><Logo /></div>
            <div>
              <div><b>Aquos Geochemistry</b> · {t('footer_dev')} <b>Rul Hidayah</b></div>
              <div>{t('footer_engine')}</div>
              <div>{t('footer_mod')}</div>
            </div>
          </div>
          <div className="foot-links">
            <a href={SOURCE} target="_blank" rel="noopener noreferrer">{t('footer_source')}: usgs-coupled/phreeqc3</a>
            <a href={SOURCE + '/blob/master/doc/NOTICE.TXT'} target="_blank" rel="noopener noreferrer">NOTICE.TXT</a>
            <a href="https://water.usgs.gov/water-resources/software/PHREEQC/documentation/phreeqc3-html/phreeqc3.htm" target="_blank" rel="noopener noreferrer">{t('doc_manual')}</a>
          </div>
        </div>
      </footer>

      {(dialog === 'import' || dialog === 'import-p') && <ImportDialog t={t} toast={toast} initialTab={dialog === 'import-p' ? 'p' : 'x'} onClose={() => setDialog('')}
        onSolutions={(text, mode, db) => {
          const next = mode === 'replace' ? `TITLE Imported samples\n${text}\nEND\n` : (() => {
            const bl = splitBlocks(project.input); const endIdx = bl.map(b => b.kw).lastIndexOf('END');
            const lines = joinBlocks(bl.slice(0, endIdx >= 0 ? endIdx : bl.length)).replace(/\n*$/, '\n') + text + (endIdx >= 0 ? '\n' + joinBlocks(bl.slice(endIdx)) : '\nEND\n');
            return lines;
          })();
          setInput(next);
          if (db && manifest.databases.includes(db)) update({ database: db });
          setDialog(''); go('builder'); toast(t('t_created', { name: 'SOLUTION' }));
        }}
        onInput={(name, text, files, v) => { replaceInput(name, text, files); setDialog(''); go(v); toast(t('t_opened', { name })); }} />}
      {dialog === 'palette' && <KeywordPalette t={t} lang={lang} onPick={addKeyword} onClose={() => setDialog('')} />}
      {dialog === 'drive' && <div className="back" onMouseDown={e => { if (e.target === e.currentTarget) setDialog(''); }}>
        <div className="dlg" role="dialog" style={{ width: 'min(560px,100%)' }}>
          <div className="dlg-h"><h2>{t('drive_files')}</h2><button className="btn sm" type="button" onClick={() => setDialog('')}>{t('close')}</button></div>
          <div className="dlg-b dblist">
            {!driveFiles && <p className="note">{t('db_loading')}</p>}
            {driveFiles && !driveFiles.length && <p className="note">{t('drive_none')}</p>}
            {driveFiles?.map(f => <button key={f.id} type="button" onClick={() => driveLoad(f)}><span>{f.name}</span><span className="ds">{new Date(f.modifiedTime).toLocaleString(lang)}</span></button>)}
          </div>
        </div>
      </div>}
      {gloss && <Glossary t={t} lang={lang} onClose={() => setGloss(false)} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      {running && <div className="runbar" aria-hidden="true" />}
    </div>
  );
}

