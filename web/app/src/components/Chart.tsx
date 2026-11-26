// SVG X-Y chart. Everything is drawn with concrete colors so the same SVG can be exported.
import { forwardRef, useMemo, useState } from 'react';
import type { ChartStyle, Symbol } from './chartStyle';

export interface PlotSeries { key: string; name: string; secondary?: boolean; measured?: boolean; points: { x: number; y: number }[] }
export interface ThemeColors { bg: string; ink: string; muted: string; line: string }

function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target);
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / p;
  return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
}
function ticks(min: number, max: number, log: boolean, target = 6): number[] {
  if (!(max > min)) return [min];
  if (log) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) { const v = Math.pow(10, e); if (v >= min * 0.999 && v <= max * 1.001) out.push(v); }
    return out.length ? out : [min, max];
  }
  const st = niceStep(max - min, target);
  const out: number[] = [];
  for (let v = Math.ceil(min / st - 1e-9) * st; v <= max + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
  return out;
}
function fmt(v: number) {
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(0).replace('e+', 'e');
  return String(+v.toPrecision(6));
}
function extent(vals: number[], minS: string, maxS: string, log: boolean): [number, number] {
  const v = log ? vals.filter(x => x > 0) : vals;
  let lo = v.length ? Math.min(...v) : 0, hi = v.length ? Math.max(...v) : 1;
  if (lo === hi) { if (log) { lo /= 10; hi *= 10; } else { lo -= Math.abs(lo) * 0.1 || 1; hi += Math.abs(hi) * 0.1 || 1; } }
  else if (!log) { const pad = (hi - lo) * 0.04; lo -= pad; hi += pad; }
  if (minS.trim() !== '' && Number.isFinite(+minS)) lo = +minS;
  if (maxS.trim() !== '' && Number.isFinite(+maxS)) hi = +maxS;
  if (log && lo <= 0) lo = hi / 1e6;
  return [lo, hi];
}

function SymbolMark({ s, x, y, size, color, bg }: { s: Symbol; x: number; y: number; size: number; color: string; bg: string }) {
  const r = size / 2;
  if (s === 'none' || size <= 0) return null;
  switch (s) {
    case 'circle': return <circle cx={x} cy={y} r={r} fill={color} />;
    case 'circle-open': return <circle cx={x} cy={y} r={r} fill={bg} stroke={color} strokeWidth={1.5} />;
    case 'square': return <rect x={x - r} y={y - r} width={size} height={size} fill={color} />;
    case 'square-open': return <rect x={x - r} y={y - r} width={size} height={size} fill={bg} stroke={color} strokeWidth={1.5} />;
    case 'triangle': return <path d={`M${x} ${y - r * 1.15}L${x + r * 1.1} ${y + r * 0.85}L${x - r * 1.1} ${y + r * 0.85}Z`} fill={color} />;
    case 'diamond': return <path d={`M${x} ${y - r * 1.25}L${x + r} ${y}L${x} ${y + r * 1.25}L${x - r} ${y}Z`} fill={color} />;
    case 'cross': return <path d={`M${x - r} ${y - r}L${x + r} ${y + r}M${x + r} ${y - r}L${x - r} ${y + r}`} stroke={color} strokeWidth={1.6} />;
    case 'plus': return <path d={`M${x - r} ${y}L${x + r} ${y}M${x} ${y - r}L${x} ${y + r}`} stroke={color} strokeWidth={1.6} />;
  }
}

interface Props { series: PlotSeries[]; style: ChartStyle; colors: ThemeColors; xLabel?: string }

