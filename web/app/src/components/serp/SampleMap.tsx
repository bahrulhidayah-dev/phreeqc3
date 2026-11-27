// Stage 6: field samples on a map (Leaflet + OpenStreetMap tiles), colored by a chosen value.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as LMap, LayerGroup, TileLayer } from 'leaflet';
import type { STFn } from '../../lib/serp/i18n';
import type { ThemeColors } from '../Chart';
import type { FieldSample } from '../../lib/serp/field';
import { allReferenceSamples, gasMapPoints } from '../../lib/serp/reference';
import { rampColor } from '../../lib/serp/contour';
import { safeName, saveSVG, saveText, toCSV } from '../../lib/download';
import { fmt } from './common';

type Var = 'pH' | 'H2' | 'temp' | 'MgCa' | 'Ca' | 'Mg';
const VARS: { id: Var; label: string; get: (s: FieldSample) => number | undefined; log?: boolean }[] = [
  { id: 'pH', label: 'pH', get: s => s.pH },
  { id: 'H2', label: 'H₂, µmol/L', get: s => (s.conc.H2 != null ? s.conc.H2 * 1000 : undefined), log: true },
  { id: 'temp', label: 'T, °C', get: s => s.temp },
  { id: 'MgCa', label: 'Mg/Ca', get: s => (s.conc.Mg != null && s.conc.Ca ? s.conc.Mg / s.conc.Ca : undefined), log: true },
  { id: 'Ca', label: 'Ca, mmol/L', get: s => s.conc.Ca },
  { id: 'Mg', label: 'Mg, mmol/L', get: s => s.conc.Mg },
];
const NO_DATA = '#9AA6AB';
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

