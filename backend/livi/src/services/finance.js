import { accountId, postBalanced, ACCOUNT, newReference } from './market.js';
import { HttpError } from '../utils/http.js';
import { ensurePartner } from './partnerInstructions.js';

export function commissionAmount(amount, bps=0) {
  const a = BigInt(amount); const b = BigInt(bps);
  if (a < 0n || b < 0n) throw new HttpError(400,'Montant ou commission invalide');
  return (a * b) / 10000n;
}

export async function releaseEscrow(c, e, { commissionBps=0, metadata={} }={}) {
  if (!['funded','disputed'].includes(e.status)) throw new HttpError(409,'Escrow non libérable','ESCROW_NOT_FUNDED');
  const customer=await accountId(c,ACCOUNT.customer), vendor=await accountId(c,ACCOUNT.vendor), shipping=await accountId(c,ACCOUNT.shipping), transporter=await accountId(c,ACCOUNT.transporter), fee=await accountId(c,ACCOUNT.fee);
  // V-AUDIT (correction financière critique): vendorNet is read directly
  // from the snapshot computed at order creation (routes/orders.js,
  // calculateVendorNet() in orderPricing.js) whenever it exists, instead
  // of being re-derived here from e.amount and whatever commissionBps the
  // caller passed in. Re-deriving from e.amount was the actual bug for
  // passthrough orders: e.amount can already include the buyer-side
  // markup, and applying the commission rate to that marked-up total a
  // second time shortchanged the vendor (see migrations/
  // 040_v55_commission_snapshot.sql for the exact numbers). `commission`
  // is now the *residual* (amount - vendorNet) rather than an
  // independently computed value, which is what guarantees the two always
  // add back up to e.amount by construction — this is also exactly what
  // migration 030's `commission_amount + vendor_net_amount = amount`
  // CHECK constraint requires.
  // Fallback (e.vendor_net_amount_snapshot IS NULL): an order created
  // before this snapshot existed — reproduces the exact pre-fix
  // computation, so an order already in flight when this deployed is
  // unaffected rather than being retroactively recalculated mid-flight.
  const vendorNet = e.vendor_net_amount_snapshot != null
    ? BigInt(e.vendor_net_amount_snapshot)
    : BigInt(e.amount) - commissionAmount(e.amount, commissionBps);
  const commission = BigInt(e.amount) - vendorNet;
  if(vendorNet<0n) throw new HttpError(500,'Commission supérieure au montant vendeur');
  await ensurePartner(c,{operationKey:`RELEASE:${e.order_id}`,idempotencyKey:`${e.order_id}:RELEASE`,type:'RELEASE',amount:BigInt(e.amount)+BigInt(e.shipping_fee),orderId:e.order_id,payload:{commission_bps:String(commissionBps),vendor_net:String(vendorNet),metadata}});
  await postBalanced(c,{reference:newReference('REL'),type:'escrow_release',metadata:{order_id:e.order_id,...metadata},entries:[{account_id:customer,amount:e.amount,owner_user_id:e.buyer_id},{account_id:vendor,amount:-vendorNet,owner_user_id:e.vendor_id},{account_id:fee,amount:-commission}]});
  if(BigInt(e.shipping_fee)>0n) {
    // V37 fix: `escrow_transactions` has no `transporter_id` column (see
    // migrations/001_initial.sql) and no call site ever joined one in —
    // `e.transporter_id` was always `undefined`, so every shipping-fee
    // ledger entry crediting the transporter was posted with
    // `owner_user_id=null`. Since payout eligibility
    // (src/services/wallet.js#ledgerOwedToUser) filters strictly on
    // `owner_user_id`, this meant a transporter's shipping fee was
    // credited to the ledger (so the global ledger stayed balanced,
    // hiding the bug from a purely global reconciliation check) but was
    // permanently unattributed to anyone — no transporter could ever
    // withdraw it. The real transporter for an order lives on
    // `shipments.transporter_id` (order_id is UNIQUE there), so it is
    // looked up here, once, for every caller of releaseEscrow().
    const assigned = (await c.query(
      `SELECT transporter_id FROM shipments WHERE order_id=$1`, [e.order_id]
    )).rows[0];
    const transporterId = assigned?.transporter_id || null;
    await postBalanced(c,{reference:newReference('SHIP'),type:'shipping_release',metadata:{order_id:e.order_id,...metadata},entries:[{account_id:shipping,amount:e.shipping_fee},{account_id:transporter,amount:-BigInt(e.shipping_fee),owner_user_id:transporterId}]});
  }
  await c.query(`INSERT INTO settlements(partner_instruction_id,order_id,beneficiary_user_id,beneficiary_type,amount,currency,status) SELECT pi.id,$1,$2,'vendor',$3,'XOF','pending' FROM partner_instructions pi WHERE pi.operation_key=$4`,[e.order_id,e.vendor_id,vendorNet.toString(),`RELEASE:${e.order_id}`]);
  if(BigInt(e.shipping_fee)>0n){ const assigned=(await c.query('SELECT transporter_id FROM shipments WHERE order_id=$1',[e.order_id])).rows[0]; if(assigned?.transporter_id) await c.query(`INSERT INTO settlements(partner_instruction_id,order_id,beneficiary_user_id,beneficiary_type,amount,currency,status) SELECT pi.id,e.order_id,$1,'transporter',$2,'XOF','pending' FROM partner_instructions pi WHERE pi.operation_key=$3`,[assigned.transporter_id,BigInt(e.shipping_fee),`RELEASE:${e.order_id}`]); }
  return {commission, vendorNet};
}

