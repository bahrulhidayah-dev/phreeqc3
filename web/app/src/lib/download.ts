// Every file the app gives the user is built in memory and handed over only after a click.
// No file links are rendered in the page, so download managers have nothing to catch on load.

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const saveText = (text: string, filename: string, type = 'text/plain;charset=utf-8') => saveBlob(new Blob([text], { type }), filename);

export function safeName(s: string, fallback = 'aquos') {
  return (s || fallback).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 80) || fallback;
}

export function toCSV(columns: string[], rows: (string | number)[][]) {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns, ...rows].map(r => r.map(cell).join(',')).join('\n');
}

export async function saveXLSX(sheets: { name: string; columns: string[]; rows: (string | number)[][] }[], filename: string) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Aquos Geochemistry';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[[\]*?/\\:]/g, '_').slice(0, 31) || 'Sheet');
    ws.addRow(s.columns).font = { bold: true };
    for (const r of s.rows) ws.addRow(r);
    ws.columns.forEach(c => { c.width = 14; });
  }
  const buf = await wb.xlsx.writeBuffer();
  saveBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

/** Serializes an inline SVG element with its computed colors so it looks the same outside the page. */
export function svgString(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const w = svg.viewBox.baseVal?.width || svg.clientWidth, h = svg.viewBox.baseVal?.height || svg.clientHeight;
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
}

export async function saveSVG(svg: SVGSVGElement, filename: string) {
  saveText(svgString(svg), filename, 'image/svg+xml');
}

export async function savePNG(svg: SVGSVGElement, filename: string, scale = 3) {
  const src = svgString(svg);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([src], { type: 'image/svg+xml' }));
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('render failed')); img.src = url; });
  const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale); c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/png'));
  if (blob) saveBlob(blob, filename);
}

export async function savePDF(svg: SVGSVGElement, filename: string) {
  const [{ jsPDF }, { svg2pdf }] = await Promise.all([import('jspdf'), import('svg2pdf.js')]);
  const w = svg.viewBox.baseVal.width, h = svg.viewBox.baseVal.height;
  const doc = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w, h] });
  const holder = new DOMParser().parseFromString(svgString(svg), 'image/svg+xml').documentElement as unknown as SVGSVGElement;
  await svg2pdf(holder, doc, { x: 0, y: 0, width: w, height: h });
  doc.save(filename);
}
