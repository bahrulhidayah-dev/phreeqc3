// Main-thread side of the engine: one Web Worker, runs queued one at a time, cancel by terminating.
import type { RunRequest, RunResult } from './types';

let worker: Worker | null = null;
let seq = 0;
let pending: { id: number; resolve: (r: RunResult) => void; reject: (e: Error) => void } | null = null;

function spawn() {
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (ev: MessageEvent<RunResult>) => {
    if (pending && ev.data.id === pending.id) { pending.resolve(ev.data); pending = null; }
  };
  worker.onerror = ev => {
    if (pending) { pending.reject(new Error(ev.message || 'engine worker error')); pending = null; }
    worker?.terminate(); worker = null;
  };
}

export function runPhreeqc(req: Omit<RunRequest, 'id' | 'base'>): Promise<RunResult> {
  if (!worker) spawn();
  if (pending) cancelRun();
  if (!worker) spawn();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending = { id, resolve, reject };
    worker!.postMessage({ ...req, id, base: import.meta.env.BASE_URL } satisfies RunRequest);
  });
}

export function cancelRun() {
  if (pending) { pending.reject(new Error('cancelled')); pending = null; }
  worker?.terminate(); worker = null;
}

const textCache = new Map<string, Promise<string>>();
/** Loads a file shipped with the app (database, example) via fetch, never as a download link. */
export function fetchText(rel: string): Promise<string> {
  if (!textCache.has(rel)) {
    textCache.set(rel, fetch(import.meta.env.BASE_URL + rel).then(r => {
      if (!r.ok) throw new Error(`${rel}: ${r.status}`);
      return r.text();
    }).catch(e => { textCache.delete(rel); throw e; }));
  }
  return textCache.get(rel)!;
}
