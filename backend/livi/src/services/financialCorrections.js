import { HttpError } from '../utils/http.js';
import { accountId, postBalanced, ACCOUNT, newReference } from './market.js';

const ALLOWED = new Set(['missing_in_livi','missing_at_partner','amount_mismatch','duplicate','unknown_reference','state_mismatch','manual_adjustment']);

function amountOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  try { const n = BigInt(String(v)); if (n < 0n) throw new Error(); return n; }
  catch { throw new HttpError(422, 'Montant de correction invalide', 'CORRECTION_AMOUNT_INVALID'); }
}

export async function openCorrection(c, { reconciliationItemId=null, provider=null, orderId=null, paymentReference=null, caseType, proposedAmount=null, reason, evidence={}, createdBy }) {
  if (!ALLOWED.has(caseType)) throw new HttpError(422, 'Type de correction invalide', 'CORRECTION_TYPE_INVALID');
  if (!reason || String(reason).trim().length < 10) throw new HttpError(422, 'Motif de correction trop court', 'CORRECTION_REASON_REQUIRED');
  const amount = amountOrNull(proposedAmount);
  if (reconciliationItemId) {
    const item = (await c.query('SELECT * FROM partner_reconciliation_items WHERE id=$1 FOR UPDATE',[reconciliationItemId])).rows[0];
    if (!item) throw new HttpError(404, 'Anomalie de réconciliation introuvable', 'RECON_ITEM_NOT_FOUND');
    provider = provider || item.provider; orderId = orderId || item.order_id; paymentReference = paymentReference || item.payment_reference;
    caseType = item.discrepancy_type;
  }
  const q = await c.query(`INSERT INTO financial_correction_cases(reconciliation_item_id,provider,order_id,payment_reference,case_type,status,proposed_amount,reason,evidence,created_by)
    VALUES($1,$2,$3,$4,$5,'open',$6,$7,$8,$9) RETURNING *`, [reconciliationItemId,provider,orderId,paymentReference,caseType,amount?.toString() ?? null,reason,evidence,createdBy]);
  await c.query(`INSERT INTO financial_correction_actions(case_id,action_type,actor_user_id,reason) VALUES($1,'open',$2,$3)`,[q.rows[0].id,createdBy,reason]);
  return q.rows[0];
}

export async function approveCorrection(c, { caseId, actorId, reason }) {
  const row=(await c.query('SELECT * FROM financial_correction_cases WHERE id=$1 FOR UPDATE',[caseId])).rows[0];
  if(!row) throw new HttpError(404,'Dossier de correction introuvable','CORRECTION_NOT_FOUND');
  if(row.status!=='open' && row.status!=='investigating') throw new HttpError(409,'Dossier non approuvable','CORRECTION_STATE_INVALID');
  if(row.created_by===actorId) throw new HttpError(403,'Le créateur ne peut pas approuver sa propre correction','CORRECTION_SEPARATION_OF_DUTIES');
  await c.query(`UPDATE financial_correction_cases SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1`,[caseId,actorId]);
  await c.query(`INSERT INTO financial_correction_actions(case_id,action_type,actor_user_id,reason) VALUES($1,'approve',$2,$3)`,[caseId,actorId,reason||'approved']);
  return (await c.query('SELECT * FROM financial_correction_cases WHERE id=$1',[caseId])).rows[0];
}

export async function rejectCorrection(c,{caseId,actorId,reason}) {
  const row=(await c.query('SELECT * FROM financial_correction_cases WHERE id=$1 FOR UPDATE',[caseId])).rows[0];
  if(!row) throw new HttpError(404,'Dossier de correction introuvable','CORRECTION_NOT_FOUND');
  if(!['open','investigating','approved'].includes(row.status)) throw new HttpError(409,'Dossier non rejetable','CORRECTION_STATE_INVALID');
  await c.query(`UPDATE financial_correction_cases SET status='rejected' WHERE id=$1`,[caseId]);
  await c.query(`INSERT INTO financial_correction_actions(case_id,action_type,actor_user_id,reason) VALUES($1,'reject',$2,$3)`,[caseId,actorId,reason||'rejected']);
  return (await c.query('SELECT * FROM financial_correction_cases WHERE id=$1',[caseId])).rows[0];
}

/**
 * Execute only a safe compensation: partner clearing <-> customer liability.
 * The service intentionally does not "fix" an arbitrary account balance.
 * Production integrations should add provider-specific recovery/payout adapters.
 */
export async function executeCustomerCompensation(c,{caseId,actorId}) {
  const row=(await c.query('SELECT * FROM financial_correction_cases WHERE id=$1 FOR UPDATE',[caseId])).rows[0];
  if(!row) throw new HttpError(404,'Dossier de correction introuvable','CORRECTION_NOT_FOUND');
  if(row.status!=='approved') throw new HttpError(409,'Correction non approuvée','CORRECTION_NOT_APPROVED');
  if(!row.order_id) throw new HttpError(409,'Commande requise pour cette compensation','CORRECTION_ORDER_REQUIRED');
  if(row.case_type!=='missing_in_livi') throw new HttpError(409,'Ce type de correction ne peut pas être exécuté par ce mécanisme','CORRECTION_EXECUTION_UNSUPPORTED');
  const order=(await c.query(`SELECT id,buyer_id,total_amount,currency,status FROM orders WHERE id=$1 FOR UPDATE`,[row.order_id])).rows[0];
  if(!order) throw new HttpError(404,'Commande introuvable','ORDER_NOT_FOUND');
  if(order.currency!=='XOF') throw new HttpError(409,'Devise non supportée','CORRECTION_CURRENCY');
  const amount=amountOrNull(row.proposed_amount);
  if(amount===null || amount<=0n) throw new HttpError(409,'Montant de compensation manquant','CORRECTION_AMOUNT_REQUIRED');
  const clearing=await accountId(c,ACCOUNT.clearing), customer=await accountId(c,ACCOUNT.customer);
  const txId=await postBalanced(c,{reference:newReference('COR'),type:'partner_reconciliation_compensation',metadata:{case_id:row.id,order_id:row.order_id,provider:row.provider,payment_reference:row.payment_reference},entries:[{account_id:clearing,amount:-amount},{account_id:customer,amount,owner_user_id:order.buyer_id}]});
  await c.query(`UPDATE financial_correction_cases SET status='executed',executed_by=$2,executed_at=now() WHERE id=$1`,[caseId,actorId]);
  await c.query(`INSERT INTO financial_correction_actions(case_id,action_type,actor_user_id,reason,ledger_transaction_id) VALUES($1,'execute',$2,$3,$4)`,[caseId,actorId,'executed approved customer compensation',txId]);
  return (await c.query('SELECT * FROM financial_correction_cases WHERE id=$1',[caseId])).rows[0];
}
