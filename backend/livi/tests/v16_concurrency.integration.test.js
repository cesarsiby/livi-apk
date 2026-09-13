import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};
const uid = () => crypto.randomUUID();

async function setup(c, userId) {
  await c.query('INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES($1,$2,$3,\'transporter\',\'active\',true)', [userId, `+223${userId.replaceAll('-','').slice(0,8)}`, 'V16 Transporter']);
  const acct = (await c.query("SELECT id FROM ledger_accounts WHERE code='livi_transporter_payable_xof'")).rows[0].id;
  const tx = (await c.query("INSERT INTO ledger_transactions(reference,type,metadata) VALUES($1,'v16_setup',$2) RETURNING id", [`V16-SETUP-${uid()}`, {scenario:'v16'}])).rows[0].id;
  const clearing = (await c.query("SELECT id FROM ledger_accounts WHERE code='partner_clearing_xof'")).rows[0].id;
  await c.query("INSERT INTO ledger_entries(transaction_id,account_id,amount,currency,owner_user_id) VALUES($1,$2,$3,'XOF',$4),($1,$5,$6,'XOF',NULL)", [tx, acct, -100000, userId, clearing, 100000]);
}

test('V16 PostgreSQL: deux retraits concurrents ne peuvent pas consommer deux fois le même payable', {skip: !process.env.RUN_POSTGRES_CONCURRENCY}, async () => {
  const { default: pg } = await import('pg');
  const { Client } = pg;
  const a = new Client(cfg), b = new Client(cfg), seed = new Client(cfg);
  const userId = uid();
  await seed.connect();
  await seed.query('BEGIN');
  await setup(seed, userId);
  await seed.query('COMMIT');
  await seed.end();

  await Promise.all([a.connect(), b.connect()]);
  const attempt = async (c, reference, delayMs=0) => {
    await c.query('BEGIN');
    await c.query('SELECT livi_payout_user_lock($1)', [userId]);
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    const bal = BigInt((await c.query("SELECT coalesce(sum(le.amount),0)::bigint amount FROM ledger_entries le JOIN ledger_accounts a ON a.id=le.account_id WHERE a.code='livi_transporter_payable_xof' AND le.owner_user_id=$1", [userId])).rows[0].amount);
    const reserved = BigInt((await c.query("SELECT coalesce(sum(amount),0)::bigint amount FROM payout_requests WHERE user_id=$1 AND status IN ('pending','processing')", [userId])).rows[0].amount);
    if (-bal-reserved < 70000n) { await c.query('ROLLBACK'); return 'rejected'; }
    await c.query("INSERT INTO payout_requests(user_id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference) VALUES($1,70000,0,0,70000,'XOF','V16','pending',$2)", [userId, reference]);
    await c.query('COMMIT'); return 'accepted';
  };
  const [r1,r2] = await Promise.all([attempt(a, `V16-A-${uid()}`, 50), attempt(b, `V16-B-${uid()}`, 0)]);
  assert.equal([r1,r2].filter(x => x==='accepted').length, 1);
  assert.equal([r1,r2].filter(x => x==='rejected').length, 1);
  const check = await a.query("SELECT count(*)::int count, coalesce(sum(amount),0)::bigint total FROM payout_requests WHERE user_id=$1 AND status='pending'", [userId]);
  assert.equal(check.rows[0].count, 1);
  assert.equal(BigInt(check.rows[0].total), 70000n);
  await a.end(); await b.end();
});
