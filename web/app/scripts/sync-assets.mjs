// Copies the original PHREEQC databases, examples and USGS notice from the repository
// into public/ so the web app serves them unchanged. Writes public/manifest.json.
import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve(import.meta.dirname, '..');
const root = path.resolve(app, '../..');
const pub = path.join(app, 'public');

function walk(dir, rel = '') {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(dir, r));
    else out.push(r);
  }
  return out;
}
function copy(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

// Databases: every .dat file under database/, including subfolders.
const dbDir = path.join(root, 'database');
const databases = walk(dbDir).filter(f => f.endsWith('.dat')).sort((a, b) => {
  const da = a.includes('/'), db = b.includes('/');
  return da === db ? a.localeCompare(b, 'en', { sensitivity: 'base' }) : da ? 1 : -1;
});
fs.rmSync(path.join(pub, 'databases'), { recursive: true, force: true });
for (const f of databases) copy(path.join(dbDir, f), path.join(pub, 'databases', f));

// Examples: input files plus the data files they read (tsv, dat, sed, ...).
const exDir = path.join(root, 'examples');
const skip = /^(CMakeLists\.txt|Makefile.*)$|\.(out|sel)$/;
const exampleFiles = fs.readdirSync(exDir).filter(f => fs.statSync(path.join(exDir, f)).isFile() && !skip.test(f));
fs.rmSync(path.join(pub, 'examples'), { recursive: true, force: true });
for (const f of exampleFiles) copy(path.join(exDir, f), path.join(pub, 'examples', f));
const examples = exampleFiles.filter(f => /^ex\d+[a-z]*$/.test(f)).sort((a, b) => {
  const na = parseInt(a.slice(2)), nb = parseInt(b.slice(2));
  return na - nb || a.localeCompare(b);
}).map(f => {
  const text = fs.readFileSync(path.join(exDir, f), 'utf8');
  const title = (text.match(/^\s*TITLE\s+(.*)$/im) || [, ''])[1].trim();
  // The database each example was run with, taken from the reference output header.
  let db = 'phreeqc.dat';
  const ref = path.join(exDir, f + '.out');
  if (fs.existsSync(ref)) {
    const m = fs.readFileSync(ref, 'utf8').match(/^Database file:\s*(\S+)/m);
    if (m) db = m[1].includes('/examples/') ? '@examples/' + path.basename(m[1]) : path.basename(m[1]);
  }
  return { id: f, title, database: db };
});

copy(path.join(root, 'doc', 'NOTICE.TXT'), path.join(pub, 'NOTICE.TXT'));
const version = (fs.readFileSync(path.join(root, 'phreeqc_version.h'), 'utf8').match(/PHREEQC_VER_STRING\s+"([^"]+)"/) || [, '3'])[1];

fs.writeFileSync(path.join(pub, 'manifest.json'), JSON.stringify({ version, databases, examples, exampleFiles }, null, 1));
console.log(`synced ${databases.length} databases, ${examples.length} examples (${exampleFiles.length} files), engine source PHREEQC ${version}`);