// V37 — single entry point for "release this escrow at whatever commission
// rate is currently active, and persist the resulting commission fields".
//
// AUDIT FINDING that motivated this function: the sequence
//   1. SELECT commission_bps FROM platform_fee_rules WHERE active=true ...
//   2. releaseEscrow(c, e, { commissionBps })
//   3. UPDATE escrow_transactions SET status='released', commission_bps=...,
//      commission_amount=..., vendor_net_amount=... WHERE id=$1
// was independently duplicated at FOUR call sites: src/routes/delivery.js
// (/:id/delivery-proof/verify, /:id/confirm-reception, /:id/release-escrow)
// and src/routes/disputes.js (/:id/resolve, release branch). Four copies
// of the same financial logic is exactly the kind of drift risk V36 found
// (and fixed) for payout balance computation — a future fix to commission
// handling applied to one call site could silently miss the other three.
// This function is now the single place that logic lives; all four routes
// call it instead of repeating it.
export async function releaseEscrowWithActiveCommission(c, e, { metadata={} }={}) {
  // V-AUDIT: prefer the rate snapshotted at order creation (e.commission_bps,
  // set by routes/orders.js — see migrations/040_v55_commission_snapshot.sql)
  // over platform_fee_rules' *currently* active rate, which may have
  // changed since this order was placed (section 22 of the audit: a
  // commission rate must be locked in at creation, not re-fetched at
  // release). Only a legacy order with no vendor_net_amount_snapshot at
  // all falls back to the pre-fix behavior of fetching whatever is active
  // right now — releaseEscrow() applies that same fallback condition to
  // the actual vendorNet computation, so this stays consistent with it.
  let bps;
  if (e.vendor_net_amount_snapshot != null) {
    bps = Number(e.commission_bps || 0);
  } else {
    const rule = (await c.query(
      `SELECT commission_bps FROM platform_fee_rules WHERE active=true AND effective_from<=now() ORDER BY effective_from DESC LIMIT 1`
    )).rows[0];
    bps = Number(rule?.commission_bps || 0);
  }
  const released = await releaseEscrow(c, e, { commissionBps: bps, metadata });
  await c.query(
    `UPDATE escrow_transactions SET status='released',released_at=now(),commission_bps=$2,commission_amount=$3,vendor_net_amount=$4,updated_at=now() WHERE id=$1`,
    [e.id, bps, String(released.commission), String(released.vendorNet)]
  );
  return { ...released, commissionBps: bps };
}

export async function refundEscrow(c,e,{metadata={}}={}) {
  if(!['funded','disputed'].includes(e.status)) throw new HttpError(409,'Escrow non remboursable','ESCROW_NOT_REFUNDABLE');

  // Lock the escrow row and make the operation idempotent at the financial layer.
  const locked = (await c.query(
    `SELECT * FROM escrow_transactions WHERE id=$1 FOR UPDATE`, [e.id]
  )).rows[0];
  if(!locked) throw new HttpError(404,'Escrow introuvable','ESCROW_NOT_FOUND');
  if(!['funded','disputed'].includes(locked.status))
    throw new HttpError(409,'Escrow déjà traité','ESCROW_ALREADY_SETTLED');

  const duplicate = await c.query(
    `SELECT id FROM ledger_transactions
     WHERE type='escrow_refund' AND metadata->>'order_id'=$1
     LIMIT 1`, [locked.order_id]
  );
  if(duplicate.rows[0]) throw new HttpError(409,'Remboursement déjà exécuté','REFUND_ALREADY_EXECUTED');

  const order = (await c.query(
    `SELECT id,buyer_id,vendor_id,subtotal_amount,shipping_fee,total_amount,status,currency
     FROM orders WHERE id=$1 FOR UPDATE`, [locked.order_id]
  )).rows[0];
  if(!order) throw new HttpError(404,'Commande introuvable','ORDER_NOT_FOUND');
  if(order.currency !== 'XOF') throw new HttpError(409,'Devise de remboursement non supportée','REFUND_CURRENCY');
  if(order.buyer_id !== locked.buyer_id || order.vendor_id !== locked.vendor_id)
    throw new HttpError(409,'Attribution escrow/commande incohérente','REFUND_IDENTITY_MISMATCH');

  const principal=BigInt(locked.amount), shippingFee=BigInt(locked.shipping_fee);
  const orderTotal=BigInt(order.total_amount);
  if(principal<=0n || shippingFee<0n || principal+shippingFee!==orderTotal)
    throw new HttpError(409,'Montant escrow incohérent avec la commande','REFUND_AMOUNT_MISMATCH');

  await ensurePartner(c,{operationKey:`REFUND:${locked.order_id}`,idempotencyKey:`${locked.order_id}:REFUND`,type:'REFUND',amount:principal+shippingFee,orderId:locked.order_id,payload:{buyer_id:locked.buyer_id,...metadata}});

  const clearing=await accountId(c,ACCOUNT.clearing);
  const customer=await accountId(c,ACCOUNT.customer);
  const shipping=await accountId(c,ACCOUNT.shipping);
  const total=principal+shippingFee;

  await postBalanced(c,{
    reference:newReference('REF'),
    type:'escrow_refund',
    metadata:{order_id:locked.order_id,buyer_id:locked.buyer_id,refund_principal:String(principal),refund_shipping:String(shippingFee),...metadata},
    entries:[
      {account_id:clearing,amount:-total},
      {account_id:customer,amount:principal,owner_user_id:locked.buyer_id},
      ...(shippingFee>0n ? [{account_id:shipping,amount:shippingFee}] : [])
    ]
  });
}
