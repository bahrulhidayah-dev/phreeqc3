import { useMemo, useState } from 'react';
import type { RunResult } from '../engine/types';
import type { ParsedOutput, SelTable, Calc } from '../lib/parseOutput';
import { isMissing } from '../lib/parseOutput';
import type { GraphData } from '../lib/userGraph';
import type { TFn } from '../lib/i18n';
import type { ChartStyle } from './chartStyle';
import { ChartPanel } from './ChartPanel';
import type { PlotSeries, ThemeColors } from './Chart';
import { safeName, saveText, saveXLSX, toCSV } from '../lib/download';

export interface TableChart { id: string; file: string; x: string; ys: string[] }
export interface RunOutcome { run: RunResult; parsed: ParsedOutput; graphs: GraphData[]; tables: { file: string; table: SelTable }[]; database: string; at: number }

interface Props {
  t: TFn; colors: ThemeColors; outcome: RunOutcome | null; running: boolean; projectName: string;
  charts: Record<string, ChartStyle>; saveChart: (id: string, s: ChartStyle) => void;
  tableCharts: TableChart[]; setTableCharts: (c: TableChart[]) => void; toast: (m: string) => void;
}

type Tab = 'charts' | 'solutions' | 'tables' | 'output' | 'messages';

function siClass(si: number) { return si > 0.2 ? 'sup' : si < -0.2 ? 'und' : 'equ'; }

function SIChart({ t, rows, colors }: { t: TFn; rows: Calc['si']; colors: ThemeColors }) {
  const sorted = [...rows].sort((a, b) => b.si - a.si);
  const max = Math.max(1, ...sorted.map(r => Math.abs(r.si)));
  const W = 640, rowH = 22, H = sorted.length * rowH + 30, mid = 340, half = 250;
  const cs = getComputedStyle(document.documentElement);
  const col = (k: string) => cs.getPropertyValue(k).trim() || '#888';
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('r_si')}>
      <line x1={mid} x2={mid} y1={4} y2={H - 22} stroke={colors.muted} />
      {sorted.map((r, i) => {
        const y = 6 + i * rowH, w = Math.abs(r.si) / max * half, cls = siClass(r.si);
        const fill = cls === 'sup' ? col('--super') : cls === 'und' ? col('--under') : col('--eq');
        return (
          <g key={r.phase}>
            <text x={mid - half - 8} y={y + 14} textAnchor="end" fontSize={12} fill={colors.ink}>{r.phase}</text>
            <rect x={r.si >= 0 ? mid : mid - w} y={y + 3} width={Math.max(1, w)} height={rowH - 8} rx={2} fill={fill} />
            {w > half * 0.75
              ? <text x={r.si >= 0 ? mid + w - 4 : mid - w + 4} y={y + 14} textAnchor={r.si >= 0 ? 'end' : 'start'} fontSize={11} fill="#fff">{r.si.toFixed(2)}</text>
              : <text x={r.si >= 0 ? mid + w + 4 : mid - w - 4} y={y + 14} textAnchor={r.si >= 0 ? 'start' : 'end'} fontSize={11} fill={colors.muted}>{r.si.toFixed(2)}</text>}
          </g>
        );
      })}
      <text x={mid} y={H - 6} textAnchor="middle" fontSize={11} fill={colors.muted}>{t('si_note')}</text>
    </svg>
  );
}

