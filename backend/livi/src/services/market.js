import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { HttpError } from '../utils/http.js';

const ACCOUNT = {
  clearing: 'partner_clearing_xof',
  customer: 'livi_customer_liability_xof',
  vendor: 'livi_vendor_payable_xof',
  transporter: 'livi_transporter_payable_xof',
  shipping: 'livi_shipping_payable_xof',
  refund: 'livi_refund_payable_xof',
  fee: 'livi_fee_revenue_xof'
};

export async function accountId(c, code) {
  const r = await c.query('SELECT id FROM ledger_accounts WHERE code=$1 AND currency=\'XOF\'', [code]);
  if (!r.rows[0]) throw new HttpError(500, `Compte comptable manquant: ${code}`, 'LEDGER_ACCOUNT_MISSING');
  return r.rows[0].id;
}

export async function postBalanced(c, { reference, type, entries, metadata = {} }) {
  const sum = entries.reduce((n, e) => n + BigInt(e.amount), 0n);
  if (sum !== 0n) throw new HttpError(500, 'Transaction comptable déséquilibrée', 'LEDGER_UNBALANCED');
  const txr = await c.query('INSERT INTO ledger_transactions(reference,type,metadata) VALUES($1,$2,$3) RETURNING id', [reference,type,metadata]);
  for (const e of entries) await c.query('INSERT INTO ledger_entries(transaction_id,account_id,amount,currency,owner_user_id) VALUES($1,$2,$3,\'XOF\',$4)', [txr.rows[0].id,e.account_id,String(e.amount),e.owner_user_id||null]);
  return txr.rows[0].id;
}

export async function ensureWallet(c, userId) {
  return (await c.query('INSERT INTO wallets(user_id,currency) VALUES($1,\'XOF\') ON CONFLICT(user_id) DO UPDATE SET updated_at=now() RETURNING *',[userId])).rows[0];
}

export function newReference(prefix) { return `${prefix}-${crypto.randomUUID()}`; }

export { ACCOUNT };
