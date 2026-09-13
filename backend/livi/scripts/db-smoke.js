import { pool, tx } from '../src/config/db.js';

const required = [
  'users','wallets','ledger_accounts','ledger_transactions','ledger_entries',
  'orders','order_items','escrow_transactions','shipments','shipment_events',
  'disputes','payout_requests','platform_fee_rules','withdrawal_fee_rules',
  'financial_operations','audit_logs','idempotency_keys'
];

try {
  const r = await pool.query(`
    SELECT tablename FROM pg_tables
    WHERE schemaname='public' AND tablename = ANY($1::text[])
    ORDER BY tablename
  `,[required]);
  const found = new Set(r.rows.map(x=>x.tablename));
  const missing = required.filter(x=>!found.has(x));
  if (missing.length) throw new Error(`Tables manquantes: ${missing.join(', ')}`);

  await tx(async c => {
    const accounts = await c.query(`SELECT code FROM ledger_accounts WHERE code IN
      ('partner_clearing_xof','livi_customer_liability_xof','livi_vendor_payable_xof',
       'livi_transporter_payable_xof','livi_shipping_payable_xof','livi_refund_payable_xof','livi_fee_revenue_xof')`);
    if (accounts.rowCount !== 7) throw new Error(`Comptes LIVI manquants: ${7-accounts.rowCount}`);
    const currencies = await c.query(`SELECT count(*)::int count FROM ledger_accounts WHERE currency='XOF'`);
    if (currencies.rows[0].count < 7) throw new Error('Comptes XOF insuffisants');
  });

  console.log(`DB smoke OK: ${required.length} tables contrôlées.`);
} finally {
  await pool.end();
}
