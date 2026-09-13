import pg from 'pg';

// V37 — real PostgreSQL payout/commission reconciliation.
//
// V36's reconciliation only proves the ledger is GLOBALLY balanced
// (sum of all entries == 0). That check alone would NOT have caught the
// V37 bug where transporter/vendor ledger credits were posted with
// owner_user_id=NULL — the global sum was still zero, but the money was
// unattributed to anyone. This script specifically checks PER-OWNER
// attribution: every ledger entry on a payable account (vendor,
// transporter) must have a non-null owner_user_id, and gross/fee/net and
// amount/commission/net splits must be internally consistent (defense-in-
// depth re-check of the V37 migration's CHECK constraints against what
// actually landed in the tables).
//
// Requires a real, disposable PostgreSQL instance with `pg` installed. Has
// NOT been executed in the sandbox used to build this change — see
// docs/V37_PAYOUT_COMMISSION_AUDIT.md.

const { Client } = pg;
if (process.env.NODE_ENV === 'production') throw new Error('Reconciliation audit refuses to run against NODE_ENV=production from this ad-hoc script; use the dedicated ops runbook instead.');

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};

const client = new Client(cfg);
const failures = [];

try {
  await client.connect();

  // 1. No orphaned (unattributed) credits on payable accounts. This is the
  //    exact class of bug this version fixed: a shipping_release or
  //    escrow_release entry landing on the vendor/transporter payable
  //    account with owner_user_id NULL means that money is credited to
  //    the platform's books but withdrawable by no one.
  const orphanedPayableEntries = (await client.query(`
    SELECT le.id, le.transaction_id, a.code, lt.type, lt.reference
    FROM ledger_entries le
    JOIN ledger_accounts a ON a.id = le.account_id
    JOIN ledger_transactions lt ON lt.id = le.transaction_id
    WHERE a.code IN ('livi_vendor_payable_xof','livi_transporter_payable_xof')
      AND le.amount < 0  -- a credit to the payable account (liability increases toward the user)
      AND le.owner_user_id IS NULL
  `)).rows;
  for (const row of orphanedPayableEntries) {
    failures.push(`ORPHANED_PAYABLE_CREDIT: ledger_entry ${row.id} (${row.type} / ${row.reference}, account ${row.code}) has no owner_user_id`);
  }

  // 2. Every payout_requests row: amount == fee_amount + net_amount
  //    (re-verifies the V37 CHECK constraint against real data).
  const badPayouts = (await client.query(`
    SELECT id, reference, amount, fee_amount, net_amount
    FROM payout_requests
    WHERE amount <> fee_amount + net_amount
  `)).rows;
  for (const row of badPayouts) {
    failures.push(`PAYOUT_SPLIT_MISMATCH: ${row.reference} amount=${row.amount} fee=${row.fee_amount} net=${row.net_amount}`);
  }

  // 3. Every released escrow: commission_amount + vendor_net_amount == amount.
  const badEscrows = (await client.query(`
    SELECT id, order_id, amount, commission_amount, vendor_net_amount
    FROM escrow_transactions
    WHERE status = 'released' AND commission_amount + vendor_net_amount <> amount
  `)).rows;
  for (const row of badEscrows) {
    failures.push(`ESCROW_RELEASE_SPLIT_MISMATCH: escrow ${row.id} order ${row.order_id} amount=${row.amount} commission=${row.commission_amount} vendor_net=${row.vendor_net_amount}`);
  }

  // 4. Every escrow with shipping_fee > 0 whose order has an assigned
  //    transporter (shipments.transporter_id) must, once released, have
  //    posted its shipping_release credit to that specific transporter —
  //    not to nobody, and not to a different transporter than the one who
  //    actually delivered the order.
  const shippingMismatches = (await client.query(`
    SELECT e.id AS escrow_id, e.order_id, s.transporter_id AS expected_transporter,
           le.owner_user_id AS credited_transporter
    FROM escrow_transactions e
    JOIN shipments s ON s.order_id = e.order_id
    JOIN ledger_transactions lt ON lt.type = 'shipping_release' AND lt.metadata->>'order_id' = e.order_id::text
    JOIN ledger_accounts a ON a.code = 'livi_transporter_payable_xof'
    JOIN ledger_entries le ON le.transaction_id = lt.id AND le.account_id = a.id
    WHERE e.status = 'released' AND e.shipping_fee > 0 AND s.transporter_id IS NOT NULL
      AND (le.owner_user_id IS NULL OR le.owner_user_id <> s.transporter_id)
  `)).rows;
  for (const row of shippingMismatches) {
    failures.push(`SHIPPING_CREDIT_ATTRIBUTION_MISMATCH: escrow ${row.escrow_id} order ${row.order_id} expected transporter ${row.expected_transporter}, credited ${row.credited_transporter}`);
  }

  if (failures.length) {
    console.error(JSON.stringify({ suite: 'V37-payout-commission-reconciliation', status: 'FAIL', failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({
      suite: 'V37-payout-commission-reconciliation',
      status: 'PASS',
      payouts_checked: (await client.query('SELECT count(*)::int n FROM payout_requests')).rows[0].n,
      released_escrows_checked: (await client.query("SELECT count(*)::int n FROM escrow_transactions WHERE status='released'")).rows[0].n
    }, null, 2));
  }
} catch (e) {
  console.error(e.stack || e);
  process.exitCode = 1;
} finally {
  try { await client.end(); } catch {}
}
