// Small SVG plot for the serpentinization lab: shaded fields, lines, labelled points,
// log or linear axes, a hover readout and on-click downloads.
import { useMemo, useRef, useState } from 'react';
import type { ThemeColors } from '../Chart';
import { safeName, savePDF, savePNG, saveSVG } from '../../lib/download';

export interface PPoint { x: number; y: number; label?: string; info?: string }
export interface PSeries { name: string; color: string; points: PPoint[]; line?: boolean; dash?: boolean; symbol?: 'circle' | 'square' | 'triangle' | 'diamond'; width?: number; labels?: boolean }
export interface PPoly { pts: [number, number][]; fill: string; label?: string; labelAt?: [number, number]; opacity?: number }
export interface PVLine { x?: number; y?: number; label: string; color?: string }

interface Props {
  title: string; xLabel: string; yLabel: string; colors: ThemeColors;
  xDomain: [number, number]; yDomain: [number, number]; xLog?: boolean; yLog?: boolean;
  series: PSeries[]; polys?: PPoly[]; guides?: PVLine[];
  width?: number; height?: number; fileBase: string; dlLabel: string; toast: (m: string) => void; note?: string;
}

const fmt = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1e4 || Math.abs(v) < 1e-2 ? v.toExponential(0).replace('e+', 'e') : String(+v.toPrecision(4)));
function ticks(a: number, b: number, log: boolean, n: number) {
  if (log) { const out: number[] = []; for (let e = Math.ceil(Math.log10(a) - 1e-9); e <= Math.floor(Math.log10(b) + 1e-9); e++) out.push(10 ** e); return out; }
  const raw = (b - a) / n, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p, st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const out: number[] = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(10)); return out;
}

function Mark({ s, x, y, c, bg }: { s: PSeries['symbol']; x: number; y: number; c: string; bg: string }) {
  const r = 4.5;
  if (s === 'square') return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={c} stroke={bg} strokeWidth={1.5} />;
  if (s === 'triangle') return <path d={`M${x} ${y - r * 1.2}L${x + r * 1.1} ${y + r * .9}L${x - r * 1.1} ${y + r * .9}Z`} fill={c} stroke={bg} strokeWidth={1.5} />;
  if (s === 'diamond') return <path d={`M${x} ${y - r * 1.3}L${x + r} ${y}L${x} ${y + r * 1.3}L${x - r} ${y}Z`} fill={c} stroke={bg} strokeWidth={1.5} />;
  return <circle cx={x} cy={y} r={r} fill={c} stroke={bg} strokeWidth={1.5} />;
}

