// Usage: node run-example.mjs <exN> ; runs examples/<exN> with database/phreeqc.dat in the WASM engine
import createPhreeqc from '../../app/public/engine/phreeqc.mjs';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../..');
const ex = process.argv[2] || 'ex1';
const M = await createPhreeqc({ print: () => {}, printErr: () => {} });
M.FS.mkdir('/w'); M.FS.chdir('/w');
const exdir = path.join(root, 'examples');
for (const f of fs.readdirSync(exdir)) { const p = path.join(exdir, f); if (fs.statSync(p).isFile() && !/\.(out|sel)$/.test(f)) M.FS.writeFile(f, fs.readFileSync(p)); }
M.FS.writeFile('phreeqc.dat', fs.readFileSync(path.join(root, 'database/phreeqc.dat')));
const t = Date.now();
const rc = M.callMain([ex, ex + '.out', 'phreeqc.dat']);
const out = new TextDecoder().decode(M.FS.readFile(ex + '.out'));
console.log(ex, 'rc', rc, 'ms', Date.now() - t, 'out bytes', out.length, 'files', M.FS.readdir('.').filter(f => !f.startsWith('.')).join(' '));
const ref = fs.readFileSync(path.join(exdir, ex + '.out'), 'utf8');
const nums = s => (s.match(/-?\d+\.\d+e?[-+]?\d*/g) || []);
const a = nums(out), b = nums(ref);
let diff = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) if (Math.abs(+a[i] - +b[i]) > 1e-6 * Math.max(1, Math.abs(+b[i]))) diff++;
console.log('  numbers', a.length, 'ref', b.length, 'mismatches', diff);
if (process.env.SAVE) fs.writeFileSync(process.env.SAVE, out);
