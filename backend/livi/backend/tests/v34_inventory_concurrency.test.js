import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

// V35 fix: same two bugs as the other backend/tests/*.test.js audits —
// require()/__dirname under "type":"module" (never ran), and `root`
// resolving to backend/ instead of the project root (scanned the wrong
// files). Fixed to ESM and to scan the real src/ and migrations/ trees.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

const SCAN_DIRS = ['src', 'migrations'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

function scan(dir) {
  let out = [];
  for (const n of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(n)) continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(scan(p));
    else if (/\.(js|sql)$/.test(n)) out.push(p);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(d => scan(path.join(root, d)));
const text = files.map(p => fs.readFileSync(p, 'utf8')).join('\n').toLowerCase();

// Note (V35): the original required-concepts list included the literal
// word "inventory", which does not appear anywhere in the real codebase —
// LIVI's domain vocabulary is "stock", not "inventory". That word only
// matched because the earlier (broken) version of this script scanned its
// own docs, which do say "inventory". Now that it scans the real source,
// the check is corrected to the vocabulary actually used in the code.
const required = ['stock', 'quantity', 'order', 'transaction'];
for (const x of required) assert(text.includes(x), `Missing inventory/concurrency concept: ${x}`);

// Require an atomic/concurrency primitive somewhere in the backend SQL/application.
// This is a conservative source audit; real PostgreSQL execution remains required
// (see scripts/v35_stock_restitution_concurrency.js and V31.x scripts).
const hasConcurrency =
  /for\s+update/i.test(text) ||
  /for\s+update\s+skip\s+locked/i.test(text) ||
  /serializable/i.test(text) ||
  /advisory_lock/i.test(text) ||
  /atomic/i.test(text) ||
  /check\s*\(\s*[^)]*quantity[^)]*>=\s*0/i.test(text) ||
  /check\s*\(\s*stock\s*>=\s*0\s*\)/i.test(text);

assert(hasConcurrency, 'No inventory concurrency guard detected');

console.log(JSON.stringify({
  test: 'V34_INVENTORY_CONCURRENCY_STATIC',
  files_scanned: files.length,
  scan_dirs: SCAN_DIRS,
  required_concepts: required.length,
  result: 'PASS_STATIC_AUDIT'
}, null, 2));
