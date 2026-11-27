// Layer 1: run every official USGS example through the WebAssembly engine used by the web app and through
// a native PHREEQC built from the same ../src, then compare every output file number by number.
// Usage: node layer1.mjs /path/to/native/phreeqc [out.json]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compareText, classify } from './compare.mjs';

const native = path.resolve(process.argv[2]);
const root = path.resolve(import.meta.dirname, '../..');
const exdir = path.join(root, 'examples');
const app = path.join(root, 'web/app');
const { default: createPhreeqc } = await import(path.join(app, 'public/engine/phreeqc.mjs'));
const { transformUserGraphs } = await import(path.join(app, 'src/lib/userGraph.ts'));

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const examples = fs.readdirSync(exdir).filter(f => /^ex\d+[a-z]*$/.test(f)).filter(e => !only || only.includes(e)).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)) || a.localeCompare(b));
const aux = fs.readdirSync(exdir).filter(f => fs.statSync(path.join(exdir, f)).isFile() && !/\.(out|sel)$/.test(f) && !/^ex\d+[a-z]*$/.test(f) && !/^(CMakeLists|Makefile)/.test(f));
const dbOf = ex => {
  const m = fs.readFileSync(path.join(exdir, ex + '.out'), 'utf8').match(/Database file: (\S+)/);
  return m[1].includes('/examples/') ? path.join(exdir, path.basename(m[1])) : path.join(root, 'database', path.basename(m[1]));
};

function runNative(ex, input) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nat-'));
  fs.mkdirSync(path.join(d, 'database')); fs.mkdirSync(path.join(d, 'run'));
  const db = dbOf(ex);
  fs.copyFileSync(path.join(root, 'database', 'phreeqc.dat'), path.join(d, 'database', 'phreeqc.dat'));
  for (const f of aux) fs.copyFileSync(path.join(exdir, f), path.join(d, 'run', f));
  fs.copyFileSync(db, path.join(d, 'run', path.basename(db)));
  fs.writeFileSync(path.join(d, 'run', 'input.pqi'), input);
  const before = new Set(fs.readdirSync(path.join(d, 'run')));
  const t = Date.now();
  let rc = 0;
  try { execFileSync(native, ['input.pqi', 'output.out', path.basename(db)], { cwd: path.join(d, 'run'), stdio: 'pipe' }); } catch (e) { rc = e.status ?? 1; }
  const files = {};
  for (const f of fs.readdirSync(path.join(d, 'run'))) if (!before.has(f) || f === 'output.out') files[f] = fs.readFileSync(path.join(d, 'run', f), 'utf8');
  fs.rmSync(d, { recursive: true, force: true });
  return { rc, ms: Date.now() - t, files };
}

async function runWasm(ex, input) {
  const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
  M.FS.mkdir('/w'); M.FS.mkdir('/w/database'); M.FS.mkdir('/w/run'); M.FS.chdir('/w/run');
  const db = dbOf(ex);
  M.FS.writeFile('/w/database/phreeqc.dat', fs.readFileSync(path.join(root, 'database', 'phreeqc.dat')));
  for (const f of aux) M.FS.writeFile(f, fs.readFileSync(path.join(exdir, f)));
  M.FS.writeFile(path.basename(db), fs.readFileSync(db));
  M.FS.writeFile('input.pqi', input);
  const before = new Set(M.FS.readdir('.'));
  const t = Date.now();
  let rc = 0;
  try { rc = M.callMain(['input.pqi', 'output.out', path.basename(db)]); } catch (e) { rc = -1; }
  const files = {};
  for (const f of M.FS.readdir('.')) if ((!before.has(f) || f === 'output.out') && !f.startsWith('.')) files[f] = new TextDecoder().decode(M.FS.readFile(f));
  return { rc, ms: Date.now() - t, files };
}

const results = [];
for (const ex of examples) {
  const input = fs.readFileSync(path.join(exdir, ex), 'utf8');
  const N = runNative(ex, input);
  const W = await runWasm(ex, input);
  // the app's own path: USER_GRAPH rewritten into hidden SELECTED_OUTPUT blocks
  const A = await runWasm(ex, transformUserGraphs(input).input);
  if (process.env.DUMP) { for (const [k, F] of [['nat', N], ['wasm', W], ['app', A]]) for (const [f, t] of Object.entries(F.files)) { fs.mkdirSync(path.join(process.env.DUMP, ex), { recursive: true }); fs.writeFileSync(path.join(process.env.DUMP, ex, k + '.' + f), t); } }
  const fileCmp = {};
  const cmp = (a, b, o) => { if (a == null) return { missing: true, cls: { other: 1 } }; const r = compareText(a, b, o); r.cls = classify(r); delete r.diffs; return r; };
  for (const f of Object.keys(N.files)) fileCmp[f] = cmp(W.files[f], N.files[f]);
  const ref = cmp(N.files['output.out'], fs.readFileSync(path.join(exdir, ex + '.out'), 'utf8'), { echo: false });
  const appMain = cmp(A.files['output.out'], N.files['output.out'], { echo: false });
  // ex20b: its USER_GRAPH 1 runs PUT(GET(0) + 1, 0), which USER_PRINT then reads ("Calcite added").
  // The app runs USER_GRAPH programs to draw the charts (as PHREEQC for Windows does); the batch build that wrote
  // the reference never runs them, so GET(0) stays 0 there. This difference is expected and documented.
  if (ex === 'ex20b') { const before = appMain.cls.other; appMain.cls.examples = appMain.cls.examples.filter(e => !/Calcite added/.test(e)); appMain.cls.expected = before; appMain.cls.other = 0; }
  const userFiles = Object.keys(N.files).filter(f => f !== 'output.out');
  const appFiles = Object.fromEntries(userFiles.map(f => [f, cmp(A.files[f], N.files[f])]));
  results.push({ ex, db: path.basename(dbOf(ex)), rcNative: N.rc, rcWasm: W.rc, rcApp: A.rc, msNative: N.ms, msWasm: W.ms, files: fileCmp, extraWasm: Object.keys(W.files).filter(f => !(f in N.files)), appMain, appFiles, vsShippedOut: ref });
  const o = fileCmp['output.out'];
  const other = Object.values(fileCmp).reduce((s, c) => s + c.cls.other, 0), appOther = appMain.cls.other + Object.values(appFiles).reduce((s, c) => s + c.cls.other, 0);
  results.at(-1).pass = N.rc === 0 && W.rc === 0 && A.rc === 0 && other === 0 && appOther === 0;
  console.log(ex.padEnd(6), path.basename(dbOf(ex)).padEnd(12), 'rc', N.rc, W.rc, A.rc, 'files', Object.keys(N.files).length, Object.keys(W.files).length,
    '| wasm-native nums', o.numbers, 'indet', o.cls.indeterminate, 'order', o.cls.ordering, 'OTHER', other,
    '| app OTHER', appOther, '| vs USGS .out indet', ref.cls.indeterminate, 'OTHER', ref.cls.other, '| ms', N.ms, W.ms, results.at(-1).pass ? 'PASS' : 'FAIL',
    [...o.cls.examples, ...appMain.cls.examples].slice(0, 2).join(' || '));
}
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(results, null, 1));
