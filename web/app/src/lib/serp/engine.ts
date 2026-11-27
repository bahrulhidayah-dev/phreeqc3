// Runs lab models on the same PHREEQC worker as the main app, always with llnl.dat.
import { fetchText, runPhreeqc } from '../../engine/client.ts';
import { parseSel, type SelTable } from '../parseOutput.ts';
import { SERP_DB } from './model.ts';

export interface LabRun { ok: boolean; tables: Record<string, SelTable>; error: string; input: string; ms: number }

export async function runLab(input: string): Promise<LabRun> {
  const text = await fetchText('databases/' + SERP_DB);
  const res = await runPhreeqc({ input, database: { name: SERP_DB, text }, files: {} });
  const tables: Record<string, SelTable> = {};
  for (const [f, txt] of Object.entries(res.files)) if (/\.sel$/.test(f)) tables[f] = parseSel(txt);
  const err = [...res.errors.split('\n'), ...res.output.split('\n')].filter(l => /^ERROR:/.test(l.trim())).map(l => l.trim().replace(/^ERROR:\s*/, ''));
  return { ok: res.ok && !err.length, tables, error: [...new Set(err)].slice(0, 3).join(' · '), input, ms: res.ms };
}
