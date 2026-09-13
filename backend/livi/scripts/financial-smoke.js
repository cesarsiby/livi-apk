import pg from 'pg';
import crypto from 'node:crypto';

const { Client } = pg;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required for the PostgreSQL financial smoke test.');
  process.exit(2);
}

const c = new Client({ connectionString: url });
const id = () => crypto.randomUUID();

try {
  await c.connect();
  await c.query('BEGIN');

  const accounts = {};
  for (const code of [
    'partner_clearing_xof',
    'livi_customer_liability_xof',
    'livi_vendor_payable_xof',
    'livi_transporter_payable_xof',
    'livi_shipping_payable_xof',
    'livi_fee_revenue_xof'
  ]) {
    const r = await c.query('SELECT id FROM ledger_accounts WHERE code=$1 AND currency=\'XOF\'', [code]);
    if (!r.rows[0]) throw new Error(`Missing ledger account: ${code}`);
    accounts[code] = r.rows[0].id;
  }

  const reference = `SMOKE-${id()}`;
  const entries = [
    [accounts.partner_clearing_xof, 102000n],
    [accounts.livi_customer_liability_xof, -100000n],
    [accounts.livi_shipping_payable_xof, -2000n]
  ];
  const txr = await c.query(
    'INSERT INTO ledger_transactions(reference,type,metadata) VALUES($1,$2,$3) RETURNING id',
    [reference, 'smoke_partner_payment', { amount: '102000' }]
  );
  for (const [accountId, amount] of entries) {
    await c.query(
      'INSERT INTO ledger_entries(transaction_id,account_id,amount,currency) VALUES($1,$2,$3,\'XOF\')',
      [txr.rows[0].id, accountId, amount.toString()]
    );
  }

  const check = await c.query(
    'SELECT COALESCE(SUM(amount),0)::bigint AS net, COUNT(*)::int AS count FROM ledger_entries WHERE transaction_id=$1',
    [txr.rows[0].id]
  );
  if (BigInt(check.rows[0].net) !== 0n || check.rows[0].count !== 3) {
    throw new Error(`Unexpected ledger result: ${JSON.stringify(check.rows[0])}`);
  }

  await c.query('ROLLBACK');
  console.log('PostgreSQL financial smoke test: PASS');
} catch (err) {
  try { await c.query('ROLLBACK'); } catch {}
  console.error(`PostgreSQL financial smoke test: FAIL — ${err.message}`);
  process.exitCode = 1;
} finally {
  await c.end();
}