function Solutions({ t, parsed, colors }: { t: TFn; parsed: ParsedOutput; colors: ThemeColors }) {
  const calcs = parsed.simulations.flatMap(s => s.calcs.map((c, i) => ({ s, c, key: `${s.n}-${i}` }))).filter(x => x.c.description.pH != null || x.c.si.length);
  const [key, setKey] = useState(calcs[0]?.key ?? '');
  const cur = calcs.find(x => x.key === key) ?? calcs[0];
  const [el, setEl] = useState('');
  if (!cur) return <p className="note">{t('r_none')}</p>;
  const d = cur.c.description;
  const groups = cur.c.species.filter(g => g.element);
  const g = groups.find(x => x.element === el) ?? groups[0];
  const fmt = (v: number | undefined, p = 3) => (v == null || !Number.isFinite(v) ? '–' : Math.abs(v) < 1e-3 && v !== 0 ? v.toExponential(2) : String(+v.toPrecision(p + 1)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <label className="field" style={{ maxWidth: 560 }}><span className="lab">{t('r_calc')}</span>
        <select value={cur.key} onChange={e => setKey(e.target.value)}>
          {calcs.map(x => <option key={x.key} value={x.key}>{t('b_sim')} {x.s.n}{x.s.title ? ` (${x.s.title.slice(0, 40)})` : ''} · {x.c.heading}</option>)}
        </select></label>
      <div className="grid kpis">
        <div className="panel kpi"><span className="lbl">{t('k_ph')}</span><span className="val">{fmt(d.pH)}</span></div>
        <div className="panel kpi"><span className="lbl">{t('k_pe')}</span><span className="val">{fmt(d.pe)}</span></div>
        <div className="panel kpi"><span className="lbl">{t('k_is')}</span><span className="val">{fmt(d.ionicStrength)}<small>mol/kgw</small></span></div>
        <div className="panel kpi"><span className="lbl">{t('k_temp')}</span><span className="val">{fmt(d.temperature)}<small>°C</small></span></div>
        <div className="panel kpi"><span className="lbl">{t('k_cb')}</span><span className="val">{fmt(d.percentError, 2)}<small>%</small></span>
          {d.percentError != null && <span className="st" style={{ color: Math.abs(d.percentError) > 5 ? 'var(--bad)' : 'var(--good)' }}>{Math.abs(d.percentError) > 5 ? t('k_bad') : t('k_ok')}</span>}</div>
      </div>
      <div className="grid res">
        {cur.c.si.length > 0 && <div className="panel">
          <div className="panel-h"><h3>{t('r_si')}</h3>
            <div className="legend"><span><i className="sw" style={{ background: 'var(--super)' }} />{t('si_sup')}</span><span><i className="sw" style={{ background: 'var(--eq)' }} />{t('si_eq')}</span><span><i className="sw" style={{ background: 'var(--under)' }} />{t('si_und')}</span></div>
            <button className="btn sm" type="button" onClick={() => saveText(toCSV(['phase', 'SI', 'log IAP', 'log K', 'formula'], cur.c.si.map(r => [r.phase, r.si, r.logIAP, r.logK, r.formula])), 'saturation_indices.csv', 'text/csv')}>CSV</button>
          </div>
          <div className="panel-b"><SIChart t={t} rows={cur.c.si} colors={colors} /></div>
        </div>}
        {groups.length > 0 && g && <div className="panel">
          <div className="panel-h"><h3>{t('r_species')}</h3>
            <select value={g.element} onChange={e => setEl(e.target.value)} aria-label={t('r_element')}>{groups.map(x => <option key={x.element}>{x.element}</option>)}</select></div>
          <div className="panel-b">
            <p className="note">{t('r_element')} {g.element}: {g.total.toExponential(3)} mol/kgw</p>
            <div className="speclist">
              {g.species.map((sp, i) => {
                const pct = g.total > 0 ? sp.molality / g.total * 100 : 0;
                return <div key={sp.name + i}><i className="sw" style={{ background: `var(--sp${Math.min(7, i + 1)})` }} /><span className="mono">{sp.name}</span>
                  <span className="m">{sp.molality.toExponential(3)}</span><span className="m" style={{ minWidth: 52, textAlign: 'right' }}>{pct >= 0.1 ? pct.toFixed(1) + ' %' : '<0.1 %'}</span></div>;
              })}
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

function TableView({ t, table, file }: { t: TFn; table: SelTable; file: string }) {
  const rows = table.rows.slice(0, 500);
  return (
    <div className="panel">
      <div className="panel-h"><h3 className="mono">{file}</h3><span className="note">{table.rows.length} {t('r_rows')}</span>
        <div className="export">
          <button className="btn sm" type="button" onClick={() => saveText(toCSV(table.columns, table.rows), safeName(file.replace(/\.\w+$/, '')) + '.csv', 'text/csv')}>CSV</button>
          <button className="btn sm" type="button" onClick={() => saveXLSX([{ name: file, columns: table.columns, rows: table.rows }], safeName(file.replace(/\.\w+$/, '')) + '.xlsx')}>XLSX</button>
          <button className="btn sm" type="button" onClick={() => saveText([table.columns.join('\t'), ...table.rows.map(r => r.join('\t'))].join('\n'), file)}>.sel</button>
        </div></div>
      <div style={{ overflow: 'auto', maxHeight: 520 }}>
        <table className="data"><thead><tr>{table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="num mono">{typeof v === 'number' ? (isMissing(v) ? '–' : String(+v.toPrecision(6))) : v}</td>)}</tr>)}</tbody></table>
      </div>
    </div>
  );
}

function NewTableChart({ t, tables, onAdd }: { t: TFn; tables: RunOutcome['tables']; onAdd: (c: TableChart) => void }) {
  const [file, setFile] = useState(tables[0]?.file ?? '');
  const tb = tables.find(x => x.file === file)?.table;
  const numeric = tb ? tb.columns.filter((_, i) => tb.rows.some(r => typeof r[i] === 'number' && !isMissing(r[i]))) : [];
  const [x, setX] = useState('');
  const [ys, setYs] = useState<string[]>([]);
  const xx = numeric.includes(x) ? x : numeric[0] ?? '';
  if (!tables.length) return null;
  return (
    <div className="panel">
      <div className="panel-h"><h3>{t('r_newchart')}</h3></div>
      <div className="panel-b" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label className="field"><span className="lab">{t('r_from_table')}</span><select value={file} onChange={e => { setFile(e.target.value); setYs([]); }}>{tables.map(x => <option key={x.file}>{x.file}</option>)}</select></label>
        <label className="field"><span className="lab">{t('r_xcol')}</span><select value={xx} onChange={e => setX(e.target.value)}>{numeric.map(c => <option key={c}>{c}</option>)}</select></label>
        <div className="field" style={{ flex: 1, minWidth: 240 }}><span className="lab">{t('r_ycols')}</span>
          <div className="opts">{numeric.filter(c => c !== xx).map(c => <label key={c}><input type="checkbox" checked={ys.includes(c)} onChange={e => setYs(e.target.checked ? [...ys, c] : ys.filter(y => y !== c))} /><span className="mono">{c}</span></label>)}</div></div>
        <button className="btn primary sm" type="button" disabled={!ys.length} onClick={() => { onAdd({ id: 'tc' + Date.now(), file, x: xx, ys }); setYs([]); }}>+ {t('r_newchart')}</button>
      </div>
    </div>
  );
}

export function Results({ t, colors, outcome, running, projectName, charts, saveChart, tableCharts, setTableCharts, toast }: Props) {
  const [tab, setTab] = useState<Tab>('charts');
  const [tableFile, setTableFile] = useState('');
  const messages = useMemo(() => {
    if (!outcome) return [];
    const errs = [...outcome.parsed.errors, ...outcome.run.errors.split('\n').filter(l => /ERROR/.test(l)).map(l => l.replace(/^ERROR:\s*/, ''))];
    return [...[...new Set(errs)].map(text => ({ kind: 'error' as 'error' | 'warning', text })), ...outcome.parsed.warnings.map(text => ({ kind: 'warning' as 'error' | 'warning', text }))];
  }, [outcome]);

  if (!outcome) return <main className="view gut"><div className="view-head"><h1>{t('nav_results')}</h1></div><div className="panel panel-b"><p className="muted">{running ? t('running') : t('r_none')}</p></div></main>;

  const { run, parsed, graphs, tables } = outcome;
  const sims = parsed.simulations.length;
  const base = safeName(projectName || 'aquos');

  const tablePlots = tableCharts.map(c => {
    const tb = tables.find(x => x.file === c.file)?.table;
    if (!tb) return null;
    const xi = tb.columns.indexOf(c.x);
    const series: PlotSeries[] = c.ys.map(y => {
      const yi = tb.columns.indexOf(y);
      return { key: y, name: y, points: tb.rows.filter(r => !isMissing(r[xi]) && !isMissing(r[yi])).map(r => ({ x: r[xi] as number, y: r[yi] as number })) };
    });
    return { c, series };
  }).filter(Boolean) as { c: TableChart; series: PlotSeries[] }[];

  const tabs: [Tab, string][] = [['charts', `${t('r_charts')} (${graphs.length + tablePlots.length})`], ['solutions', t('r_solution')], ['tables', `${t('r_tables')} (${tables.length})`], ['output', t('r_output')], ['messages', `${t('r_messages')} (${messages.length})`]];
  const curTable = tables.find(x => x.file === tableFile) ?? tables[0];

  return (
    <main className="view gut">
      <div className="view-head">
        <div><h1>{t('nav_results')}</h1>
          <p>{t('r_sub', { db: outcome.database, sims, ms: run.ms })}</p>
          {!run.ok && <p style={{ color: 'var(--bad)', fontWeight: 500 }}>{t('r_failed')}</p>}</div>
        <div className="export"><span className="lbl">{t('dl')}</span>
          <button className="btn sm" type="button" onClick={() => saveText(run.output, base + '.out')}>.out</button>
          {tables.length > 0 && <button className="btn sm" type="button" onClick={() => saveXLSX(tables.map(x => ({ name: x.file, columns: x.table.columns, rows: x.table.rows })), base + '_tables.xlsx')}>XLSX</button>}
        </div>
      </div>
      <div className="tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>

      {tab === 'charts' && <>
        {!graphs.length && !tablePlots.length && <p className="note">{t('r_nocharts')}</p>}
        {graphs.map(g => {
          const id = `ug${g.def.n}`;
          const series: PlotSeries[] = g.series.map((s, i) => ({ key: s.name + (s.secondary ? '#2' : '') + (s.measured ? '#m' : '') + (g.series.findIndex(x => x.name === s.name) !== i ? '#' + i : ''), name: s.name, secondary: s.secondary, measured: s.measured, points: s.points }));
          return <ChartPanel key={id + outcome.at} t={t} colors={colors} series={series} fileBase={`${base}_graph${g.def.n}`} toast={toast}
            init={{ title: g.def.title, xTitle: g.def.axisTitles[0], yTitle: g.def.axisTitles[1], y2Title: g.def.axisTitles[2],
              xMin: g.def.xScale.min?.toString() ?? '', xMax: g.def.xScale.max?.toString() ?? '', yMin: g.def.yScale.min?.toString() ?? '', yMax: g.def.yScale.max?.toString() ?? '',
              y2Min: g.def.y2Scale.min?.toString() ?? '', y2Max: g.def.y2Scale.max?.toString() ?? '', xLog: !!g.def.xScale.log, yLog: !!g.def.yScale.log }}
            saved={charts[id]} onSave={s => saveChart(id, s)} />;
        })}
        {tablePlots.map(({ c, series }) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <ChartPanel t={t} colors={colors} series={series} fileBase={`${base}_${c.file}`} toast={toast}
              init={{ title: c.file, xTitle: c.x, yTitle: c.ys.join(', ') }} saved={charts[c.id]} onSave={s => saveChart(c.id, s)} />
            <button className="btn sm" type="button" style={{ alignSelf: 'flex-end' }} onClick={() => setTableCharts(tableCharts.filter(x => x.id !== c.id))}>× {c.file}: {c.ys.join(', ')}</button>
          </div>
        ))}
        <NewTableChart t={t} tables={tables} onAdd={c => setTableCharts([...tableCharts, c])} />
      </>}

      {tab === 'solutions' && <Solutions key={outcome.at} t={t} parsed={parsed} colors={colors} />}

      {tab === 'tables' && (tables.length ? <>
        {tables.length > 1 && <div className="simtabs">{tables.map(x => <button key={x.file} type="button" aria-selected={x.file === curTable.file} onClick={() => setTableFile(x.file)}><b className="mono">{x.file}</b><span>{x.table.rows.length} {t('r_rows')}</span></button>)}</div>}
        <TableView t={t} table={curTable.table} file={curTable.file} />
      </> : <p className="note">{t('r_nocharts')}</p>)}

      {tab === 'output' && <div className="panel"><pre className="code" style={{ margin: 0, maxHeight: 700, overflow: 'auto', borderRadius: 10 }}>{run.output.length > 3e6 ? run.output.slice(0, 3e6) + '\n…' : run.output}</pre></div>}

      {tab === 'messages' && <div className="panel">
        {!messages.length && <p className="note" style={{ padding: 14 }}><span className="ok">✓</span> {t('e_noproblems')}</p>}
        {messages.map((m, i) => <div className="prob" key={i}><span className={'sev ' + (m.kind === 'error' ? 'err' : 'wrn')}>{m.kind === 'error' ? t('error') : t('warning')}</span><div>{m.text}</div></div>)}
        {run.errors && !run.ok && <pre className="code" style={{ margin: 12 }}>{run.errors.split('\n').filter(l => l.trim() && !/^\s*[|_]/.test(l)).slice(-30).join('\n')}</pre>}
      </div>}
    </main>
  );
}
