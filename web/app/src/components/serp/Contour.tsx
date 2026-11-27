// Filled contour map of a sweep result, with isolines, a color bar and on-click downloads.
import { useMemo, useRef, useState } from 'react';
import type { ThemeColors } from '../Chart';
import { isoline, niceLevels, raster, rampColor, type Grid } from '../../lib/serp/contour';
import { safeName, savePDF, savePNG, saveSVG } from '../../lib/download';
import { fmt } from './common';

interface Props {
  title: string; xLabel: string; yLabel: string; zLabel: string; grid: Grid; xLog: boolean; yLog: boolean;
  colors: ThemeColors; dlLabel: string; toast: (m: string) => void; fileBase: string;
}

export function Contour({ title, xLabel, yLabel, zLabel, grid, xLog, yLog, colors: c, dlLabel, toast, fileBase }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = 760, H = 500, m = { t: 40, r: 110, b: 58, l: 70 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const fx = (v: number) => (xLog ? Math.log10(v) : v);
  const fy = (v: number) => (yLog ? Math.log10(v) : v);
  const N = 72;
  // interpolate in the plotted (possibly log) coordinates so contours stay smooth on a log axis
  const id = (v: number) => v;
  const fine = useMemo(() => raster({ xs: grid.xs.map(fx), ys: grid.ys.map(fy), z: grid.z }, N, id, id, id, id), [grid, xLog, yLog]); // eslint-disable-line react-hooks/exhaustive-deps
  const zs = grid.z.flat().filter((v): v is number => v != null && Number.isFinite(v));
  const lo = Math.min(...zs), hi = Math.max(...zs);
  const levels = useMemo(() => niceLevels(lo, hi, 8), [lo, hi]);
  const X0 = fine.xs[0], X1 = fine.xs[N - 1], Y0 = fine.ys[0], Y1 = fine.ys[N - 1];
  const sx = (u: number) => m.l + (u - X0) / (X1 - X0 || 1) * pw, sy = (u: number) => m.t + ph - (u - Y0) / (Y1 - Y0 || 1) * ph;
  const cw = pw / (N - 1), chh = ph / (N - 1);
  const col = (v: number) => rampColor(hi > lo ? (v - lo) / (hi - lo) : 0.5);
  const segs = useMemo(() => levels.map(l => ({ l, s: isoline(fine, l) })), [fine, levels]);
  const xt = grid.xs, yt = grid.ys;

  const dl = async (k: 'svg' | 'png' | 'pdf') => {
    const svg = ref.current; if (!svg) return;
    try { const n = safeName(fileBase); if (k === 'svg') await saveSVG(svg, n + '.svg'); else if (k === 'png') await savePNG(svg, n + '.png'); else await savePDF(svg, n + '.pdf'); }
    catch (e) { toast(String((e as Error).message || e)); }
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    let best: { d: number; x: number; y: number; text: string } | null = null;
    grid.ys.forEach((y, j) => grid.xs.forEach((x, i) => {
      const v = grid.z[j][i]; if (v == null) return;
      const X = sx(fx(x)), Y = sy(fy(y)), d = (X - px) ** 2 + (Y - py) ** 2;
      if (!best || d < best.d) best = { d, x: X, y: Y, text: `${xLabel} ${fmt(x)}, ${yLabel} ${fmt(y)}: ${fmt(v, 4)}` };
    }));
    const b = best as { d: number; x: number; y: number; text: string } | null;
    setHover(b && b.d < 900 ? { x: b.x / W * 100, y: b.y / H * 100, text: b.text } : null);
  };

  return (
    <div className="panel">
      <div className="panel-h"><h3>{title}</h3>
        <div className="export"><span className="lbl">{dlLabel}</span>{(['svg', 'png', 'pdf'] as const).map(k => <button key={k} className="btn sm" type="button" onClick={() => dl(k)}>{k.toUpperCase()}</button>)}</div>
      </div>
      <div className="panel-b"><div className="chart-host">
        <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
          <rect width={W} height={H} fill={c.bg} />
          <text x={m.l} y={24} fontSize={14} fontWeight={600} fill={c.ink}>{title}</text>
          {fine.z.map((row, j) => row.map((v, i) => v == null ? null : <rect key={j * N + i} x={sx(fine.xs[i]) - cw / 2} y={sy(fine.ys[j]) - chh / 2} width={cw + 0.6} height={chh + 0.6} fill={col(v)} />))}
          <rect x={m.l - cw / 2} y={m.t - chh / 2} width={pw + cw} height={ph + chh} fill="none" stroke={c.muted} />
          {segs.map(({ l, s }) => <g key={l}>
            <path d={s.map(q => `M${sx(q[0]).toFixed(1)} ${sy(q[1]).toFixed(1)}L${sx(q[2]).toFixed(1)} ${sy(q[3]).toFixed(1)}`).join('')} stroke={(l - lo) / (hi - lo) > 0.55 ? '#FFFFFF' : '#14232B'} strokeOpacity={0.7} strokeWidth={1.1} fill="none" />
            {s.length > 0 && (() => { const q = s[Math.floor(s.length / 2)]; const light = (l - lo) / (hi - lo) > 0.55;
              return <text x={sx(q[0])} y={sy(q[1]) - 3} fontSize={10.5} textAnchor="middle" fill={light ? '#FFFFFF' : '#14232B'} stroke={light ? '#063B45' : '#FFFFFF'} strokeWidth={2.5} paintOrder="stroke">{fmt(l, 3)}</text>; })()}
          </g>)}
          {grid.ys.map((y, j) => grid.xs.map((x, i) => grid.z[j][i] == null
            ? <path key={`n${i}-${j}`} d={`M${sx(fx(x)) - 4} ${sy(fy(y)) - 4}l8 8m0 -8l-8 8`} stroke={c.muted} strokeWidth={1.4} />
            : <circle key={`p${i}-${j}`} cx={sx(fx(x))} cy={sy(fy(y))} r={2.2} fill={c.bg} stroke="#14232B" strokeWidth={0.8} />))}
          {xt.map(v => <text key={'x' + v} x={sx(fx(v))} y={m.t + ph + chh / 2 + 16} textAnchor="middle" fontSize={11.5} fill={c.muted}>{fmt(v)}</text>)}
          {yt.map(v => <text key={'y' + v} x={m.l - cw / 2 - 6} y={sy(fy(v)) + 4} textAnchor="end" fontSize={11.5} fill={c.muted}>{fmt(v)}</text>)}
          <text x={m.l + pw / 2} y={H - 12} textAnchor="middle" fontSize={13} fill={c.ink}>{xLabel}</text>
          <text transform={`translate(18 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={13} fill={c.ink}>{yLabel}</text>
          <g transform={`translate(${W - m.r + 26} ${m.t})`}>
            {Array.from({ length: 40 }, (_, k) => <rect key={k} x={0} y={ph - (k + 1) * ph / 40} width={16} height={ph / 40 + 0.5} fill={rampColor(k / 39)} />)}
            <rect x={0} y={0} width={16} height={ph} fill="none" stroke={c.muted} />
            {[lo, ...levels, hi].map((v, k) => <text key={k} x={22} y={ph - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * ph + 4} fontSize={10.5} fill={c.muted}>{fmt(v, 3)}</text>)}
            <text transform={`translate(${-8} ${ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={11.5} fill={c.ink}>{zLabel}</text>
          </g>
        </svg>
        {hover && <div className="tip-float" style={{ left: `${hover.x}%`, top: `${hover.y}%` }}>{hover.text}</div>}
      </div></div>
    </div>
  );
}
