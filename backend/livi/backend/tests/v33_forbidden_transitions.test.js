import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

// V35 fix: same two bugs as v32_state_transition_audit.test.js — this file
// used require()/__dirname (illegal under "type":"module", so the script
// never ran) and resolved `root` to backend/ instead of the project root,
// so it scanned only its own docs/tests instead of src/ and migrations/.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..', '..');

const SCAN_DIRS = ['src', 'migrations'];
const SKIP_DIRS = new Set(['node_modules', '.git']);

function scan(dir) {
  let files = [];
  for (const n of fs.readdirSync(dir)) {
    if (SKIP_DIRS.has(n)) continue;
    const p = path.join(dir, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) files = files.concat(scan(p));
    else if (/\.(js|sql)$/.test(n)) files.push(p);
  }
  return files;
}

const files = SCAN_DIRS.flatMap(d => scan(path.join(root, d)));
const text = files.map(p => fs.readFileSync(p, 'utf8')).join('\n');

const forbidden = [
  ['pending_payment', 'delivered'],
  ['payment_pending', 'completed'],
  ['paid', 'completed'],
  ['delivered', 'preparing'],
  ['completed', 'refunded']
];

assert(/delivery[-_ ]?proof/i.test(text), 'delivery proof mechanism missing');
assert(/escrow/i.test(text), 'escrow mechanism missing');
assert(/picked_up/i.test(text), 'pickup state/mechanism missing');

for (const [from, to] of forbidden) {
  // Conservative audit: flag any source line that appears to encode a
  // direct transition string between two states that must never be
  // directly connected (e.g. a transitions map literal or a hardcoded
  // status update pair).
  const direct = new RegExp(from + '\\s*(?:=>|->|to)\\s*' + to, 'i');
  assert(!direct.test(text), `Forbidden direct transition found: ${from} -> ${to}`);
}

console.log(JSON.stringify({
  test: 'V33_FORBIDDEN_TRANSITIONS_STATIC',
  files_scanned: files.length,
  scan_dirs: SCAN_DIRS,
  forbidden_paths_checked: forbidden.length,
  result: 'PASS_STATIC_AUDIT'
}, null, 2));