export function Plot({ title, xLabel, yLabel, colors: c, xDomain, yDomain, xLog, yLog, series, polys = [], guides = [], width = 760, height = 500, fileBase, dlLabel, toast, note }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const W = width, H = height, f = 13;
  const legend = series.filter(s => s.points.length);
  // flowing legend: items placed left to right, wrapping to a new row when the next one does not fit
  const lpos: { x: number; row: number }[] = [];
  { let x = 0, row = 0; const maxW = W - 66 - 20;
    for (const s of legend) { const w = 40 + s.name.length * f * 0.56; if (x > 0 && x + w > maxW) { x = 0; row++; } lpos.push({ x, row }); x += w + 14; } }
  const lrows = lpos.length ? lpos[lpos.length - 1].row + 1 : 0;
  const m = { t: 40, r: 20, b: 56 + lrows * 20, l: 66 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b;
  const tx = (v: number) => (xLog ? Math.log10(v) : v), ty = (v: number) => (yLog ? Math.log10(v) : v);
  const [x0, x1] = [tx(xDomain[0]), tx(xDomain[1])], [y0, y1] = [ty(yDomain[0]), ty(yDomain[1])];
  const sx = (v: number) => m.l + (tx(v) - x0) / (x1 - x0) * pw;
  const sy = (v: number) => m.t + ph - (ty(v) - y0) / (y1 - y0) * ph;
  const ok = (p: { x: number; y: number }) => Number.isFinite(p.x) && Number.isFinite(p.y) && (!xLog || p.x > 0) && (!yLog || p.y > 0);
  const xt = ticks(xDomain[0], xDomain[1], !!xLog, 7), yt = ticks(yDomain[0], yDomain[1], !!yLog, 6);
  const clip = useMemo(() => 'pc' + Math.random().toString(36).slice(2), []);

  const dl = async (k: 'svg' | 'png' | 'pdf') => {
    const svg = ref.current; if (!svg) return;
    const name = safeName(fileBase);
    try { if (k === 'svg') await saveSVG(svg, name + '.svg'); else if (k === 'png') await savePNG(svg, name + '.png'); else await savePDF(svg, name + '.pdf'); }
    catch (e) { toast(String((e as Error).message || e)); }
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * W / r.width, py = (e.clientY - r.top) * H / r.height;
    let best: { d: number; x: number; y: number; text: string } | null = null;
    for (const s of series) for (const p of s.points) {
      if (!ok(p)) continue;
      const d = (sx(p.x) - px) ** 2 + (sy(p.y) - py) ** 2;
      if (!best || d < best.d) best = { d, x: sx(p.x), y: sy(p.y), text: `${s.name}${p.label ? ' · ' + p.label : ''}: x = ${fmt(p.x)}, y = ${fmt(p.y)}${p.info ? ' · ' + p.info : ''}` };
    }
    setHover(best && best.d < 500 ? { x: best.x / W * 100, y: best.y / H * 100, text: best.text } : null);
  };

  return (
    <div className="panel">
      <div className="panel-h"><h3>{title}</h3>
        <div className="export"><span className="lbl">{dlLabel}</span>{(['svg', 'png', 'pdf'] as const).map(k => <button key={k} className="btn sm" type="button" onClick={() => dl(k)}>{k.toUpperCase()}</button>)}</div>
      </div>
      <div className="panel-b">
        <div className="chart-host">
          <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} onMouseMove={onMove} onMouseLeave={() => setHover(null)} style={{ fontFamily: 'IBM Plex Sans, Arial, sans-serif' }}>
            <rect width={W} height={H} fill={c.bg} />
            <defs><clipPath id={clip}><rect x={m.l} y={m.t} width={pw} height={ph} /></clipPath></defs>
            <text x={m.l} y={24} fontSize={f * 1.1} fontWeight={600} fill={c.ink}>{title}</text>
            <g clipPath={`url(#${clip})`}>
              {polys.map((p, i) => <path key={'p' + i} d={p.pts.map(([x, y], k) => `${k ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('') + 'Z'} fill={p.fill} opacity={p.opacity ?? 1} stroke={c.bg} strokeWidth={2} />)}
            </g>
            {yt.map(v => <line key={'gy' + v} x1={m.l} x2={m.l + pw} y1={sy(v)} y2={sy(v)} stroke={c.line} strokeWidth={0.8} />)}
            {xt.map(v => <line key={'gx' + v} x1={sx(v)} x2={sx(v)} y1={m.t} y2={m.t + ph} stroke={c.line} strokeWidth={0.8} />)}
            <rect x={m.l} y={m.t} width={pw} height={ph} fill="none" stroke={c.muted} />
            {xt.map(v => <text key={'tx' + v} x={sx(v)} y={m.t + ph + 18} textAnchor="middle" fontSize={f * .9} fill={c.muted}>{fmt(v)}</text>)}
            {yt.map(v => <text key={'ty' + v} x={m.l - 8} y={sy(v) + 4} textAnchor="end" fontSize={f * .9} fill={c.muted}>{fmt(v)}</text>)}
            <text x={m.l + pw / 2} y={m.t + ph + 40} textAnchor="middle" fontSize={f} fill={c.ink}>{xLabel}</text>
            <text transform={`translate(18 ${m.t + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize={f} fill={c.ink}>{yLabel}</text>
            <g clipPath={`url(#${clip})`}>
              {polys.filter(p => p.label).map((p, i) => {
                const [lx, ly] = p.labelAt ?? [p.pts.reduce((a, q) => a + q[0], 0) / p.pts.length, p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length];
                return <text key={'pl' + i} x={sx(lx)} y={sy(ly)} textAnchor="middle" fontSize={f * .95} fontWeight={600} fill={c.ink} opacity={0.75}>{p.label}</text>;
              })}
              {guides.map((g, i) => g.x != null
                ? <g key={'g' + i}><line x1={sx(g.x)} x2={sx(g.x)} y1={m.t} y2={m.t + ph} stroke={g.color ?? c.muted} strokeDasharray="5 4" strokeWidth={1.4} /><text x={sx(g.x) + 4} y={m.t + 14 + i * 14} fontSize={f * .85} fill={c.muted}>{g.label}</text></g>
                : <g key={'g' + i}><line x1={m.l} x2={m.l + pw} y1={sy(g.y!)} y2={sy(g.y!)} stroke={g.color ?? c.muted} strokeDasharray="5 4" strokeWidth={1.4} /><text x={m.l + pw - 4} y={sy(g.y!) - 5} textAnchor="end" fontSize={f * .85} fill={c.muted}>{g.label}</text></g>)}
              {series.filter(s => s.line).map(s => {
                const pts = s.points.filter(ok);
                return pts.length > 1 ? <path key={'l' + s.name} d={pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join('')} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? '7 5' : undefined} strokeLinejoin="round" /> : null;
              })}
              {series.filter(s => s.symbol).map(s => <g key={'m' + s.name}>{s.points.filter(ok).map((p, k) => <g key={k}>
                <Mark s={s.symbol} x={sx(p.x)} y={sy(p.y)} c={s.color} bg={c.bg} />
                {s.labels && p.label && <text x={sx(p.x) + 7} y={sy(p.y) - 6} fontSize={f * .8} fill={c.ink}>{p.label}</text>}
              </g>)}</g>)}
            </g>
            {legend.map((s, i) => {
              const x = m.l + lpos[i].x, y = H - (lrows - lpos[i].row) * 20 + 4;
              return <g key={'lg' + s.name}>
                {s.line && <line x1={x} x2={x + 22} y1={y} y2={y} stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash ? '7 5' : undefined} />}
                {s.symbol && <Mark s={s.symbol} x={x + 11} y={y} c={s.color} bg={c.bg} />}
                <text x={x + 28} y={y + 4} fontSize={f * .85} fill={c.ink}>{s.name}</text>
              </g>;
            })}
          </svg>
          {hover && <div className="tip-float" style={{ left: `${hover.x}%`, top: `${hover.y}%` }}>{hover.text}</div>}
        </div>
        {note && <p className="note" style={{ marginTop: 8 }}>{note}</p>}
      </div>
    </div>
  );
}
