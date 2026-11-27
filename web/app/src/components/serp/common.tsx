// Small shared pieces of the serpentinization lab.
import type { SelTable } from '../../lib/parseOutput';
import { safeName, saveText, saveXLSX, toCSV } from '../../lib/download';

export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
export const fmt = (v: number, p = 3) => (!Number.isFinite(v) ? '–' : v === 0 ? '0' : Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5 ? v.toExponential(2) : String(+v.toPrecision(p)));

const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
// Scientific notation for display, e.g. 7.80 × 10⁻⁴ (plain decimal when the exponent is small).
export const sci = (v: number, p = 3) => {
  if (!Number.isFinite(v)) return '–';
  if (v === 0 || (Math.abs(v) >= 1e-2 && Math.abs(v) < 1e5)) return String(+v.toPrecision(p));
  const [m, e] = v.toExponential(p - 1).split('e');
  return `${m} × 10${String(+e).split('').map(c => SUP[c] ?? c).join('')}`;
};

export function NumField({ label, value, onChange, step = 'any', min, max, hint }: { label: string; value: number; onChange: (v: number) => void; step?: number | 'any'; min?: number; max?: number; hint?: string }) {
  return (
    <label className="field"><span className="lab">{label}</span>
      <input type="number" value={Number.isFinite(value) ? value : ''} step={step} min={min} max={max}
        onChange={e => { const v = e.target.valueAsNumber; if (Number.isFinite(v)) onChange(v); }} />
      {hint && <span className="note">{hint}</span>}
    </label>
  );
}

export function Kpi({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return <div className="panel kpi"><span className="lbl">{label}</span><span className="val">{value}{unit && <small>{unit}</small>}</span>{sub && <span className="st muted">{sub}</span>}</div>;
}

export function TableDownloads({ table, base, label }: { table: SelTable; base: string; label: string }) {
  const name = safeName(base);
  return (
    <div className="export"><span className="lbl">{label}</span>
      <button className="btn sm" type="button" onClick={() => saveText(toCSV(table.columns, table.rows), name + '.csv', 'text/csv')}>CSV</button>
      <button className="btn sm" type="button" onClick={() => saveXLSX([{ name: base.slice(0, 31), columns: table.columns, rows: table.rows }], name + '.xlsx')}>XLSX</button>
    </div>
  );
}

export function DataTable({ table, max = 200 }: { table: SelTable; max?: number }) {
  return (
    <div className="tbl-wrap" style={{ maxHeight: 360 }}>
      <table className="data">
        <thead><tr>{table.columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>{table.rows.slice(0, max).map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className="num">{typeof v === 'number' ? fmt(v, 4) : v}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