export function SampleMap({ st, colors, field, toast }: { st: STFn; colors: ThemeColors; field: FieldSample[]; toast: (m: string) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const L = useRef<{ map: LMap; layer: LayerGroup; tiles: TileLayer; lib: typeof import('leaflet') } | null>(null);
  const [v, setV] = useState<Var>('pH');
  const [base, setBase] = useState(true);
  const [showRef, setShowRef] = useState(false);
  const [ready, setReady] = useState(false);

  const pts = useMemo(() => {
    const own = field.filter(s => !s.ref);
    const refs = showRef ? [...allReferenceSamples(), ...gasMapPoints()] : field.filter(s => s.ref);
    const seen = new Set<string>();
    return [...own, ...refs].filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lon) && Math.abs(s.lat!) <= 90 && Math.abs(s.lon!) <= 180)
      .filter(s => { const k = s.id + '|' + s.name; if (seen.has(k)) return false; seen.add(k); return true; });
  }, [field, showRef]);
  const V = VARS.find(x => x.id === v)!;
  const vals = pts.map(V.get).filter((x): x is number => x != null && Number.isFinite(x) && (!V.log || x > 0));
  const tr = (x: number) => (V.log ? Math.log10(x) : x);
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const color = (s: FieldSample) => { const x = V.get(s); if (x == null || !Number.isFinite(x) || (V.log && x <= 0)) return NO_DATA; return rampColor(hi > lo ? (tr(x) - tr(lo)) / (tr(hi) - tr(lo)) : 0.6); };

  // create the map once (Leaflet is loaded only when this tab opens)
  useEffect(() => {
    let dead = false;
    (async () => {
      const lib = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (dead || !host.current) return;
      const map = lib.map(host.current, { worldCopyJump: true }).setView([0, 110], 3);
      const tiles = lib.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' });
      tiles.addTo(map);
      const layer = lib.layerGroup().addTo(map);
      L.current = { map, layer, tiles, lib };
      setReady(true);
    })().catch(e => toast(String((e as Error).message || e)));
    return () => { dead = true; L.current?.map.remove(); L.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const m = L.current; if (!m) return; if (base) m.tiles.addTo(m.map); else m.tiles.remove(); }, [base, ready]);

  const fit = () => {
    const m = L.current; if (!m || !pts.length) return;
    if (pts.length === 1) m.map.setView([pts[0].lat!, pts[0].lon!], 11);
    else m.map.fitBounds(m.lib.latLngBounds(pts.map(p => [p.lat!, p.lon!] as [number, number])).pad(0.2));
  };
  useEffect(() => {
    const m = L.current; if (!m) return;
    m.layer.clearLayers();
    for (const s of pts) {
      const x = V.get(s);
      const html = `<b>${esc(s.name)}</b>${s.group ? `<br><span style="opacity:.7">${esc(s.group)}</span>` : ''}<br>${esc(V.label)}: ${x != null ? fmt(x, 4) : '–'}`
        + `${s.pH != null ? `<br>pH ${s.pH}` : ''}${s.temp != null ? ` · ${s.temp} °C` : ''}<br>${s.lat!.toFixed(4)}, ${s.lon!.toFixed(4)}`;
      m.lib.circleMarker([s.lat!, s.lon!], { radius: s.ref ? 6 : 8, color: '#14232B', weight: 1.5, fillColor: color(s), fillOpacity: 0.95 })
        .bindTooltip(html).addTo(m.layer);
    }
    fit();
  }, [pts, v, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const csv = () => saveText(toCSV(['id', 'name', 'group', 'latitude', 'longitude', 'temp_C', 'pH', V.label],
    pts.map(s => [s.id, s.name, s.group ?? '', s.lat!, s.lon!, s.temp ?? '', s.pH ?? '', V.get(s) ?? ''])), 'aquos-samples.csv', 'text/csv');
  const geojson = () => saveText(JSON.stringify({
    type: 'FeatureCollection',
    features: pts.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: { id: s.id, name: s.name, group: s.group ?? null, temp_C: s.temp ?? null, pH: s.pH ?? null, ...Object.fromEntries(Object.entries(s.conc).map(([k, x]) => [k + '_mmol_L', +x.toPrecision(5)])) } })),
  }, null, 1), 'aquos-samples.geojson', 'application/geo+json');

  // points-only SVG (equirectangular), for figures
  const W = 760, H = 460, pad = 50;
  const lons = pts.map(p => p.lon!), lats = pts.map(p => p.lat!);
  const [x0, x1] = lons.length ? [Math.min(...lons), Math.max(...lons)] : [0, 1], [y0, y1] = lats.length ? [Math.min(...lats), Math.max(...lats)] : [0, 1];
  const span = Math.max(x1 - x0, (y1 - y0) * (W / H), 0.01) * 1.15;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, k = (W - 2 * pad) / span;
  const px = (lon: number) => W / 2 + (lon - cx) * k, py = (lat: number) => H / 2 - (lat - cy) * k;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel">
        <div className="panel-h"><h3>{st('mp_h')} · {pts.length}</h3>
          <div className="export"><span className="lbl">{st('dl')}</span>
            <button className="btn sm" type="button" disabled={!pts.length} onClick={csv}>CSV</button>
            <button className="btn sm" type="button" disabled={!pts.length} onClick={geojson}>GeoJSON</button>
            <button className="btn sm" type="button" disabled={!pts.length} title={st('mp_svg_note')} onClick={() => svgRef.current && saveSVG(svgRef.current, safeName('aquos-sample-map') + '.svg')}>SVG</button></div>
        </div>
        <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="lab-checks">
            <label className="field" style={{ width: 180 }}><span className="lab">{st('mp_color')}</span>
              <select value={v} onChange={e => setV(e.target.value as Var)}>{VARS.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
            <label className="opts"><input type="checkbox" checked={base} onChange={e => setBase(e.target.checked)} /> {st('mp_base')}</label>
            <label className="opts"><input type="checkbox" checked={showRef} onChange={e => setShowRef(e.target.checked)} /> {st('mp_ref')}</label>
            <button className="btn sm" type="button" onClick={fit} disabled={!pts.length}>{st('mp_fit')}</button>
          </div>
          {!pts.length && <p className="note">{st('mp_none')}</p>}
          <div ref={host} className="lab-map" />
          <div className="lab-legend">
            <span>{V.label}</span><span>{vals.length ? fmt(lo, 3) : '–'}</span>
            <span className="bar" style={{ background: `linear-gradient(90deg, ${rampColor(0)}, ${rampColor(0.5)}, ${rampColor(1)})` }} />
            <span>{vals.length ? fmt(hi, 3) : '–'}</span>{V.log && <span>(log)</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, borderRadius: 5, background: NO_DATA, display: 'inline-block' }} />{st('mp_nodata')}</span>
          </div>
        </div>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ display: 'none' }} aria-hidden="true">
        <rect width={W} height={H} fill={colors.bg} />
        <text x={pad} y={28} fontSize={14} fontWeight={600} fill={colors.ink} fontFamily="Arial, sans-serif">{st('mp_h')} · {V.label}</text>
        <rect x={pad / 2} y={40} width={W - pad} height={H - 70} fill="none" stroke={colors.line} />
        {pts.map((s, i) => <g key={i}><circle cx={px(s.lon!)} cy={py(s.lat!)} r={6} fill={color(s)} stroke="#FFFFFF" strokeWidth={1.5} />
          <text x={px(s.lon!) + 8} y={py(s.lat!) + 4} fontSize={10} fill={colors.ink} fontFamily="Arial, sans-serif">{s.name}</text></g>)}
        <text x={pad / 2} y={H - 12} fontSize={10.5} fill={colors.muted} fontFamily="Arial, sans-serif">lon {fmt(cx - span / 2, 5)} … {fmt(cx + span / 2, 5)} · lat {fmt(cy - span * H / W / 2, 5)} … {fmt(cy + span * H / W / 2, 5)} · WGS84, equirectangular · {V.label} {fmt(lo, 3)} – {fmt(hi, 3)}</text>
      </svg>
    </div>
  );
}
