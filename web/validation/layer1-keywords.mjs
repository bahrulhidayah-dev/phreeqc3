// Layer 1c: every keyword template the app offers (lib/keywords.ts, 80 keywords) run with phreeqc.dat,
// in the WebAssembly engine and in native PHREEQC. A template is inserted after two saved solutions,
// as a user would add it to a project. Usage: node layer1-keywords.mjs /path/to/native/phreeqc [out.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareText, classify } from './compare.mjs';

const native = path.resolve(process.argv[2]);
const root = path.resolve(import.meta.dirname, '../..');
const { default: createPhreeqc } = await import(path.join(root, 'web/app/public/engine/phreeqc.mjs'));
const { GROUPS } = await import(path.join(root, 'web/app/src/lib/keywords.ts'));
const { transformUserGraphs } = await import(path.join(root, 'web/app/src/lib/userGraph.ts'));
const BASE = 'SOLUTION 1\n    pH 7\n    Ca 1\n    Cl 2\nSOLUTION 2\n    pH 8\n    Na 10\n    Cl 10\nEND\n';
const results = [];
for (const g of GROUPS) for (const k of g.keywords) {
  // a template that names a database in its description ("use iso.dat") is run with that database;
  // DATABASE is placed first, as the app does when it inserts it
  const db = path.join(root, 'database', (k.desc.match(/use (\S+\.dat)/) || [, 'phreeqc.dat'])[1]);
  const input = k.name === 'DATABASE' ? k.template + BASE + 'END\n' : BASE + k.template + '\nEND\n';
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'kw-'));
  fs.copyFileSync(db, path.join(d, 'phreeqc.dat')); fs.writeFileSync(path.join(d, 'in.pqi'), input);
  let rcN = 0; try { execFileSync(native, ['in.pqi', 'out.out', 'phreeqc.dat'], { cwd: d, stdio: 'pipe', timeout: 120000 }); } catch (e) { rcN = e.status ?? 1; }
  const nat = fs.existsSync(path.join(d, 'out.out')) ? fs.readFileSync(path.join(d, 'out.out'), 'utf8') : '';
  fs.rmSync(d, { recursive: true, force: true });
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w'); M.FS.writeFile('phreeqc.dat', fs.readFileSync(db));
  M.FS.writeFile('in.pqi', transformUserGraphs(input).input);
  let rcW = 0; try { rcW = M.callMain(['in.pqi', 'out.out', 'phreeqc.dat']); } catch { rcW = -1; }
  let wasm = ''; try { wasm = new TextDecoder().decode(M.FS.readFile('out.out')); } catch { /* none */ }
  const c = compareText(wasm, nat, { echo: false }); c.cls = classify(c); delete c.diffs;
  const errs = t => (t.match(/^ERROR:.*$/gm) || []);
  const pass = rcN === 0 && rcW === 0 && errs(wasm).length === 0 && c.cls.other === 0;
  results.push({ group: g.id, keyword: k.name, rcNative: rcN, rcWasm: rcW, errors: errs(wasm).slice(0, 3), warnings: (wasm.match(/^WARNING:.*$/gm) || []).length, ...c.cls, pass });
  console.log(k.name.padEnd(30), 'rc', rcN, rcW, 'OTHER', c.cls.other, pass ? 'PASS' : 'FAIL', [...errs(wasm).slice(0, 2), ...c.cls.examples.slice(0, 1)].join(' | ').slice(0, 200));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(results, null, 1));