export const Chart = forwardRef<SVGSVGElement, Props>(function Chart({ series, style: s, colors: c0 }, ref) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  const c = s.preset === 'journal' ? { bg: '#FFFFFF', ink: '#000000', muted: '#333333', line: '#D0D0D0' } : c0;
  const W = s.width, H = s.height, f = s.font;
  const visible = series.filter(p => (s.series[p.key]?.show ?? true) && p.points.length);
  const hasY2 = visible.some(p => p.secondary);
  const legendRight = s.legend === 'right', legendBottom = s.legend === 'bottom';
  const legendW = legendRight ? Math.min(220, 30 + Math.max(...visible.map(p => (s.series[p.key]?.label || p.name).length), 4) * f * 0.6) : 0;
  const legendRows = legendBottom ? Math.ceil(visible.length / Math.max(1, Math.floor((W - 80) / 170))) : 0;
  const m = { t: s.title ? f * 2.6 + 8 : 16, r: (hasY2 ? f * 4.4 + 18 : 22) + legendW, b: f * 3.4 + 10 + legendRows * (f + 8), l: f * 4.6 + 20 };
  const pw = Math.max(50, W - m.l - m.r), ph = Math.max(50, H - m.t - m.b);

  const geo = useMemo(() => {
    const xs = visible.flatMap(p => p.points.map(q => q.x));
    const ys = visible.filter(p => !p.secondary).flatMap(p => p.points.map(q => q.y));
    const y2s = visible.filter(p => p.secondary).flatMap(p => p.points.map(q => q.y));
    const [x0, x1] = extent(xs, s.xMin, s.xMax, s.xLog);
    const [y0, y1] = extent(ys.length ? ys : [0, 1], s.yMin, s.yMax, s.yLog);
    const [z0, z1] = extent(y2s.length ? y2s : [0, 1], s.y2Min, s.y2Max, false);
    return { x0, x1, y0, y1, z0, z1 };
  }, [visible, s.xMin, s.xMax, s.yMin, s.yMax, s.y2Min, s.y2Max, s.xLog, s.yLog]);

  const sx = (v: number) => m.l + (s.xLog ? (Math.log10(v) - Math.log10(geo.x0)) / (Math.log10(geo.x1) - Math.log10(geo.x0)) : (v - geo.x0) / (geo.x1 - geo.x0)) * pw;
  const sy = (v: number) => m.t + ph - (s.yLog ? (Math.log10(v) - Math.log10(geo.y0)) / (Math.log10(geo.y1) - Math.log10(geo.y0)) : (v - geo.y0) / (geo.y1 - geo.y0)) * ph;
  const sz = (v: number) => m.t + ph - (v - geo.z0) / (geo.z1 - geo.z0) * ph;
  const ok = (p: { x: number; y: number }, sec?: boolean) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!s.xLog || p.x > 0) && (sec || !s.yLog || p.y > 0);
  const inside = (x: number, y: number) => x >= m.l - 0.5 && x <= m.l + pw + 0.5 && y >= m.t - 0.5 && y <= m.t + ph + 0.5;

  const xt = ticks(geo.x0, geo.x1, s.xLog, Math.max(3, Math.round(pw / 90)));
  const yt = ticks(geo.y0, geo.y1, s.yLog, Math.max(3, Math.round(ph / 60)));
  const zt = hasY2 ? ticks(geo.z0, geo.z1, false, Math.max(3, Math.round(ph / 60))) : [];
  const dash = (l: string, w: number) => (l === 'dashed' ? `${w * 4} ${w * 3}` : l === 'dotted' ? `${w} ${w * 2.2}` : undefined);
  const clipId = useMemo(() => 'clip' + Math.random().toString(36).slice(2), []);

  // legend placement
  const items = visible.map(p => ({ p, st: s.series[p.key] }));
  const lw = Math.min(260, 44 + Math.max(4, ...items.map(i => (i.st?.label || i.p.name).length)) * f * 0.58);
  const lh = items.length * (f + 7) + 12;
  let lx = m.l + pw - lw - 10, ly = m.t + 10;
  if (s.legend === 'tl') lx = m.l + 10;
  if (s.legend === 'bl') { lx = m.l + 10; ly = m.t + ph - lh - 10; }
  if (s.legend === 'br') ly = m.t + ph - lh - 10;
  if (legendRight) { lx = W - legendW - 6; ly = m.t; }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget, rect = svg.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (W / rect.width), py = (e.clientY - rect.top) * (H / rect.height);
    let best: { d: number; x: number; y: number; label: string } | null = null;
    for (const { p, st } of items) for (const q of p.points) {
      if (!ok(q, p.secondary)) continue;
      const X = sx(q.x), Y = p.secondary ? sz(q.y) : sy(q.y);
      const d = (X - px) ** 2 + (Y - py) ** 2;
      if (!best || d < best.d) best = { d, x: X, y: Y, label: `${st?.label || p.name}: x = ${fmt(q.x)}, y = ${fmt(q.y)}` };
    }
    setHover(best && best.d < 900 ? { x: best.x / W * 100, y: best.y / H * 100, label: best.label } : null);
  };

  return (
    <div className="chart-host">
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={s.title || 'chart'}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
        <rect x={0} y={0} width={W} height={H} fill={c.bg} />
        <defs><clipPath id={clipId}><rect x={m.l} y={m.t} width={pw} height={ph} /></clipPath></defs>
        {s.title && <text x={m.l + pw / 2} y={f * 1.7 + 4} textAnchor="middle" fontSize={f * 1.25} fontWeight={600} fill={c.ink}>{s.title}</text>}
        {s.grid && xt.map(v => <line key={'gx' + v} x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + ph} stroke={c.line} strokeWidth={1} />)}
        {s.grid && yt.map(v => <line key={'gy' + v} x1={m.l} x2={m.l + pw} y1={sy(v)} y2={sy(v)} stroke={c.line} strokeWidth={1} />)}
        <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" stroke={c.muted} strokeWidth={1} />
        {xt.map(v => <g key={'tx' + v}><line x1={sx(v)} x2={sx(v)} y1={m.t + ph} y2={m.t + ph + 5} stroke={c.muted} /><text x={sx(v)} y={m.t + ph + f + 6} textAnchor="middle" fontSize={f * 0.9} fill={c.muted}>{fmt(v)}</text></g>)}
        {yt.map(v => <g key={'ty' + v}><line x1={m.l - 5} x2={m.l} y1={sy(v)} y2={sy(v)} stroke={c.muted} /><text x={m.l - 8} y={sy(v) + f * 0.32} textAnchor="end" fontSize={f * 0.9} fill={c.muted}>{fmt(v)}</text></g>)}
        {zt.map(v => <g key={'tz' + v}><line x1={m.l + pw} x2={m.l + pw + 5} y1={sz(v)} y2={sz(v)} stroke={c.muted} /><text x={m.l + pw + 8} y={sz(v) + f * 0.32} fontSize={f * 0.9} fill={c.muted}>{fmt(v)}</text></g>)}
        {s.xTitle && <text x={m.l + pw / 2} y={m.t + ph + f * 2.7 + 6} textAnchor="middle" fontSize={f} fill={c.ink}>{s.xTitle}</text>}
        {s.yTitle && <text transform={`translate(${f * 1.1} ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={f} fill={c.ink}>{s.yTitle}</text>}
        {hasY2 && s.y2Title && <text transform={`translate(${W - legendW - f * 0.9} ${m.t + ph / 2}) rotate(90)`} textAnchor="middle" fontSize={f} fill={c.ink}>{s.y2Title}</text>}

        <g clipPath={`url(#${clipId})`}>
          {items.map(({ p, st }) => {
            if (!st || st.line === 'none') return null;
            const pts = p.points.filter(q => ok(q, p.secondary));
            if (pts.length < 2) return null;
            const d = pts.map((q, i) => `${i ? 'L' : 'M'}${sx(q.x).toFixed(2)} ${(p.secondary ? sz(q.y) : sy(q.y)).toFixed(2)}`).join('');
            return <path key={'l' + p.key} d={d} fill="none" stroke={st.color} strokeWidth={st.width} strokeDasharray={dash(st.line, st.width)} strokeLinejoin="round" strokeLinecap="round" />;
          })}
        </g>
        {items.map(({ p, st }) => st && st.symbol !== 'none' && st.size > 0 ? (
          <g key={'s' + p.key}>{p.points.filter(q => ok(q, p.secondary)).map((q, i) => {
            const X = sx(q.x), Y = p.secondary ? sz(q.y) : sy(q.y);
            return inside(X, Y) ? <SymbolMark key={i} s={st.symbol} x={X} y={Y} size={st.size} color={st.color} bg={c.bg} /> : null;
          })}</g>) : null)}

        {s.legend !== 'none' && items.length > 0 && !legendBottom && (
          <g>
            {!legendRight && <rect x={lx} y={ly} width={lw} height={lh} rx={6} fill={c.bg} stroke={c.line} />}
            {items.map(({ p, st }, i) => {
              const y = ly + 12 + i * (f + 7) + f / 2;
              return <g key={'lg' + p.key}>
                {st && st.line !== 'none' && <line x1={lx + 10} x2={lx + 34} y1={y} y2={y} stroke={st.color} strokeWidth={st.width} strokeDasharray={dash(st.line, st.width)} />}
                {st && <SymbolMark s={st.symbol} x={lx + 22} y={y} size={Math.max(st.size, st.line === 'none' ? 6 : 0)} color={st.color} bg={c.bg} />}
                <text x={lx + 42} y={y + f * 0.35} fontSize={f * 0.92} fill={c.ink}>{st?.label || p.name}{p.secondary ? ' (→)' : ''}</text>
              </g>;
            })}
          </g>
        )}
        {legendBottom && items.length > 0 && (() => {
          const perRow = Math.max(1, Math.floor((W - 80) / 170));
          return <g>{items.map(({ p, st }, i) => {
            const x = m.l + (i % perRow) * 170, y = H - (legendRows - Math.floor(i / perRow)) * (f + 8) - 4;
            return <g key={'lb' + p.key}>
              {st && st.line !== 'none' && <line x1={x} x2={x + 22} y1={y} y2={y} stroke={st.color} strokeWidth={st.width} strokeDasharray={dash(st.line, st.width)} />}
              {st && <SymbolMark s={st.symbol} x={x + 11} y={y} size={Math.max(st.size, st.line === 'none' ? 6 : 0)} color={st.color} bg={c.bg} />}
              <text x={x + 28} y={y + f * 0.35} fontSize={f * 0.9} fill={c.ink}>{st?.label || p.name}</text>
            </g>;
          })}</g>;
        })()}
      </svg>
      {hover && <div className="tip-float" style={{ left: `${hover.x}%`, top: `${hover.y}%` }}>{hover.label}</div>}
    </div>
  );
});
