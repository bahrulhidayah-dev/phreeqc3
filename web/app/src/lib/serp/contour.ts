// Gridded results to a filled contour map: bilinear interpolation onto a fine raster,
// contour lines by marching squares, and a one-hue sequential color ramp.

export interface Grid { xs: number[]; ys: number[]; z: (number | null)[][] }   // z[iy][ix]

/** Value at (x, y) by bilinear interpolation between the (possibly uneven) grid nodes. */
export function sample(g: Grid, x: number, y: number): number | null {
  const find = (a: number[], v: number) => { let i = 0; while (i < a.length - 2 && v > a[i + 1]) i++; return i; };
  if (g.xs.length < 2 || g.ys.length < 2) return null;
  const i = find(g.xs, x), j = find(g.ys, y);
  const tx = (x - g.xs[i]) / (g.xs[i + 1] - g.xs[i] || 1), ty = (y - g.ys[j]) / (g.ys[j + 1] - g.ys[j] || 1);
  const a = g.z[j][i], b = g.z[j][i + 1], c = g.z[j + 1][i], d = g.z[j + 1][i + 1];
  if (a == null || b == null || c == null || d == null) return null;
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Resamples a grid to n×n nodes, evenly spaced in the transformed axis space. */
export function raster(g: Grid, n: number, fx: (v: number) => number, ix: (v: number) => number, fy: (v: number) => number, iy: (v: number) => number): Grid {
  const lin = (a: number, b: number) => Array.from({ length: n }, (_, k) => a + (b - a) * k / (n - 1));
  const X = lin(fx(g.xs[0]), fx(g.xs[g.xs.length - 1])), Y = lin(fy(g.ys[0]), fy(g.ys[g.ys.length - 1]));
  return { xs: X, ys: Y, z: Y.map(y => X.map(x => sample(g, ix(x), iy(y)))) };
}

/** Line segments where the field crosses `level` (coordinates in the grid's own units). */
export function isoline(g: Grid, level: number): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const lerp = (x0: number, x1: number, v0: number, v1: number) => x0 + (level - v0) / (v1 - v0 || 1e-30) * (x1 - x0);
  for (let j = 0; j < g.ys.length - 1; j++) for (let i = 0; i < g.xs.length - 1; i++) {
    const v = [g.z[j][i], g.z[j][i + 1], g.z[j + 1][i + 1], g.z[j + 1][i]];
    if (v.some(q => q == null)) continue;
    const [a, b, c, d] = v as number[];
    const x0 = g.xs[i], x1 = g.xs[i + 1], y0 = g.ys[j], y1 = g.ys[j + 1];
    const pts: [number, number][] = [];
    if ((a < level) !== (b < level)) pts.push([lerp(x0, x1, a, b), y0]);
    if ((b < level) !== (c < level)) pts.push([x1, lerp(y0, y1, b, c)]);
    if ((c < level) !== (d < level)) pts.push([lerp(x0, x1, d, c), y1]);
    if ((d < level) !== (a < level)) pts.push([x0, lerp(y0, y1, a, d)]);
    if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
    if (pts.length === 4) { segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]); segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]); }
  }
  return segs;
}

export function niceLevels(lo: number, hi: number, target = 8): number[] {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p;
  const out: number[] = [];
  for (let v = Math.ceil(lo / st) * st; v < hi - st * 1e-9; v += st) if (v > lo + st * 1e-9) out.push(+v.toPrecision(12));
  return out;
}

// one-hue (teal) sequential ramp, light = low, dark = high
const RAMP = ['#E7F4F5', '#C4E4E7', '#9CD1D6', '#72BCC3', '#4AA5AF', '#2C8C98', '#1A7380', '#0F5A66', '#08434D', '#042E36'];
const hex = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function rampColor(t: number): string {
  const u = Math.max(0, Math.min(1, t)) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(u)), f = u - i;
  const a = hex(RAMP[i]), b = hex(RAMP[i + 1]);
  return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join('');
}
