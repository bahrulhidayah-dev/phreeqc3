/// <reference lib="webworker" />
// Runs the unmodified PHREEQC 3 engine (compiled to WebAssembly) off the main thread.
// Each run gets a fresh engine instance so no state leaks between runs.
import type { RunRequest, RunResult } from './types';

type EngineModule = {
  FS: {
    mkdir(p: string): void; chdir(p: string): void; readdir(p: string): string[];
    writeFile(p: string, d: string | Uint8Array): void; readFile(p: string): Uint8Array;
    stat(p: string): { mode: number }; isFile(mode: number): boolean;
  };
  callMain(args: string[]): number;
};
type Factory = (opts: Record<string, unknown>) => Promise<EngineModule>;

let factory: Factory | null = null;
let wasmBinary: ArrayBuffer | null = null;

async function load(base: string) {
  if (factory && wasmBinary) return;
  const url = new URL('engine/phreeqc.mjs', new URL(base, self.location.href)).href;
  const mod = await import(/* @vite-ignore */ url);
  factory = mod.default as Factory;
  const res = await fetch(new URL('engine/phreeqc.wasm', new URL(base, self.location.href)).href);
  if (!res.ok) throw new Error(`engine download failed (${res.status})`);
  wasmBinary = await res.arrayBuffer();
}

const dec = new TextDecoder();

self.onmessage = async (ev: MessageEvent<RunRequest>) => {
  const req = ev.data;
  const t0 = performance.now();
  const screen: string[] = [];
  const errors: string[] = [];
  try {
    await load(req.base);
    const M = await factory!({
      wasmBinary,
      print: (s: string) => screen.push(s),
      printErr: (s: string) => errors.push(s),
    });
    M.FS.mkdir('/work');
    M.FS.chdir('/work');
    const put = (name: string, text: string) => {
      const parts = name.split('/').filter(Boolean);
      let dir = name.startsWith('/') ? '' : '.';
      for (const p of parts.slice(0, -1)) { dir += '/' + p; try { M.FS.mkdir(dir); } catch { /* exists */ } }
      M.FS.writeFile(name, text);
    };
    for (const [name, text] of Object.entries(req.files || {})) put(name, text);
    put(req.database.name, req.database.text);
    M.FS.writeFile('input.pqi', req.input);
    const before = new Set(M.FS.readdir('.'));
    let rc = 0;
    try {
      rc = M.callMain(['input.pqi', 'output.out', req.database.name]);
    } catch (e) {
      rc = -1;
      errors.push(String((e as Error)?.message || e));
    }
    const read = (f: string) => { try { return dec.decode(M.FS.readFile(f)); } catch { return ''; } };
    const files: Record<string, string> = {};
    for (const f of M.FS.readdir('.')) {
      if (f === '.' || f === '..' || before.has(f) || f === 'output.out' || f === 'phreeqc.log') continue;
      try { if (M.FS.isFile(M.FS.stat(f).mode)) files[f] = read(f); } catch { /* skip */ }
    }
    const result: RunResult = {
      id: req.id, ok: rc === 0, rc,
      output: read('output.out'), log: read('phreeqc.log'),
      files, screen: screen.join('\n'), errors: errors.join('\n'),
      ms: Math.round(performance.now() - t0),
    };
    (self as unknown as Worker).postMessage(result);
  } catch (e) {
    const result: RunResult = {
      id: req.id, ok: false, rc: -1, output: '', log: '', files: {},
      screen: screen.join('\n'), errors: [...errors, String((e as Error)?.message || e)].join('\n'),
      ms: Math.round(performance.now() - t0),
    };
    (self as unknown as Worker).postMessage(result);
  }
};
