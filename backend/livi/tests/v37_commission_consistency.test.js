import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit verification for V37 (payout vendeur + transporteur +
// commission audit). Real proof that per-owner ledger attribution is
// correct against live data requires
// scripts/v37_payout_commission_reconciliation.js against a real
// PostgreSQL instance — this suite verifies the source-level fixes are
// present, consistent, and haven't regressed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('escrow_transactions has no transporter_id column (regression guard on the schema assumption that caused the bug)', () => {
  const sql = read('migrations', '001_initial.sql');
  const escrowTableLine = sql.split('\n').find(l => l.includes('CREATE TABLE escrow_transactions'));
  assert.ok(escrowTableLine, 'escrow_transactions table definition not found');
  assert.doesNotMatch(escrowTableLine, /transporter_id/, 'escrow_transactions must not gain a transporter_id column as a workaround — the fix is to look it up from shipments');
});

test('releaseEscrow() looks up the real transporter from shipments instead of a non-existent e.transporter_id', () => {
  const src = read('src', 'services', 'finance.js');
  // The fix is documented in a comment that legitimately mentions the old
  // (buggy) field name for context — what must be absent is actual usage
  // of it as a property access, i.e. `e.transporter_id` outside of `//` or
  // `*` comment lines.
  const liveCodeLines = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l));
  const liveCode = liveCodeLines.join('\n');
  assert.doesNotMatch(liveCode, /e\.transporter_id/, 'must not reference the non-existent escrow_transactions.transporter_id field in live code');
  assert.match(src, /SELECT transporter_id FROM shipments WHERE order_id=\$1/);
  assert.match(src, /owner_user_id:transporterId/);
});

test('releaseEscrowWithActiveCommission() exists and is the single place that fetches the active commission rule and persists it', () => {
  const src = read('src', 'services', 'finance.js');
  assert.match(src, /export async function releaseEscrowWithActiveCommission/);
  assert.match(src, /UPDATE escrow_transactions SET status='released'/);
});

test('every remaining call site uses the shared release function (no duplicated inline commission-rule fetch)', () => {
  // SESSION 26 — RÉCONCILIATION DE BRANCHES : ce test attendait à l'origine
  // 4 sites (3 dans delivery.js, 1 dans disputes.js), documentés dans le
  // commentaire au-dessus de releaseEscrowWithActiveCommission()
  // (services/finance.js). Depuis, 2 des 3 routes de delivery.js
  // (/:id/confirm-reception et /:id/release-escrow) ont été fusionnées en
  // une seule route dans compatibility.js (confirmation acheteur avec
  // preuve QR/PIN optionnelle, qui libère l'escrow dans la foulée) —
  // vérifié directement : delivery.js n'expose plus que 3 routes au total
  // (`/proof/resolve`, `/:id/pickup-proof/verify`,
  // `/:id/delivery-proof/verify`), aucune trace d'une route
  // confirm-reception ou release-escrow séparée nulle part dans le
  // backend. Il reste donc 3 sites réels, pas 4 — une réduction de
  // duplication supplémentaire, dans l'esprit même de ce que ce test
  // vérifie, pas une régression. Portée élargie à compatibility.js en
  // conséquence.
  const deliverySrc = read('src', 'routes', 'delivery.js');
  const disputesSrc = read('src', 'routes', 'disputes.js');
  const compatSrc = read('src', 'routes', 'compatibility.js');
  const combined = deliverySrc + disputesSrc + compatSrc;
  const inlineDuplicates = (combined.match(/SELECT commission_bps FROM platform_fee_rules WHERE active=true/g) || []).length;
  assert.strictEqual(inlineDuplicates, 0, 'inline commission-rule fetch should be fully replaced by releaseEscrowWithActiveCommission()');
  const sharedCallCount = (combined.match(/releaseEscrowWithActiveCommission\(c,e,/g) || []).length;
  assert.strictEqual(sharedCallCount, 3, `expected 3 call sites (delivery-proof verify in delivery.js, buyer confirm-reception in compatibility.js, dispute resolve in disputes.js) to use the shared function, found ${sharedCallCount}`);
});

test('no route anywhere reads an order/shipment status directly from the request body (the class of bug a bare status PATCH would be)', () => {
  const routesDir = path.join(root, 'src', 'routes');
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  for (const f of files) {
    const src = fs.readFileSync(path.join(routesDir, f), 'utf8');
    assert.doesNotMatch(src, /\bbody\??\.status\b/, `${f}: found a route reading body.status — verify it cannot reach order/shipment 'delivered'/'completed' before assuming this is safe`);
  }
});

test('disputes.js /:id/resolve selects the real escrow row (order_id-scoped) instead of spreading the dispute row into it', () => {
  const src = read('src', 'routes', 'disputes.js');
  const liveCodeLines = src.split('\n').filter(l => !/^\s*\/\//.test(l.trim()));
  const liveCode = liveCodeLines.join('\n');
  assert.doesNotMatch(liveCode, /\{\.\.\.d,\s*status:/, 'must not spread the dispute row as if it were the escrow row');
  assert.match(src, /SELECT \* FROM escrow_transactions WHERE order_id=\$1 FOR UPDATE',\[d\.order_id\]/);
});

test('disputes.js refund path updates escrow_transactions by the real escrow id, not the dispute id', () => {
  const src = read('src', 'routes', 'disputes.js');
  assert.match(src, /UPDATE escrow_transactions SET status='refunded',refunded_at=now\(\),updated_at=now\(\) WHERE id=\$1",\[e\.id\]/);
});

test('V37 migration adds DB-level consistency guards for payout split and escrow release split', () => {
  const sql = read('migrations', '030_v37_commission_consistency_guards.sql');
  assert.match(sql, /payout_requests_amount_split_chk/);
  assert.match(sql, /CHECK \(amount = fee_amount \+ net_amount\)/);
  assert.match(sql, /escrow_release_split_chk/);
  assert.match(sql, /commission_amount \+ vendor_net_amount = amount/);
});

test('withdrawal commission remains fully parameterized in the database (no hardcoded bps/rate) — regression check', () => {
  const src = read('src', 'routes', 'payouts.js');
  assert.match(src, /SELECT commission_bps,min_fee_xof,max_fee_xof FROM withdrawal_fee_rules WHERE role=\$1 AND active=true/);
  assert.doesNotMatch(src, /commission_bps\s*[:=]\s*[1-9]\d*/, 'no hardcoded non-zero commission_bps literal in payouts.js');
});

console.log(JSON.stringify({
  test: 'V37_PAYOUT_COMMISSION_AUDIT_STATIC',
  note: 'Static/unit audit only. Real proof of correct per-owner ledger attribution against live data requires scripts/v37_payout_commission_reconciliation.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
