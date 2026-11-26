// One chart with its style editor and on-click downloads (SVG, PNG, PDF, CSV).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, type PlotSeries, type ThemeColors } from './Chart';
import { applyPreset, defaultSeries, defaultStyle, SYMBOLS, type ChartStyle, type LegendPos, type LineStyle, type Preset, type Symbol } from './chartStyle';
import type { TFn } from '../lib/i18n';
import { safeName, savePDF, savePNG, saveSVG, saveText, toCSV } from '../lib/download';

interface Props {
  t: TFn; colors: ThemeColors; series: PlotSeries[];
  init: Partial<ChartStyle>;              // defaults from USER_GRAPH (titles, scales)
  saved?: ChartStyle; onSave: (s: ChartStyle) => void;
  fileBase: string; toast: (m: string) => void;
}

function withSeries(base: ChartStyle, series: PlotSeries[]): ChartStyle {
  const next = { ...base.series };
  let changed = false;
  series.forEach((p, i) => {
    if (!next[p.key]) { next[p.key] = defaultSeries(i, p.name, { measured: p.measured, secondary: p.secondary, points: p.points.length }); changed = true; }
  });
  return changed ? { ...base, series: next } : base;
}

export function ChartPanel({ t, colors, series, init, saved, onSave, fileBase, toast }: Props) {
  const fresh = () => withSeries(defaultStyle(init), series);
  const [style, setStyle] = useState<ChartStyle>(() => withSeries(saved ?? defaultStyle(init), series));
  const svgRef = useRef<SVGSVGElement>(null);
  const keySig = series.map(s => s.key).join('|');
  useEffect(() => { setStyle(s => withSeries(s, series)); }, [keySig]); // eslint-disable-line react-hooks/exhaustive-deps
  const first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } onSave(style); }, [style]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof ChartStyle>(k: K, v: ChartStyle[K]) => setStyle(s => ({ ...s, [k]: v }));
  const setSer = (key: string, patch: Partial<ChartStyle['series'][string]>) => setStyle(s => ({ ...s, series: { ...s.series, [key]: { ...s.series[key], ...patch } } }));
  const name = safeName(style.title || fileBase);

  const dl = async (kind: 'svg' | 'png' | 'pdf' | 'csv') => {
    const svg = svgRef.current;
    try {
      if (kind === 'csv') {
        const cols = series.flatMap(p => [`${p.name} x`, `${p.name} y`]);
        const n = Math.max(...series.map(p => p.points.length));
        const rows: (string | number)[][] = Array.from({ length: n }, (_, i) => series.flatMap((p): (string | number)[] => p.points[i] ? [p.points[i].x, p.points[i].y] : ['', '']));
        saveText(toCSV(cols, rows), name + '.csv', 'text/csv');
      } else if (svg) {
        if (kind === 'svg') await saveSVG(svg, name + '.svg');
        if (kind === 'png') await savePNG(svg, name + '.png');
        if (kind === 'pdf') await savePDF(svg, name + '.pdf');
      }
    } catch (e) { toast(String((e as Error).message || e)); }
  };

  const ordered = useMemo(() => series.filter(p => style.series[p.key]), [series, style.series]);
  const hasY2 = series.some(p => p.secondary);

  return (
    <div className="grid chartwrap">
      <div className="panel">
        <div className="panel-h">
          <h3>{style.title || init.title || t('r_charts')}</h3>
          <div className="export"><span className="lbl">{t('dl')}</span>
            {(['svg', 'png', 'pdf', 'csv'] as const).map(k => <button key={k} className="btn sm" type="button" onClick={() => dl(k)}>{k.toUpperCase()}</button>)}
          </div>
        </div>
        <div className="panel-b"><Chart ref={svgRef} series={series} style={style} colors={colors} /></div>
      </div>
      <div className="panel styler">
        <div className="panel-h"><h3>{t('c_style')}</h3><button className="btn sm" type="button" onClick={() => setStyle(fresh())}>{t('c_reset')}</button></div>
        <div className="sty-sec">
          <div className="sty-row"><label>{t('c_title')}</label><input type="text" value={style.title} onChange={e => set('title', e.target.value)} /></div>
          <div className="sty-row"><label>{t('c_preset')}</label>
            <select value={style.preset} onChange={e => setStyle(s => applyPreset(s, e.target.value as Preset))}>
              <option value="screen">{t('c_screen')}</option><option value="journal">{t('c_journal')}</option><option value="slide">{t('c_slide')}</option>
            </select></div>
          <div className="sty-row"><label>{t('c_font')}</label><input type="range" min={9} max={24} value={style.font} onChange={e => set('font', +e.target.value)} /></div>
          <div className="sty-row"><label>{t('c_legend')}</label>
            <select value={style.legend} onChange={e => set('legend', e.target.value as LegendPos)}>
              <option value="tr">↗ top right</option><option value="tl">↖ top left</option><option value="br">↘ bottom right</option><option value="bl">↙ bottom left</option>
              <option value="right">→ outside right</option><option value="bottom">↓ below</option><option value="none">{t('c_none')}</option>
            </select></div>
          <div className="sty-row"><label>{t('c_grid')}</label><input type="checkbox" checked={style.grid} onChange={e => set('grid', e.target.checked)} style={{ justifySelf: 'start' }} /></div>
          <div className="sty-row"><label>{t('c_width')}</label><div className="two">
            <input type="number" min={300} max={2400} step={20} value={style.width} onChange={e => set('width', Math.max(300, +e.target.value || 760))} aria-label={t('c_width')} />
            <input type="number" min={200} max={1600} step={20} value={style.height} onChange={e => set('height', Math.max(200, +e.target.value || 460))} aria-label={t('c_height')} />
          </div></div>
        </div>
        <div className="sty-sec">
          <b className="ser-h">{t('c_axes')}</b>
          <div className="sty-row"><label>{t('c_xtitle')}</label><input type="text" value={style.xTitle} onChange={e => set('xTitle', e.target.value)} /></div>
          <div className="sty-row"><label>X {t('c_range')}</label><div className="two">
            <input type="text" placeholder={t('c_auto')} value={style.xMin} onChange={e => set('xMin', e.target.value)} aria-label="x min" />
            <input type="text" placeholder={t('c_auto')} value={style.xMax} onChange={e => set('xMax', e.target.value)} aria-label="x max" /></div></div>
          <div className="sty-row"><label /><label className="opts"><input type="checkbox" checked={style.xLog} onChange={e => set('xLog', e.target.checked)} /> X {t('c_log')}</label></div>
          <div className="sty-row"><label>{t('c_ytitle')}</label><input type="text" value={style.yTitle} onChange={e => set('yTitle', e.target.value)} /></div>
          <div className="sty-row"><label>Y {t('c_range')}</label><div className="two">
            <input type="text" placeholder={t('c_auto')} value={style.yMin} onChange={e => set('yMin', e.target.value)} aria-label="y min" />
            <input type="text" placeholder={t('c_auto')} value={style.yMax} onChange={e => set('yMax', e.target.value)} aria-label="y max" /></div></div>
          <div className="sty-row"><label /><label className="opts"><input type="checkbox" checked={style.yLog} onChange={e => set('yLog', e.target.checked)} /> Y {t('c_log')}</label></div>
          {hasY2 && <>
            <div className="sty-row"><label>{t('c_y2title')}</label><input type="text" value={style.y2Title} onChange={e => set('y2Title', e.target.value)} /></div>
            <div className="sty-row"><label>Y2 {t('c_range')}</label><div className="two">
              <input type="text" placeholder={t('c_auto')} value={style.y2Min} onChange={e => set('y2Min', e.target.value)} aria-label="y2 min" />
              <input type="text" placeholder={t('c_auto')} value={style.y2Max} onChange={e => set('y2Max', e.target.value)} aria-label="y2 max" /></div></div>
          </>}
        </div>
        {ordered.map(p => {
          const st = style.series[p.key];
          return (
            <div className="sty-sec" key={p.key}>
              <label className="ser-h"><input type="checkbox" checked={st.show} onChange={e => setSer(p.key, { show: e.target.checked })} />
                <span className="sw" style={{ background: st.color }} />{p.name}{p.measured ? ` (${t('c_measured')})` : ''}</label>
              {st.show && <>
                <div className="sty-row"><label>{t('c_label')}</label><input type="text" value={st.label} onChange={e => setSer(p.key, { label: e.target.value })} /></div>
                <div className="sty-row"><label>{t('c_color')}</label><input type="color" value={st.color} onChange={e => setSer(p.key, { color: e.target.value })} /></div>
                <div className="sty-row"><label>{t('c_symbol')}</label><div className="two">
                  <select value={st.symbol} onChange={e => setSer(p.key, { symbol: e.target.value as Symbol, size: st.size || 6 })}>{SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <input type="range" min={0} max={16} value={st.size} onChange={e => setSer(p.key, { size: +e.target.value })} aria-label={t('c_size')} /></div></div>
                <div className="sty-row"><label>{t('c_line')}</label><div className="two">
                  <select value={st.line} onChange={e => setSer(p.key, { line: e.target.value as LineStyle })}>{['solid', 'dashed', 'dotted', 'none'].map(s => <option key={s} value={s}>{s}</option>)}</select>
                  <input type="number" min={0.5} max={8} step={0.5} value={st.width} onChange={e => setSer(p.key, { width: +e.target.value || 1 })} aria-label="line width" /></div></div>
              </>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
