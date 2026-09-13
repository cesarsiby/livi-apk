import pg from 'pg';

// V36 — real PostgreSQL escrow <-> ledger reconciliation.
//
// This is a read-only audit against whatever data already exists in the
// target database (it does not create fixtures itself, unlike the V35
// concurrency script) — run it against a staging/test database that has
// been exercised by the test suite or by manual QA.
//
// It proves three invariants that the audit could only reason about
// statically by reading the source code:
//   1. Global double-entry invariant: sum(ledger_entries.amount) == 0
//      across the entire ledger (every posted transaction was balanced).
//   2. Per-escrow invariant: every escrow_transactions row whose status is
//      'funded', 'released', 'refunded' or 'disputed' has at least one
//      ledger_transactions row referencing its order_id with the expected
//      type, and no escrow has more than one 'escrow_refund' or more than
//      one 'escrow_release' transaction (defense-in-depth check mirroring
//      the V35 migration's unique indexes).
//   3. No orphaned money: every ledger_transactions row of type
//      'partner_payment' / 'dev_partner_payment' / 'escrow_release' /
//      'escrow_refund' / 'shipping_release' references an order_id that
//      still exists in `orders`.
//
// Like scripts/v35_stock_restitution_concurrency.js, this requires a real,
// disposable PostgreSQL instance and an installed `pg` package. It has NOT
// been executed in the sandbox used to build this change (no PostgreSQL
// server, no network access to install `pg`) — see
// docs/V36_ESCROW_LEDGER_WALLET_AUDIT.md for the explicit statement of
// that limitation.

const { Client } = pg;
if (process.env.NODE_ENV === 'production') throw new Error('Reconciliation audit is read-only but still refuses to run against NODE_ENV=production from this ad-hoc script; use the dedicated ops runbook instead.');

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};

const client = new Client(cfg);
const failures = [];

try {
  await client.connect();

  // 1. Global double-entry invariant.
  const globalSum = (await client.query(
    `SELECT coalesce(sum(amount),0)::bigint total FROM ledger_entries`
  )).rows[0].total;
  if (String(globalSum) !== '0') {
    failures.push(`GLOBAL_LEDGER_UNBALANCED: sum(ledger_entries.amount) = ${globalSum}, expected 0`);
  }

  // 2. Every ledger_transactions row is itself internally balanced
  //    (defense-in-depth re-check of what postBalanced() already enforces
  //    at write time — this re-verifies it against what actually landed
  //    in the table, independent of application code).
  const unbalancedTxns = (await client.query(`
    SELECT lt.id, lt.reference, lt.type, sum(le.amount)::bigint total
    FROM ledger_transactions lt
    JOIN ledger_entries le ON le.transaction_id = lt.id
    GROUP BY lt.id, lt.reference, lt.type
    HAVING sum(le.amount) <> 0
  `)).rows;
  for (const row of unbalancedTxns) {
    failures.push(`UNBALANCED_TRANSACTION: ${row.reference} (${row.type}) sums to ${row.total}`);
  }

  // 3. Escrow status must be backed by a matching ledger transaction.
  const escrows = (await client.query(`
    SELECT id, order_id, status FROM escrow_transactions
    WHERE status IN ('funded','released','refunded','disputed')
  `)).rows;

  for (const e of escrows) {
    if (['funded','released','disputed'].includes(e.status)) {
      const funded = (await client.query(
        `SELECT 1 FROM ledger_transactions
         WHERE type IN ('partner_payment','dev_partner_payment')
         AND metadata->>'order_id' = $1 LIMIT 1`,
        [e.order_id]
      )).rows[0];
      if (!funded) failures.push(`ESCROW_${e.status.toUpperCase()}_WITHOUT_FUNDING_TXN: escrow ${e.id} order ${e.order_id}`);
    }
    if (e.status === 'released') {
      const rel = (await client.query(
        `SELECT count(*)::int n FROM ledger_transactions
         WHERE type='escrow_release' AND metadata->>'order_id'=$1`,
        [e.order_id]
      )).rows[0];
      if (rel.n !== 1) failures.push(`ESCROW_RELEASE_COUNT_MISMATCH: escrow ${e.id} order ${e.order_id} has ${rel.n} escrow_release transactions (expected 1)`);
    }
    if (e.status === 'refunded') {
      const ref = (await client.query(
        `SELECT count(*)::int n FROM ledger_transactions
         WHERE type='escrow_refund' AND metadata->>'order_id'=$1`,
        [e.order_id]
      )).rows[0];
      if (ref.n !== 1) failures.push(`ESCROW_REFUND_COUNT_MISMATCH: escrow ${e.id} order ${e.order_id} has ${ref.n} escrow_refund transactions (expected 1)`);
    }
  }

  // 4. No orphaned order references in money-moving ledger transactions.
  const orphans = (await client.query(`
    SELECT lt.id, lt.reference, lt.type, lt.metadata->>'order_id' order_id
    FROM ledger_transactions lt
    WHERE lt.type IN ('partner_payment','dev_partner_payment','escrow_release','escrow_refund','shipping_release')
      AND lt.metadata->>'order_id' IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.id::text = lt.metadata->>'order_id')
  `)).rows;
  for (const row of orphans) {
    failures.push(`ORPHANED_LEDGER_REFERENCE: ${row.reference} (${row.type}) references missing order ${row.order_id}`);
  }

  if (failures.length) {
    console.error(JSON.stringify({ suite: 'V36-escrow-ledger-reconciliation', status: 'FAIL', failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      suite: 'V36-escrow-ledger-reconciliation',
      status: 'PASS',
      global_ledger_sum: String(globalSum),
      escrows_checked: escrows.length,
      transactions_checked_for_internal_balance: 'all (query-level aggregate)'
    }, null, 2));
  }
} catch (e) {
  console.error(e.stack || e);
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch {}
}
