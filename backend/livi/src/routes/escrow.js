import { Router } from 'express'; import { pool,tx } from '../config/db.js'; import { asyncHandler,ok,HttpError } from '../utils/http.js'; import { requireAuth } from '../middleware/auth.js'; import crypto from 'node:crypto';
import { accountId, postBalanced, ACCOUNT, newReference } from '../services/market.js';
import { payableBalance, buyerEscrowPosition } from '../services/wallet.js';
import { allowStagingTestHelpers } from '../config/env.js';
import { ensurePartner } from '../services/partnerInstructions.js';
import { assertEscrowTransition } from '../services/escrowLifecycle.js';
const r=Router(); r.use(requireAuth);
// V36: previously read `wallets.available_amount`/`locked_amount`, columns
// that are created at 0 on signup and never updated anywhere in the
// codebase (confirmed by full-repo audit) — this endpoint always returned
// zero regardless of real activity. It now computes the real position from
// the double-entry ledger, the same source of truth already used correctly
// by src/routes/payouts.js for withdrawal eligibility.
r.get('/balance',asyncHandler(async(req,res)=>{
  const result=await tx(async c=>{
    if(req.user.role==='vendor'||req.user.role==='transporter'){
      const bal=await payableBalance(c,req.user.role,req.user.sub);
      return {
        currency:'XOF',
        available_amount:bal.available.toString(),
        locked_amount:bal.reserved.toString(),
        owed_total:bal.owed.toString()
      };
    }
    const pos=await buyerEscrowPosition(c,req.user.sub);
    return {
      currency:'XOF',
      available_amount:'0',
      locked_amount:(pos.in_escrow_principal+pos.in_escrow_shipping).toString(),
      active_order_count:pos.active_order_count
    };
  });
  ok(res,result);
}));
r.get('/transactions',asyncHandler(async(req,res)=>{const {rows}=await pool.query('SELECT e.id,e.order_id,e.amount,e.shipping_fee,e.status,e.created_at FROM escrow_transactions e WHERE e.buyer_id=$1 OR e.vendor_id=$1 ORDER BY e.created_at DESC LIMIT 100',[req.user.sub]);ok(res,rows);}));
// V47: walletApi.ts's getTransaction(id) had no matching route — the only
// backend endpoint was the list above, which silently ignored any filter
// and returned the whole 100-row page instead of one record. Added as a
// dedicated :id route (matching the /orders/:id, /payouts/:id convention
// used everywhere else) rather than a query-param filter on the list route.
r.get('/transactions/:id',asyncHandler(async(req,res)=>{const {rows}=await pool.query('SELECT e.id,e.order_id,e.amount,e.shipping_fee,e.status,e.created_at FROM escrow_transactions e WHERE e.id=$1 AND (e.buyer_id=$2 OR e.vendor_id=$2)',[req.params.id,req.user.sub]);if(!rows[0])throw new HttpError(404,'Transaction introuvable');ok(res,rows[0]);}));
// V47: checkoutApi.ts's verifyPayment(reference) polls this path after
// /payment/init, but no route existed for it at all (404) — the checkout
// screen had no way to detect that a payment had cleared.
r.get('/payment/:reference/status',asyncHandler(async(req,res)=>{const {rows}=await pool.query('SELECT status,amount,shipping_fee,order_id FROM escrow_transactions WHERE payment_reference=$1 AND (buyer_id=$2 OR vendor_id=$2)',[req.params.reference,req.user.sub]);if(!rows[0])throw new HttpError(404,'Paiement introuvable');ok(res,{reference:req.params.reference,status:rows[0].status,amount:rows[0].amount,shipping_fee:rows[0].shipping_fee,order_id:rows[0].order_id});}));
r.post('/payment/init',asyncHandler(async(req,res)=>{
  const orderId=req.body?.order_id;
  const result = await tx(async c => {
    // V-AUDIT (race condition — section 24): SELECT...FOR UPDATE must be
    // in the SAME transaction as the UPDATE it protects. This used to run
    // as a standalone pool.query() call, which auto-commits and releases
    // the row lock immediately — by the time a later, separate tx() ran
    // the actual UPDATE, nothing was holding the row anymore. Two
    // concurrent requests for the same order could both pass the
    // 'awaiting_payment' check and each generate their own payment
    // reference, the second overwriting the first's. Now: one
    // transaction, lock held from SELECT through UPDATE.
    const { rows } = await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 AND buyer_id=$2 FOR UPDATE', [orderId, req.user.sub]);
    if (!rows[0]) throw new HttpError(404,'Escrow introuvable');
    const e = rows[0];

    // V-AUDIT (idempotence — section 25): a retry (timeout, double-tap)
    // after a payment reference was already generated must return that
    // same reference, not a fresh 409 — the first call's work already
    // happened and is still valid while awaiting the provider.
    if (e.status === 'payment_pending' && e.payment_reference) {
      return { reference: e.payment_reference, amount: e.amount, shipping_fee: e.shipping_fee, status: 'payment_pending', partner_instruction_status: 'pending' };
    }
    assertEscrowTransition(e.status, 'payment_pending');

    const ref = `LIVI-${crypto.randomUUID()}`;
    await c.query('UPDATE escrow_transactions SET payment_reference=$1,status=\'payment_pending\',updated_at=now() WHERE id=$2', [ref, e.id]);
    await ensurePartner(c,{operationKey:`HOLD:${e.order_id}`,idempotencyKey:`${e.order_id}:HOLD`,type:'HOLD',amount:BigInt(e.amount)+BigInt(e.shipping_fee),orderId:e.order_id,payload:{payment_reference:ref,buyer_id:req.user.sub}});
    return { reference: ref, amount: e.amount, shipping_fee: e.shipping_fee, status: 'payment_pending', partner_instruction_status: 'pending' };
  });
  ok(res, result);
}));
r.post('/payment/confirm',asyncHandler(async(req,res)=>{if(!allowStagingTestHelpers)throw new HttpError(403,'La confirmation financière doit provenir du webhook partenaire','PARTNER_WEBHOOK_ONLY');const {reference}=req.body;const result=await tx(async c=>{const e=(await c.query('SELECT * FROM escrow_transactions WHERE payment_reference=$1 FOR UPDATE',[reference])).rows[0];if(!e)throw new HttpError(404,'Paiement introuvable');assertEscrowTransition(e.status,'funded');const clearing=await accountId(c,ACCOUNT.clearing),customer=await accountId(c,ACCOUNT.customer),shipping=await accountId(c,ACCOUNT.shipping);await postBalanced(c,{reference:newReference('DEV-PAY'),type:'dev_partner_payment',entries:[{account_id:clearing,amount:BigInt(e.amount)+BigInt(e.shipping_fee)},{account_id:customer,amount:-BigInt(e.amount)},{account_id:shipping,amount:-BigInt(e.shipping_fee)}],metadata:{order_id:e.order_id}});await c.query("UPDATE escrow_transactions SET status='funded',funded_at=now(),updated_at=now() WHERE id=$1",[e.id]);await c.query("UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1",[e.order_id]);return {reference,status:'funded',mode:'development'};});ok(res,result);}));
export default r;
