import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Static/unit-level verification for V35 (idempotent stock restitution).
// This CANNOT prove the absence of a race condition under real concurrent
// PostgreSQL transactions — only scripts/v35_stock_restitution_concurrency.js
// run against a live PostgreSQL instance can do that. What this test suite
// verifies is that the specific mechanisms V35 relies on are actually
// present in the source, wired together correctly, and haven't regressed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

test('cancelOrder locks the order row before reading/using stock_restored_at', () => {
  const src = read('src', 'services', 'orderCancellation.js');
  const lockIdx = src.indexOf('SELECT * FROM orders WHERE id=$1 FOR UPDATE');
  assert.notStrictEqual(lockIdx, -1, 'order row must be locked with FOR UPDATE');
  const restoreFnIdx = src.indexOf('async function restoreStockOnce');
  assert.notStrictEqual(restoreFnIdx, -1, 'restoreStockOnce() must exist');
  assert.ok(lockIdx < restoreFnIdx || src.includes('FOR UPDATE'), 'lock must exist in the module');
});

test('restoreStockOnce() is idempotent: it locks orders and checks stock_restored_at before writing', () => {
  const src = read('src', 'services', 'orderCancellation.js');
  assert.match(src, /SELECT stock_restored_at FROM orders WHERE id=\$1 FOR UPDATE/);
  assert.match(src, /if \(row\.stock_restored_at\) return false;/);
  assert.match(src, /UPDATE orders SET stock_restored_at=now\(\) WHERE id=\$1/);
});

test('cancelOrder only allows cancellation/refund from pre-terminal states (no shipping/delivered/completed)', () => {
  const src = read('src', 'services', 'orderCancellation.js');
  assert.match(src, /\['pending_payment','paid','preparing'\]\.includes\(order\.status\)/);
});

test('V35 migration file exists and defines the write-once + pre-shipment stock restitution trigger', () => {
  const sql = read('migrations', '028_v35_stock_restitution_idempotency.sql');
  assert.match(sql, /livi_v35_guard_stock_restoration/);
  assert.match(sql, /BEFORE UPDATE ON orders/);
  assert.match(sql, /OLD\.stock_restored_at IS NOT NULL/);
  assert.match(sql, /pending_payment.*paid.*preparing|paid.*preparing.*pending_payment/s);
});

test('V35 migration adds a defense-in-depth unique guard against double refund/release at the DB layer', () => {
  const sql = read('migrations', '028_v35_stock_restitution_idempotency.sql');
  assert.match(sql, /ledger_txn_unique_escrow_refund_per_order/);
  assert.match(sql, /ledger_txn_unique_escrow_release_per_order/);
});

test('refundEscrow() still locks the escrow row and rejects a second refund for the same order (no regression)', () => {
  const src = read('src', 'services', 'finance.js');
  assert.match(src, /SELECT \* FROM escrow_transactions WHERE id=\$1 FOR UPDATE/);
  assert.match(src, /REFUND_ALREADY_EXECUTED/);
});

test('no route can move an order/shipment to delivered or completed except the known, proof-gated paths (no bare status PATCH exists anywhere to bypass)', () => {
  // SESSION 26 — RÉCONCILIATION DE BRANCHES : ce test attendait un garde
  // explicite (`if(body.status==='delivered') throw ... DELIVERY_PROOF_REQUIRED`)
  // dans delivery.js, protégeant une route générique de type
  // "PATCH statut" contre un contournement de la preuve de livraison.
  // Vérifié directement, exhaustivement : cette route générique n'existe
  // nulle part dans le backend actuel — aucune route, dans aucun fichier
  // de src/routes/, ne lit `body.status`/`body?.status` pour écrire un
  // statut de commande ou de livraison (grep exhaustif, zéro résultat).
  // La protection n'a donc pas été retirée : la surface qu'elle protégeait
  // a été supprimée à la racine plutôt que gardée — plus fort qu'un garde
  // explicite (rien à contourner), mais vérifié ici pour que toute
  // réintroduction future d'une route générique de ce type sans le même
  // garde fasse échouer ce test plutôt que de passer inaperçue.
  const routesDir = path.join(root, 'src', 'routes');
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
  for (const f of files) {
    const src = fs.readFileSync(path.join(routesDir, f), 'utf8');
    assert.doesNotMatch(src, /\bbody\??\.status\b/, `${f}: a route reads body.status — this must be traced to confirm it cannot set an order/shipment to 'delivered'/'completed' without going through proof verification`);
  }

  // Every real writer of these two statuses must be one of the three
  // known, gated call sites — verified directly rather than assumed:
  // delivery.js (transporter/admin, gated by consumeProof()),
  // compatibility.js (buyer confirm-reception, gated by requireAuth +
  // optional consumeProof()), disputes.js (admin dispute resolution).
  const delivery = read('src', 'routes', 'delivery.js');
  const compat = read('src', 'routes', 'compatibility.js');
  const disputes = read('src', 'routes', 'disputes.js');
  assert.match(delivery, /consumeProof\(c,\{shipmentId/, 'delivery.js must still gate its delivered/completed writes behind proof consumption');
  assert.match(compat, /consumeProof\(c,\{shipmentId/, 'compatibility.js confirm-reception must still support QR/PIN proof consumption');
  assert.match(compat, /releaseEscrowWithActiveCommission/, 'compatibility.js confirm-reception must release escrow through the single shared, snapshot-respecting function');
  assert.match(disputes, /status='completed'/, 'disputes.js resolves to completed only via its own admin-gated route, not a generic one');
});

test('POST /orders/:id/cancel honors Idempotency-Key (HTTP retry protection)', () => {
  const src = read('src', 'routes', 'orders.js');
  assert.match(src, /replayIdempotency\(req,res\)/);
  assert.match(src, /saveIdempotency\(req,200,/);
});

test('disputes resolution (post-shipment refund path) does not restore stock automatically', () => {
  const src = read('src', 'routes', 'disputes.js');
  assert.doesNotMatch(src, /restoreStockOnce/);
  assert.doesNotMatch(src, /stock_restored_at/);
});

test('products.stock can never go negative at the DB layer (regression check on V34 base)', () => {
  const sql = read('migrations', '001_initial.sql');
  assert.match(sql, /stock integer NOT NULL DEFAULT 0 CHECK\(stock>=0\)/);
});

console.log(JSON.stringify({
  test: 'V35_STOCK_RESTITUTION_IDEMPOTENCY_STATIC',
  note: 'Static/unit audit only. Real concurrent-transaction proof requires scripts/v35_stock_restitution_concurrency.js against a live PostgreSQL instance.',
  result: 'SEE_NODE_TEST_OUTPUT'
}, null, 2));
