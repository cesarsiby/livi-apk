import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

// V35 fix: this file used `require`/`__dirname` in a package declared as
// "type": "module" in package.json. Node refuses CommonJS syntax in an .js
// file under an ESM package, so this audit never actually executed —
// `npm run audit:state-transitions` failed immediately. Fixed here to use
// import/fileURLToPath instead of require/__dirname.
//
// V35 fix #2: `root` previously resolved to backend/ (this file's own
// parent directory, containing only backend/docs and backend/tests), so the
// audit scanned its own documentation/test files instead of the real
// backend source in src/ and migrations/. Fixed to resolve to project root.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..'); // project root (was: backend/)

const SCAN_DIRS = ['src', 'migrations'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

function readAll(dir) {
  let out = [];
  for (const name of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out = out.concat(readAll(p));
    else if (/\.(js|sql)$/.test(name)) out.push(p);
  }
  return out;
}

const files = SCAN_DIRS.flatMap(d => readAll(path.join(root, d)));
const text = files.map(p => fs.readFileSync(p, 'utf8')).join('\n');

const requiredStates = [
  'pending_payment','payment_pending','paid','preparing',
  'shipping','delivered','completed','cancelled','refunded','disputed'
];

for (const state of requiredStates) {
  assert(text.includes(state), `Missing order state reference: ${state}`);
}

const requiredGuards = [
  'delivery-proof',
  'picked_up',
  'escrow',
  'release',
  'refund'
];

for (const guard of requiredGuards) {
  assert(text.toLowerCase().includes(guard.toLowerCase()),
    `Missing transition guard/reference: ${guard}`);
}

assert(
  /delivery[-_ ]?proof/i.test(text),
  'Delivery proof transition path not found'
);

console.log(JSON.stringify({
  test: 'V32_STATE_TRANSITION_AUDIT',
  files_scanned: files.length,
  scan_dirs: SCAN_DIRS,
  states_verified: requiredStates.length,
  guards_verified: requiredGuards.length,
  result: 'PASS_STATIC_AUDIT'
}, null, 2));
