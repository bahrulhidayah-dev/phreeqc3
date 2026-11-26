// Chart style model: everything the user can adjust, saved with the project.
export type Symbol = 'circle' | 'circle-open' | 'square' | 'square-open' | 'triangle' | 'diamond' | 'cross' | 'plus' | 'none';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type LegendPos = 'tr' | 'tl' | 'br' | 'bl' | 'bottom' | 'right' | 'none';
export type Preset = 'screen' | 'journal' | 'slide';

export interface SeriesStyle { color: string; symbol: Symbol; size: number; line: LineStyle; width: number; show: boolean; label: string; secondary?: boolean }
export interface ChartStyle {
  title: string; xTitle: string; yTitle: string; y2Title: string;
  font: number; legend: LegendPos; grid: boolean; preset: Preset;
  xMin: string; xMax: string; yMin: string; yMax: string; y2Min: string; y2Max: string;
  xLog: boolean; yLog: boolean;
  width: number; height: number;
  series: Record<string, SeriesStyle>;
}

export const PALETTE = ['#0C7480', '#B8671F', '#2F6FB0', '#7B3FA0', '#2E7D4F', '#B03A3A', '#9A6A00', '#5A6B73', '#4C9FA8', '#C2589A'];
export const SYMBOLS: Symbol[] = ['circle', 'square', 'triangle', 'diamond', 'circle-open', 'square-open', 'cross', 'plus', 'none'];
const JOURNAL_GRAYS = ['#000000', '#555555', '#888888', '#222222', '#6b6b6b', '#999999'];

export function defaultSeries(i: number, label: string, opts: { measured?: boolean; secondary?: boolean; points?: number } = {}): SeriesStyle {
  const many = (opts.points ?? 0) > 80;
  return {
    color: PALETTE[i % PALETTE.length], symbol: opts.measured ? 'circle-open' : SYMBOLS[i % 4], size: many ? 0 : 6,
    line: opts.measured ? 'none' : opts.secondary ? 'dashed' : 'solid', width: 2, show: true, label, secondary: opts.secondary,
  };
}

export function defaultStyle(init: Partial<ChartStyle> = {}): ChartStyle {
  return {
    title: '', xTitle: '', yTitle: '', y2Title: '', font: 13, legend: 'tr', grid: true, preset: 'screen',
    xMin: '', xMax: '', yMin: '', yMax: '', y2Min: '', y2Max: '', xLog: false, yLog: false,
    width: 760, height: 460, series: {}, ...init,
  };
}

export function applyPreset(s: ChartStyle, p: Preset): ChartStyle {
  const names = Object.keys(s.series);
  const series: Record<string, SeriesStyle> = Object.fromEntries(names.map((n, i): [string, SeriesStyle] => {
    const cur = s.series[n];
    if (p === 'journal') return [n, { ...cur, color: JOURNAL_GRAYS[i % JOURNAL_GRAYS.length], symbol: SYMBOLS[i % 8], size: Math.max(cur.size, 5), width: 1.2, line: (['solid', 'dashed', 'dotted'] as LineStyle[])[i % 3] }];
    if (p === 'slide') return [n, { ...cur, color: PALETTE[i % PALETTE.length], width: 3, size: cur.size ? 8 : 0 }];
    return [n, { ...cur, color: PALETTE[i % PALETTE.length], width: 2, size: cur.size ? 6 : 0, line: cur.line === 'none' ? 'none' : 'solid' as LineStyle }];
  }));
  return { ...s, preset: p, font: p === 'slide' ? 18 : p === 'journal' ? 11 : 13, width: p === 'journal' ? 600 : p === 'slide' ? 960 : 760, height: p === 'journal' ? 420 : p === 'slide' ? 540 : 460, series };
}
