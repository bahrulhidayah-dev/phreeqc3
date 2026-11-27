// Layer 1b: one water analysis speciated with every database shipped in ../database (all subfolders),
// in the WebAssembly engine and in native PHREEQC; the outputs are compared number by number.
// Usage: node layer1-db.mjs /path/to/native/phreeqc [out.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareText, classify } from './compare.mjs';

const native = path.resolve(process.argv[2]);
const root = path.resolve(import.meta.dirname, '../..');
const { default: createPhreeqc } = await import(path.join(root, 'web/app/public/engine/phreeqc.mjs'));
const walk = d => fs.readdirSync(d).flatMap(f => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? walk(p) : /\.dat$/i.test(f) ? [p] : []; });
const dbs = walk(path.join(root, 'database')).sort();
// a river water; elements a database does not know are reported by PHREEQC as errors, so each run
// first checks which master species exist and keeps only those
const ANALYSIS = { Ca: 1.2, Mg: 0.4, Na: 0.9, K: 0.08, Cl: 0.7, 'S(6)': 0.3, Alkalinity: 2.4, Si: 0.2 };
const input = db => {
  const txt = fs.readFileSync(db, 'latin1');
  const has = el => new RegExp(`^\\s*${el.replace(/[()]/g, '\\$&')}\\s`, 'mi').test(txt.split(/^\s*SOLUTION_SPECIES/mi)[0]);
  const lines = Object.entries(ANALYSIS).filter(([e]) => has(e) || (e === 'S(6)' && has('S')) ).map(([e, v]) => `    ${e} ${v}`);
  return { text: `SOLUTION 1 river water\n    units mmol/kgw\n    temp 15\n    pH 7.6\n${lines.join('\n')}\nEND\nSOLUTION 2\n    temp 60\n    pH 9.5\n    units mmol/kgw\n${lines.join('\n')}\nEND\n`, n: lines.length };
};
const results = [];
for (const db of dbs) {
  const rel = path.relative(path.join(root, 'database'), db);
  const { text, n } = input(db);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'db-'));
  fs.copyFileSync(db, path.join(d, 'db.dat')); fs.writeFileSync(path.join(d, 'in.pqi'), text);
  let rcN = 0; try { execFileSync(native, ['in.pqi', 'out.out', 'db.dat'], { cwd: d, stdio: 'pipe', timeout: 120000 }); } catch (e) { rcN = e.status ?? 1; }
  const nat = fs.existsSync(path.join(d, 'out.out')) ? fs.readFileSync(path.join(d, 'out.out'), 'utf8') : '';
  fs.rmSync(d, { recursive: true, force: true });
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.chdir('/w'); M.FS.writeFile('db.dat', fs.readFileSync(db)); M.FS.writeFile('in.pqi', text);
  let rcW = 0; try { rcW = M.callMain(['in.pqi', 'out.out', 'db.dat']); } catch { rcW = -1; }
  let wasm = ''; try { wasm = new TextDecoder().decode(M.FS.readFile('out.out')); } catch { /* none */ }
  const c = compareText(wasm, nat); c.cls = classify(c); delete c.diffs;
  const errN = (nat.match(/^ERROR/gm) || []).length, errW = (wasm.match(/^ERROR/gm) || []).length;
  const pass = rcN === rcW && errN === errW && c.cls.other === 0;
  results.push({ db: rel, elements: n, rcNative: rcN, rcWasm: rcW, errorsNative: errN, errorsWasm: errW, numbers: c.numbers, ...c.cls, pass });
  console.log(rel.padEnd(42), 'el', n, 'rc', rcN, rcW, 'err', errN, errW, 'nums', c.numbers, 'indet', c.cls.indeterminate, 'OTHER', c.cls.other, pass ? 'PASS' : 'FAIL', c.cls.examples.slice(0, 1).join(''));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(results, null, 1));
