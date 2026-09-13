import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V38 (real end-to-end financial scenario).
// This cannot prove the scenario actually passes against live data — only
// running scripts/v38_end_to_end_financial_scenario.js against a real
// PostgreSQL instance can do that (see docs/V38_END_TO_END_FINANCIAL_TEST.md
// for why that hasn't been done in this environment). What this suite
// verifies is that the new script genuinely calls the real application
// code instead of repeating the previous script's mistake of hand-writing
// its own expected ledger state.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('v38 scenario imports the real release/refund/balance/fee functions instead of hand-simulating them', () => {
  const src = read('scripts', 'v38_end_to_end_financial_scenario.js');
  assert.match(src, /await import\('\.\.\/src\/services\/finance\.js'\)/);
  assert.match(src, /releaseEscrowWithActiveCommission, refundEscrow/);
  assert.match(src, /await import\('\.\.\/src\/services\/wallet\.js'\)/);
  assert.match(src, /payableBalance, ledgerOwedToUser/);
  assert.match(src, /await import\('\.\.\/src\/services\/withdrawal\.js'\)/);
  assert.match(src, /calculateWithdrawalFee/);
});

test('v38 scenario actually calls releaseEscrowWithActiveCommission() and refundEscrow(), not local ledger() helper, for the money-moving steps', () => {
  const src = read('scripts', 'v38_end_to_end_financial_scenario.js');
  assert.match(src, /await releaseEscrowWithActiveCommission\(client, e, /);
  assert.match(src, /await refundEscrow\(client, escrowForDispute, /);
});

test('v38 scenario asserts real transporter attribution — the exact check the old script could not perform', () => {
  const src = read('scripts', 'v38_end_to_end_financial_scenario.js');
  assert.match(src, /transporter payable \(owed\) after release — THIS is the V37 regression check/);
  assert.match(src, /assertEq\('transporter payable \(owed\) after release[^']*', transporterBal\.owed, 2000n\)/);
});

test('v38 scenario exercises the dispute-resolution refund path through the real refundEscrow(), covering the other V37 fix', () => {
  const src = read('scripts', 'v38_end_to_end_financial_scenario.js');
  assert.match(src, /Resolve as refund, exactly the way the fixed disputes\.js route does/);
  assert.match(src, /dispute refund actually completed \(would 404 under the V37 bug\)/);
});

test('the legacy hand-simulated scenario is explicitly marked deprecated and explains why', () => {
  const src = read('scripts', 'end-to-end-financial-scenario.js');
  assert.match(src, /DEPRECATED as of V38/);
  assert.match(src, /owner_user_id=NULL/);
});

test('npm run test:scenario now points at the real (v38) script, not the deprecated one', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts['test:scenario'], /v38_end_to_end_financial_scenario\.js/);
  assert.ok(pkg.scripts['test:scenario:legacy'], 'legacy script should remain runnable on request, just not as the default');
});

test('scripts/run-postgres-suite.js runs the v38 scenario, not the deprecated legacy one', () => {
  const src = read('scripts', 'run-postgres-suite.js');
  assert.match(src, /v38_end_to_end_financial_scenario\.js/);
  assert.doesNotMatch(src, /'scripts\/end-to-end-financial-scenario\.js'/);
});

console.log(JSON.stringify({
  test: 'V38_END_TO_END_FINANCIAL_TEST_STATIC',
  note: 'Static/unit audit only. Real proof that the scenario passes requires scripts/v38_end_to_end_financial_scenario.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
