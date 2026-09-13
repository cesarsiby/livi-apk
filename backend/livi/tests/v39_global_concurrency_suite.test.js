import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V39 (global concurrency suite). Real proof
// that all concurrency/invariant scripts pass together against live data
// requires scripts/v39_global_concurrency_suite.js against a real
// PostgreSQL instance — this suite verifies the orchestration wiring and
// the two honesty fixes (V35 script now calls real cancelOrder(); V31.1
// script now uses the shared wallet.js balance formula) are actually in
// place and haven't regressed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('scripts/run-postgres-suite.js now runs the V31 crash test and V31.1 withdrawal concurrency test (previously silently skipped)', () => {
  const src = read('scripts', 'v39_global_concurrency_suite.js');
  assert.match(src, /scripts\/v31-postgres-crash-test\.js/);
  assert.match(src, /scripts\/v31_1_real_withdrawal_concurrency\.js/);
  assert.match(src, /scripts\/v35_stock_restitution_concurrency\.js/);
  const runnerSrc = read('scripts', 'run-postgres-suite.js');
  assert.match(runnerSrc, /v39_global_concurrency_suite\.js/);
});

test('v35 concurrency script now imports and calls the real cancelOrder() instead of re-implementing it', () => {
  const src = read('scripts', 'v35_stock_restitution_concurrency.js');
  assert.match(src, /await import\('\.\.\/src\/services\/orderCancellation\.js'\)/);
  assert.match(src, /const result = await cancelOrder\(client, \{ orderId, actorId: null, actorRole: 'admin', reason: /);
  // The old local re-implementation must be gone.
  assert.doesNotMatch(src, /const escrow = \(await client\.query\(`SELECT \* FROM escrow_transactions WHERE order_id=\$1 FOR UPDATE`/);
});

test('v31.1 withdrawal concurrency script now uses the shared wallet.js#payableBalance() instead of duplicated inline SQL', () => {
  const src = read('scripts', 'v31_1_real_withdrawal_concurrency.js');
  assert.match(src, /from '\.\.\/src\/services\/wallet\.js'/);
  assert.match(src, /payableBalance\(c1, 'transporter', testUser\)/);
  assert.match(src, /payableBalance\(c2, 'transporter', testUser\)/);
  const inlineDuplicates = (src.match(/JOIN ledger_accounts a ON a\.id=le\.account_id/g) || []).length;
  assert.strictEqual(inlineDuplicates, 0, 'inline ledger balance query should be fully replaced by the shared helper');
});

test('scripts/v39_global_concurrency_suite.js refuses nothing silently — every step result (PASS or FAIL) is captured in the consolidated report', () => {
  const src = read('scripts', 'v39_global_concurrency_suite.js');
  assert.match(src, /anyFailed = true/);
  assert.match(src, /status: anyFailed \? 'FAIL' : 'PASS'/);
  assert.match(src, /if \(anyFailed\) process\.exitCode = 1;/);
});

test('npm run test:concurrency:global is registered and points at the V39 orchestrator', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:concurrency:global'], /v39_global_concurrency_suite\.js/);
});

console.log(JSON.stringify({
  test: 'V39_GLOBAL_CONCURRENCY_SUITE_STATIC',
  note: 'Static/unit audit only. Real proof that all concurrency scripts pass together requires scripts/v39_global_concurrency_suite.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
