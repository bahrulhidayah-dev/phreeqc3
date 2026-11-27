// Speciates the field samples once with PHREEQC (llnl.dat); diagrams and calculators share the result.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fieldSolutions, type FieldSample, type RefElectrode } from '../../lib/serp/field';
import { records, speciationInput } from '../../lib/serp/thermo';
import { runLab } from '../../lib/serp/engine';
import type { STFn } from '../../lib/serp/i18n';

export type SpecRow = Record<string, number | string>;
export interface Speciation { rows: (SpecRow | null)[] | null; busy: boolean; run: () => Promise<(SpecRow | null)[] | null>; error: string }

export function useSpeciation(field: FieldSample[], electrode: RefElectrode, toast: (m: string) => void, st: STFn): Speciation {
  const [rows, setRows] = useState<(SpecRow | null)[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sig = JSON.stringify([field, electrode]);
  const last = useRef('');
  useEffect(() => { if (last.current !== sig) setRows(null); }, [sig]);
  const run = useCallback(async () => {
    if (!field.length) return null;
    setBusy(true); setError('');
    try {
      const one = async (list: FieldSample[]) => {
        const r = await runLab(speciationInput(fieldSolutions(list, 4, electrode)));
        return { r, recs: records(r.tables['samples.sel'] ?? { columns: [], rows: [] }) };
      };
      const all = await one(field);
      let out: (SpecRow | null)[];
      let err = '';
      if (all.r.ok && all.recs.length === field.length) out = all.recs;
      else {
        // a sample that does not converge stops PHREEQC: speciate the samples one by one
        out = [];
        for (const s of field) { const x = await one([s]); out.push(x.r.ok && x.recs.length === 1 ? x.recs[0] : null); if (!x.r.ok) err = `${s.name}: ${x.r.error}`; }
      }
      last.current = sig; setRows(out);
      if (err) { setError(err); toast(st('failed', { msg: err })); }
      return out;
    } catch (e) { if ((e as Error).message !== 'cancelled') toast(String((e as Error).message || e)); return null; }
    finally { setBusy(false); }
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  return { rows, busy, run, error };
}
