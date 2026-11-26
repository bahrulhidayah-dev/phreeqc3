// USER_GRAPH support.
// The desktop PHREEQC plots USER_GRAPH with a Windows-only chart library (built with MULTICHART).
// In the browser the engine is compiled without it, so before a run each USER_GRAPH block is
// rewritten, in the copy sent to the engine only, into a SELECTED_OUTPUT + USER_PUNCH pair that
// writes the same values. Marker strings (@X, @Y, @S, @P, @Q) tag each group of values so the
// chart can be rebuilt exactly even when BASIC lines run conditionally.
import { lineKeyword } from './keywords.ts';

export interface AxisScale { min?: number; max?: number; log?: boolean }
export interface GraphPart { file: string; headings: string[] }
export interface UserGraphDef {
  n: number;
  title: string;
  axisTitles: [string, string, string];
  xScale: AxisScale; yScale: AxisScale; y2Scale: AxisScale;
  initialSolutions: boolean;
  connectSimulations: boolean;
  plotVs: 'x' | 't' | '';
  overlays: string[];          // -plot_csv_file / -plot_tsv_file
  parts: GraphPart[];          // one per block that defines BASIC lines
}
export interface GraphSeries { name: string; secondary: boolean; measured?: boolean; points: { x: number; y: number }[] }
export interface GraphData { def: UserGraphDef; series: GraphSeries[] }

const SO_BASE = 9000;

function words(rest: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}
function parseScale(parts: string[]): AxisScale {
  const v = (s?: string) => (s && !/^auto$/i.test(s) && Number.isFinite(+s) ? +s : undefined);
  return { min: v(parts[0]), max: v(parts[1]), log: parts.some(p => /^log/i.test(p)) };
}
const bool = (s: string | undefined, dflt: boolean) => (s == null || s === '' ? dflt : /^t/i.test(s));

