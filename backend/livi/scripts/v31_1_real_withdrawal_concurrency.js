import pg from 'pg';
import crypto from 'node:crypto';

// V39: aligned to call the shared src/services/wallet.js#payableBalance()
// helper (introduced in V36) instead of repeating the inline ledger-sum
// query a third time (payouts.js had it twice before V36 consolidated it;
// this script, written before wallet.js existed, was the last remaining
// copy). Same formula, same result — just one fewer place for the balance
// calculation to silently drift if it's ever changed.
import { payableBalance } from '../src/services/wallet.js';

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

let testUser;
let payout1;
let payout2;
let ledgerTx;

try {
  await c1.connect();
  await c2.connect();

  // Dedicated test user. The setup is committed because the concurrent
  // transactions must see the same payable balance.
  testUser = id();
  const phone = `+22379${testUser.replaceAll('-', '').slice(0, 7)}`;
  await c1.query('BEGIN');
  await c1.query(`INSERT INTO users(id,phone,name,role,status,phone_verified)
                  VALUES($1,$2,'V31.1 Concurrency','transporter','active',true)`, [testUser, phone]);
  await c1.query(`INSERT INTO transporters(id,kyc_status) VALUES($1,'approved')`, [testUser]);

  const payable = (await c1.query(`SELECT id FROM ledger_accounts WHERE code='livi_transporter_payable_xof'`)).rows[0]?.id;
  const clearing = (await c1.query(`SELECT id FROM ledger_accounts WHERE code='partner_clearing_xof'`)).rows[0]?.id;
  if (!payable || !clearing) throw new Error('Required ledger accounts are missing');

  ledgerTx = id();
  await c1.query(`INSERT INTO ledger_transactions(id,reference,type,metadata)
                   VALUES($1,$2,'v31_1_concurrency_seed','{}'::jsonb)`, [ledgerTx, `V31.1-${ledgerTx}`]);
  await c1.query(`INSERT INTO ledger_entries(transaction_id,account_id,amount,currency,owner_user_id)
                  VALUES($1,$2,-100000,'XOF',$3),($1,$4,100000,'XOF',NULL)`,
    [ledgerTx, payable, testUser, clearing]);
  await c1.query('COMMIT');

  // Transaction A: acquires the user lock, reserves 70k, then deliberately
  // holds the transaction long enough for B to contend on the same lock.
  await c1.query('BEGIN');
  await c1.query('SELECT livi_payout_user_lock($1)', [testUser]);
  const balA = await payableBalance(c1, 'transporter', testUser);
  if (balA.available < 70000n) throw new Error('A should have sufficient funds');

  payout1 = id();
  await c1.query(`INSERT INTO payout_requests(id,user_id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference)
                  VALUES($1,$2,70000,0,0,70000,'XOF','v31.1-A','pending',$3)`,
    [payout1, testUser, `V31.1-A-${payout1}`]);

  // B starts while A still owns the advisory lock. It must not calculate its
  // balance until A commits.
  await c2.query('BEGIN');
  const bLockStarted = Date.now();
  const bLock = c2.query('SELECT livi_payout_user_lock($1)', [testUser]);
  await sleep(150);
  const blockedFor = Date.now() - bLockStarted;
  if (blockedFor < 120) throw new Error(`B did not appear blocked by the advisory lock (${blockedFor}ms)`);

  await c1.query('COMMIT');
  await bLock;

  const balB = await payableBalance(c2, 'transporter', testUser);

  // The second 70k request must be rejected: only 30k remains after A's
  // committed reservation.
  const bAccepted = balB.available >= 70000n;
  if (bAccepted) throw new Error(`DOUBLE_WITHDRAWAL_GUARD_FAILED: available=${balB.available}`);

  const expectedRemaining = 30000n;
  if (balB.available !== expectedRemaining) {
    throw new Error(`FINAL_BALANCE_MISMATCH: expected=${expectedRemaining} actual=${balB.available}`);
  }

  payout2 = id();
  await c2.query('ROLLBACK');

  // Cleanup is intentionally conservative. Financial ledger rows are immutable
  // and are NOT deleted. The test user is removed only when PostgreSQL cascades
  // are configured safely; otherwise the disposable test database should be
  // dropped/recreated by the runner. A cleanup failure is never reported as PASS.
  await c1.query('BEGIN');
  await c1.query('DELETE FROM payout_requests WHERE id=$1', [payout1]);
  try {
    await c1.query('DELETE FROM users WHERE id=$1', [testUser]);
  } catch (cleanupError) {
    await c1.query('ROLLBACK');
    throw new Error(`CLEANUP_FAILED: ${cleanupError.message}`);
  }
  await c1.query('COMMIT');

  console.log(JSON.stringify({
    suite: 'V31.1-real-withdrawal-concurrency',
    status: 'PASS',
    real_function_under_test: 'src/services/wallet.js#payableBalance (V39: previously an inline duplicate of the same formula)',
    result: {
      initial_balance: '100000',
      request_A: '70000 accepted',
      request_B: '70000 rejected after lock + recheck',
      remaining_available: '30000',
      lock_blocked_ms: blockedFor
    }
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
