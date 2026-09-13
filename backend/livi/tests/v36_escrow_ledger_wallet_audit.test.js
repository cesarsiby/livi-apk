import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V36 (escrow <-> ledger <-> wallet audit).
// Real proof that the ledger stays balanced under real data requires
// scripts/v36_escrow_ledger_reconciliation.js against a live PostgreSQL
// instance — this suite only verifies the source-level fix is present,
// consistent, and hasn't regressed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('GET /escrow/balance no longer reads the dead wallets.available_amount/locked_amount columns', () => {
  const src = read('src', 'routes', 'escrow.js');
  assert.doesNotMatch(
    src,
    /SELECT currency,available_amount,locked_amount FROM wallets/,
    'escrow.js must not read balance from the wallets table anymore'
  );
});

test('GET /escrow/balance computes balance from the ledger via the shared wallet service', () => {
  const src = read('src', 'routes', 'escrow.js');
  assert.match(src, /from\s+'\.\.\/services\/wallet\.js'/);
  assert.match(src, /payableBalance\(c,req\.user\.role,req\.user\.sub\)/);
});

test('src/services/wallet.js exists and exposes the single balance formula', () => {
  const src = read('src', 'services', 'wallet.js');
  assert.match(src, /export async function ledgerOwedToUser/);
  assert.match(src, /export async function reservedPayoutAmount/);
  assert.match(src, /export async function payableBalance/);
  assert.match(src, /export async function buyerEscrowPosition/);
});

test('payouts.js uses the shared wallet service instead of its own inline ledger query (no formula duplication)', () => {
  const src = read('src', 'routes', 'payouts.js');
  assert.match(src, /from\s+'\.\.\/services\/wallet\.js'/);
  assert.match(src, /payableBalance\(c,req\.user\.role,req\.user\.sub\)/);
  assert.match(src, /ledgerOwedToUser\(c,acct,p\.user_id\)/);
  // The old duplicated inline SQL must be gone from both call sites.
  const inlineDuplicateCount = (src.match(/JOIN ledger_accounts a ON a\.id=le\.account_id/g) || []).length;
  assert.strictEqual(inlineDuplicateCount, 0, 'inline ledger balance query should be fully replaced by the shared helper');
});

test('V36 migration exists and pins the legacy wallet balance columns to zero', () => {
  const sql = read('migrations', '029_v36_wallet_legacy_guard.sql');
  assert.match(sql, /livi_v36_pin_legacy_wallet_balance/);
  assert.match(sql, /NEW\.available_amount := 0;/);
  assert.match(sql, /NEW\.locked_amount := 0;/);
  assert.match(sql, /BEFORE INSERT OR UPDATE ON wallets/);
});

test('postBalanced() still enforces zero-sum at write time (regression check, V34/V35 base)', () => {
  const src = read('src', 'services', 'market.js');
  assert.match(src, /if \(sum !== 0n\) throw new HttpError\(500, 'Transaction comptable déséquilibrée', 'LEDGER_UNBALANCED'\);/);
});

test('refundEscrow() and releaseEscrow() still exist and are unmodified in their locking behavior (no V36 regression)', () => {
  const src = read('src', 'services', 'finance.js');
  assert.match(src, /SELECT \* FROM escrow_transactions WHERE id=\$1 FOR UPDATE/);
  assert.match(src, /export async function releaseEscrow/);
  assert.match(src, /export async function refundEscrow/);
});

test('webhooks.js partner_payment path is still balanced (clearing +amount = customer + shipping debits)', () => {
  const src = read('src', 'routes', 'webhooks.js');
  assert.match(src, /account_id:clearing,amount:amount/);
  assert.match(src, /account_id:customer,amount:-BigInt\(e\.amount\)/);
  assert.match(src, /account_id:shipping,amount:-BigInt\(e\.shipping_fee\)/);
});

console.log(JSON.stringify({
  test: 'V36_ESCROW_LEDGER_WALLET_AUDIT_STATIC',
  note: 'Static/unit audit only. Real proof of a globally-balanced ledger and orphan-free escrow/order references requires scripts/v36_escrow_ledger_reconciliation.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