/** Splits a physical line on ";" outside quotes (PHREEQC treats ";" as a line break). */
export function splitSemicolons(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = '';
  for (const ch of line) {
    if (q) { if (ch === q) q = ''; cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue; }
    if (ch === ';') { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/** Rewrites one BASIC line: graph statements become PUNCH with a marker first. */
function rewriteBasic(line: string): string {
  return line
    .replace(/\bgraph_x\b/gi, 'PUNCH "@X",')
    .replace(/\bgraph_sy\b/gi, 'PUNCH "@S",')
    .replace(/\bgraph_y\b/gi, 'PUNCH "@Y",')
    .replace(/\bplot_xy\b([^:]*)/gi, (_m, args: string) => {
      const cut = args.search(/,\s*(color|symbol|symbol_size|line_width|line_w|y[-_]axis)\s*=/i);
      const secondary = /y[-_]axis\s*=\s*2/i.test(args);
      return `PUNCH "${secondary ? '@Q' : '@P'}",` + (cut >= 0 ? args.slice(0, cut) : args);
    });
}

export function transformUserGraphs(input: string): { input: string; graphs: UserGraphDef[] } {
  const physical = input.replace(/\\[ \t]*\r?\n/g, ' ').split(/\r?\n/);
  const out: string[] = [];
  const graphs = new Map<number, UserGraphDef>();
  const activeSO = new Map<number, number>();   // graph n -> SELECTED_OUTPUT number in use
  let seq = 0;

  // state of the USER_GRAPH block being read
  let g: UserGraphDef | null = null;
  let basic: string[] = [];
  let headings: string[] | null = null;
  let active: boolean | null = null;

  const flush = () => {
    if (!g) return;
    const n = g.n;
    if (basic.length) {
      const prev = activeSO.get(n);
      if (prev != null) out.push(`SELECTED_OUTPUT ${prev}`, '    -active false');
      const so = SO_BASE + ++seq;
      const file = `user_graph_${n}_${seq}.sel`;
      const last = g.parts[g.parts.length - 1];
      g.parts.push({ file, headings: headings ?? last?.headings ?? [] });
      activeSO.set(n, so);
      out.push(`SELECTED_OUTPUT ${so}`, `    -file ${file}`, '    -reset false', '    -simulation true', '    -state true',
        '    -distance true', '    -time true', `    -active ${active === false ? 'false' : 'true'}`, `USER_PUNCH ${so}`, ...basic);
    } else {
      if (headings && g.parts.length) g.parts[g.parts.length - 1].headings = headings;
      const so = activeSO.get(n);
      if (so != null && active != null) out.push(`SELECTED_OUTPUT ${so}`, `    -active ${active}`);
    }
    g = null; basic = []; headings = null; active = null;
  };

  for (const phys of physical) {
    const segs = splitSemicolons(phys);
    // Lines that neither belong to nor start a USER_GRAPH block are passed through untouched.
    if (!g && !segs.some(s => lineKeyword(s) === 'user_graph')) { out.push(phys); continue; }
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const kw = lineKeyword(seg);
      if (kw) {
        flush();
        if (kw === 'user_graph') {
          const m = seg.match(/^\s*\S+\s*(-?\d+)?\s*(.*)$/);
          const n = m?.[1] ? Math.abs(parseInt(m[1])) : 1;
          if (!graphs.has(n)) graphs.set(n, {
            n, title: (m?.[2] || '').trim().replace(/,$/, '') || `USER_GRAPH ${n}`, axisTitles: ['', '', ''],
            xScale: {}, yScale: {}, y2Scale: {}, initialSolutions: false, connectSimulations: true, plotVs: '', overlays: [], parts: [],
          });
          g = graphs.get(n)!;
          continue;
        }
        // another keyword: hand the rest of the physical line to the engine as written
        const rest = segs.slice(i);
        if (rest.some(s => lineKeyword(s) === 'user_graph')) { out.push(seg); continue; }
        out.push(rest.join(';'));
        break;
      }
      if (!g) { out.push(seg); continue; }
      const opt = seg.match(/^\s*-([A-Za-z_]+)\s*(.*)$/);
      if (opt) {
        const name = opt[1].toLowerCase(), a = words(opt[2]);
        if (/^head/.test(name)) headings = [...(headings ?? []), ...a];
        else if (/^chart_t/.test(name)) g.title = a.join(' ') || g.title;
        else if (/^axis_t/.test(name)) g.axisTitles = [a[0] || '', a[1] || '', a[2] || ''];
        else if (/^axis_s/.test(name)) {
          const which = (a[0] || '').toLowerCase(), sc = parseScale(a.slice(1));
          if (which.startsWith('x')) g.xScale = sc; else if (which.startsWith('y')) g.yScale = sc; else if (which.startsWith('s')) g.y2Scale = sc;
        }
        else if (/^init/.test(name)) g.initialSolutions = bool(a[0], true);
        else if (/^conn/.test(name)) g.connectSimulations = bool(a[0], true);
        else if (/^plot_(csv|tsv)/.test(name)) { if (a[0]) g.overlays.push(a[0]); }
        else if (/^plot_c/.test(name)) g.plotVs = /^t/i.test(a[0] || '') ? 't' : 'x';
        else if (/^act/.test(name)) active = bool(a[0], true);
        else if (/^det/.test(name)) active = false;
        // -start, -end, -detach, -batch, -grid_offset ...: nothing to run
        continue;
      }
      if (/^\s*\d+/.test(seg)) { basic.push(rewriteBasic(seg)); continue; }
      if (!seg.trim() || /^\s*#/.test(seg)) continue;
      // anything else (e.g. INCLUDE$) ends the block and goes to the engine unchanged
      flush();
      out.push(segs.slice(i).join(';'));
      break;
    }
  }
  flush();
  return { input: out.join('\n'), graphs: [...graphs.values()].filter(d => d.parts.length || d.overlays.length) };
}

/** Reads a -plot_csv_file / -plot_tsv_file overlay: first row headings, first column x. */
export function readOverlay(text: string, name: string): GraphSeries[] {
  const rows = text.split(/\r?\n/).filter(l => l.trim() && !/^\s*#/.test(l));
  if (rows.length < 2) return [];
  const split = (l: string) => l.split(/\t|,/).map(s => s.trim());
  const head = split(rows[0]);
  const series: GraphSeries[] = head.slice(1).map(h => ({ name: h || name, secondary: false, measured: true, points: [] }));
  for (const r of rows.slice(1)) {
    const c = split(r).map(s => (s === '' ? NaN : Number(s)));
    if (!Number.isFinite(c[0])) continue;
    c.slice(1).forEach((v, i) => { if (series[i] && Number.isFinite(v)) series[i].points.push({ x: c[0], y: v }); });
  }
  return series.filter(s => s.points.length);
}

const missing = (v: number) => !Number.isFinite(v) || (v <= -999 && v >= -1000);

/** Rebuilds the chart series of one USER_GRAPH from the files the engine wrote. */
export function readUserGraph(def: UserGraphDef, files: Record<string, string>): GraphData {
  const series = new Map<string, GraphSeries>();
  const get = (key: string, name: string, secondary: boolean) => {
    if (!series.has(key)) series.set(key, { name, secondary, points: [] });
    return series.get(key)!;
  };

  def.parts.forEach((part, pIdx) => {
    const text = files[part.file];
    if (!text) return;
    const h = part.headings;
    for (const row of text.split(/\r?\n/).slice(1)) {
      const t = row.split(/\t/).map(s => s.trim()).filter(s => s !== '');
      if (t.length < 4) continue;
      const [simS, state, distS, timeS] = t;
      if (!def.initialSolutions && /^i_/.test(state)) continue;
      const sim = def.connectSimulations ? '' : ` (sim ${simS})`;
      let x = NaN, hasX = false, ci = 0, pi = 0, mode = '';
      let pair: number[] = [];
      const ensureX = () => {
        if (hasX) return;
        x = def.plotVs === 't' ? Number(timeS) : Number(distS);
        if (!Number.isFinite(x) || x === -99) x = Number(timeS);
        hasX = Number.isFinite(x) && x !== -99;
      };
      for (const tok of t.slice(4)) {
        if (/^@[XYSPQ]$/.test(tok)) { mode = tok; pair = []; continue; }
        const v = Number(tok);
        if (mode === '@X') { if (!hasX) { x = v; hasX = true; } continue; }
        if (mode === '@P' || mode === '@Q') {
          pair.push(v);
          if (pair.length === 2) {
            const name = (h[pi] || `curve ${pi + 1}`) + sim;
            if (!missing(pair[0]) && !missing(pair[1])) get(`${pIdx}p${pi}${sim}`, name, mode === '@Q').points.push({ x: pair[0], y: pair[1] });
            pi++; pair = [];
          }
          continue;
        }
        if (mode === '@Y' || mode === '@S') {
          ensureX();
          const idx = ci++;
          const name = (h[idx + 1] || `y${idx + 1}`) + sim;
          if (!missing(v) && hasX) get(`${pIdx}c${idx}${sim}`, name, mode === '@S').points.push({ x, y: v });
        }
      }
    }
  });
  const out = [...series.values()].filter(s => s.points.length);
  for (const f of def.overlays) if (files[f]) out.push(...readOverlay(files[f], f));
  return { def, series: out };
}
