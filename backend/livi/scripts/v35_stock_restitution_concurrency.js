import pg from 'pg';
import crypto from 'node:crypto';

// V35 — real PostgreSQL concurrency test for idempotent stock restitution.
//
// SCENARIO (mission section 26, mandatory):
//   product.stock = 1
//   order.quantity = 1, order.status = 'preparing'
//   Two concurrent transactions both attempt to cancel the SAME order.
// REQUIRED RESULT:
//   - exactly one cancellation succeeds and restores stock;
//   - the other is rejected cleanly (order already cancelled/refunded);
//   - final stock == 1, never 2;
//   - orders.stock_restored_at is set exactly once (enforced by both the
//     application row lock AND the V35 database trigger).
//
// This script requires a real, disposable PostgreSQL instance. It refuses
// to run against a database that looks like production, and it must never
// be reported as "PASS" unless it actually connected to PostgreSQL and
// actually executed. This environment (the sandbox used to build this
// change) has no PostgreSQL server and no network access to start one, so
// this script has NOT been executed here — see docs/V35_STOCK_RESTITUTION.md
// for the explicit, honest statement of that limitation.
//
// V39 fix: this script originally re-implemented the cancellation guard
// locally (`attemptCancel()` below, now removed) instead of calling the
// real src/services/orderCancellation.js#cancelOrder(). That function
// takes a plain pg client and a params object — it has no dependency on
// Express — so there was never a technical reason not to call it directly.
// V38 found and fixed the same category of problem for
// scripts/end-to-end-financial-scenario.js (a hand-simulated "expected"
// state cannot catch a bug in the real code that computes it); this script
// had the identical flaw and is fixed the same way here.

const { Client } = pg;
if (process.env.NODE_ENV === 'production') throw new Error('Concurrency test cannot run in production');
if (process.env.ALLOW_LIVI_CONCURRENCY_TEST !== 'true') {
  throw new Error('Set ALLOW_LIVI_CONCURRENCY_TEST=true to run this destructive test');
}

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};
const id = () => crypto.randomUUID();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const c1 = new Client(cfg), c2 = new Client(cfg);

let vendorId, buyerId, addressId, productId, orderId, escrowId;

// Calls the REAL cancelOrder() from src/services/orderCancellation.js —
// no local re-implementation. `actorRole:'admin'` is used so the ownership
// check inside cancelOrder() (buyer_id/vendor_id match) doesn't need a
// second synthetic user; the concurrency behavior under test (row lock +
// stock_restored_at guard) is identical regardless of actor role.
async function attemptCancel(client, orderId, label, cancelOrder) {
  await client.query('BEGIN');
  try {
    const before = (await client.query(`SELECT stock_restored_at FROM orders WHERE id=$1`, [orderId])).rows[0];
    const result = await cancelOrder(client, { orderId, actorId: null, actorRole: 'admin', reason: `${label} concurrency test` });
    await client.query('COMMIT');
    return { label, outcome: 'accepted', stock_restored: !before?.stock_restored_at, result };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch {}
    return { label, outcome: 'rejected', reason: e.code || e.message };
  }
}

try {
  await c1.connect();
  await c2.connect();

  // Import the real function under test, once, for both connections.
  const { cancelOrder } = await import('../src/services/orderCancellation.js');

  vendorId = id(); buyerId = id(); addressId = id(); productId = id(); orderId = id(); escrowId = id();
  const vendorPhone = `+22370${vendorId.replaceAll('-', '').slice(0, 7)}`;
  const buyerPhone = `+22371${buyerId.replaceAll('-', '').slice(0, 7)}`;

  await c1.query('BEGIN');
  await c1.query(`INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES($1,$2,'V35 Vendor','vendor','active',true)`, [vendorId, vendorPhone]);
  await c1.query(`INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES($1,$2,'V35 Buyer','client','active',true)`, [buyerId, buyerPhone]);
  await c1.query(`INSERT INTO user_addresses(id,user_id,label,line1,city) VALUES($1,$2,'home','1 rue test','Abidjan')`, [addressId, buyerId]);
  await c1.query(`INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status) VALUES($1,$2,'V35 Product',$3,10000,1,'active')`, [productId, vendorId, `v35-product-${productId}`]);
  await c1.query(`INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id) VALUES($1,$2,$3,'preparing',10000,0,10000,'XOF',$4)`, [orderId, buyerId, vendorId, addressId]);
  await c1.query(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,10000,10000)`, [orderId, productId]);
  await c1.query(`INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at) VALUES($1,$2,$3,$4,10000,0,'funded',now())`, [escrowId, orderId, buyerId, vendorId]);
  await c1.query('COMMIT');

  // Fire both cancellations concurrently. c1 begins first and holds the
  // FOR UPDATE lock briefly; c2 is launched right after so it genuinely
  // contends for the same row rather than running sequentially.
  const [resultA, resultB] = await Promise.all([
    attemptCancel(c1, orderId, 'A', cancelOrder),
    (async () => { await sleep(10); return attemptCancel(c2, orderId, 'B', cancelOrder); })()
  ]);

  const finalStock = (await c1.query(`SELECT stock FROM products WHERE id=$1`, [productId])).rows[0].stock;
  const finalOrder = (await c1.query(`SELECT status, stock_restored_at FROM orders WHERE id=$1`, [orderId])).rows[0];

  const acceptedCount = [resultA, resultB].filter(r => r.outcome === 'accepted').length;

  const failures = [];
  if (acceptedCount !== 1) failures.push(`Expected exactly 1 accepted cancellation, got ${acceptedCount}`);
  if (Number(finalStock) !== 1) failures.push(`DOUBLE_RESTITUTION_DETECTED: expected stock=1, got stock=${finalStock}`);
  if (!finalOrder.stock_restored_at) failures.push('orders.stock_restored_at was not set');
  if (finalOrder.status !== 'refunded') failures.push(`Expected order status=refunded, got ${finalOrder.status}`);

  // Cleanup — ledger rows are immutable and intentionally NOT deleted;
  // only the disposable test entities created above are removed.
  await c1.query('BEGIN');
  await c1.query('DELETE FROM order_items WHERE order_id=$1', [orderId]);
  await c1.query('DELETE FROM escrow_transactions WHERE order_id=$1', [orderId]);
  await c1.query('DELETE FROM orders WHERE id=$1', [orderId]);
  await c1.query('DELETE FROM products WHERE id=$1', [productId]);
  await c1.query('DELETE FROM user_addresses WHERE id=$1', [addressId]);
  await c1.query('DELETE FROM users WHERE id IN ($1,$2)', [vendorId, buyerId]);
  await c1.query('COMMIT');

  if (failures.length) {
    throw new Error('V35_STOCK_RESTITUTION_CONCURRENCY_FAILED: ' + failures.join('; '));
  }

  console.log(JSON.stringify({
    suite: 'V35-stock-restitution-concurrency',
    status: 'PASS',
    real_function_under_test: 'src/services/orderCancellation.js#cancelOrder',
    result: { resultA, resultB, final_stock: finalStock, final_order_status: finalOrder.status }
  }, null, 2));
} catch (e) {
  try { await c1.query('ROLLBACK'); } catch {}
  try { await c2.query('ROLLBACK'); } catch {}
  console.error(e.stack || e);
  process.exitCode = 1;
} finally {
  try { await c1.end(); } catch {}
  try { await c2.end(); } catch {}
}
