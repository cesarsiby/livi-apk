import { Router } from 'express';
import crypto from 'node:crypto';
import { tx } from '../config/db.js';
import { asyncHandler,ok,HttpError } from '../utils/http.js';
import { accountId,postBalanced,ACCOUNT,newReference } from '../services/market.js';
import { env } from '../config/env.js';
import { enqueueNotification } from '../services/notifications.js';
import { markPartnerInstruction } from '../services/partnerInstructions.js';

const r=Router();

function validSignature(raw,signature){
  if(!env.PAYMENT_WEBHOOK_SECRET || !signature) return false;
  const expected=crypto.createHmac('sha256',env.PAYMENT_WEBHOOK_SECRET).update(raw).digest('hex');
  const a=Buffer.from(String(expected),'utf8');
  const b=Buffer.from(String(signature).trim(),'utf8');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

function parseAmount(value){
  try { return BigInt(String(value)); } catch { throw new HttpError(422,'Montant webhook invalide','WEBHOOK_AMOUNT_INVALID'); }
}

function eventReference(body){ return String(body?.reference||body?.payment_reference||body?.transaction_reference||''); }
function eventId(body){ return String(body?.id||body?.event_id||body?.eventId||''); }

r.post('/payments/:provider',asyncHandler(async(req,res)=>{
  const raw=req.rawBody||JSON.stringify(req.body);
  const signature=req.get('x-livi-signature');
  const valid=validSignature(raw,signature);
  if(!valid && env.NODE_ENV==='production') throw new HttpError(401,'Signature webhook invalide','WEBHOOK_SIGNATURE_INVALID');

  const provider=String(req.params.provider);
  const id=eventId(req.body);
  if(!id) throw new HttpError(400,'event_id requis','WEBHOOK_EVENT_ID_REQUIRED');
  const type=String(req.body?.type||req.body?.event_type||'');
  const reference=eventReference(req.body);
  const amount=parseAmount(req.body?.amount||0);
  if(amount<=0n) throw new HttpError(422,'Montant webhook invalide','WEBHOOK_AMOUNT_INVALID');

  const result=await tx(async c=>{
    const existing=(await c.query(`SELECT id,processed_at,status FROM partner_payment_events WHERE provider=$1 AND event_id=$2 FOR UPDATE`,[provider,id])).rows[0];
    if(existing) return {duplicate:true,processed:!!existing.processed_at,status:existing.status};

    // SESSION 26 — §25/§46 du prompt maître (idempotence paiement, test de
    // concurrence "2 webhooks identiques"). SELECT...FOR UPDATE ne peut
    // verrouiller que des lignes déjà existantes : deux livraisons
    // vraiment simultanées du même event_id peuvent toutes les deux lire
    // `existing=undefined` avant qu'aucune n'ait inséré. La contrainte
    // UNIQUE(provider,event_id) (migrations/001_initial.sql) empêche bien
    // un double traitement financier — la seconde requête échoue plutôt
    // que de rejouer postBalanced() — mais sans ce try/catch, cet échec
    // remontait en 500 générique {code:"23505"} au lieu de la même réponse
    // idempotente {duplicate:true} que le cas séquentiel ci-dessus. Le
    // fournisseur de paiement voit alors un échec là où l'événement a en
    // réalité été traité une fois, correctement, par l'autre requête.
    let inserted;
    try {
      inserted=(await c.query(`INSERT INTO partner_payment_events(provider,event_id,payload,signature_valid,status,event_type,amount,reference)
        VALUES($1,$2,$3,$4,'received',$5,$6,$7) RETURNING id`,[provider,id,req.body,valid,type,amount.toString(),reference||null])).rows[0];
    } catch(insertErr){
      if(insertErr?.code==='23505'){
        const race=(await c.query(`SELECT id,processed_at,status FROM partner_payment_events WHERE provider=$1 AND event_id=$2`,[provider,id])).rows[0];
        if(race) return {duplicate:true,processed:!!race.processed_at,status:race.status};
      }
      throw insertErr;
    }

    if(!valid){
      await c.query(`UPDATE partner_payment_events SET status='rejected',processing_error='invalid_signature',processed_at=now() WHERE id=$1`,[inserted.id]);
      throw new HttpError(401,'Signature webhook invalide','WEBHOOK_SIGNATURE_INVALID');
    }

    if(!['payment.succeeded','payment.failed','payment.cancelled','payment.expired'].includes(type)){
      await c.query(`UPDATE partner_payment_events SET status='quarantined',processing_error='unsupported_event_type',processed_at=now() WHERE id=$1`,[inserted.id]);
      return {duplicate:false,processed:true,status:'quarantined',reason:'unsupported_event_type'};
    }

    const e=(await c.query(`SELECT e.*,o.status AS order_status,o.currency AS order_currency
      FROM escrow_transactions e JOIN orders o ON o.id=e.order_id
      WHERE e.payment_reference=$1 FOR UPDATE`,[reference])).rows[0];
    if(!e){
      await c.query(`UPDATE partner_payment_events SET status='quarantined',processing_error='unknown_payment_reference',processed_at=now() WHERE id=$1`,[inserted.id]);
      return {duplicate:false,processed:true,status:'quarantined',reason:'unknown_payment_reference'};
    }
    await c.query(`UPDATE partner_payment_events SET order_id=$2,escrow_id=$3 WHERE id=$1`,[inserted.id,e.order_id,e.id]);

    if(type!=='payment.succeeded'){
      if(['awaiting_payment','payment_pending'].includes(e.status)){
        // V-AUDIT: payment.failed / payment.cancelled / payment.expired all
        // land here and all map to the same terminal escrow status — there
        // is no other valid status for a failed/cancelled/expired payment
        // in the escrow_transactions CHECK constraint (migrations/001).
        // Was previously `type==='payment.failed'?'cancelled':'cancelled'`,
        // a ternary whose two branches were identical — harmless (both
        // paths already produced the one valid outcome) but read like an
        // unfinished distinction between the three event types that was
        // never actually implemented.
        const next='cancelled';
        await c.query(`UPDATE escrow_transactions SET status=$2,updated_at=now() WHERE id=$1`,[e.id,next]);
        await c.query(`UPDATE orders SET status='cancelled',cancelled_at=now(),cancelled_reason=$2,updated_at=now() WHERE id=$1 AND status='payment_pending'`,[e.order_id,`partner_${type}`]);
        await c.query(`UPDATE partner_payment_events SET status='processed',processed_at=now() WHERE id=$1`,[inserted.id]); await markPartnerInstruction(c,{idempotencyKey:`${e.order_id}:HOLD`,status:'failed',providerReference:reference,error:type});
        return {duplicate:false,processed:true,status:'processed',payment_status:type};
      }
      await c.query(`UPDATE partner_payment_events SET status='quarantined',processing_error='late_non_success_event',processed_at=now() WHERE id=$1`,[inserted.id]);
      return {duplicate:false,processed:true,status:'quarantined',reason:'late_non_success_event'};
    }

    const expected=BigInt(e.amount)+BigInt(e.shipping_fee);
    if(amount!==expected){
      await c.query(`UPDATE partner_payment_events SET status='quarantined',processing_error=$2,processed_at=now() WHERE id=$1`,[inserted.id,`amount_mismatch_expected_${expected}_received_${amount}`]);
      return {duplicate:false,processed:true,status:'quarantined',reason:'amount_mismatch'};
    }

    if(e.status==='funded'){
      await c.query(`UPDATE partner_payment_events SET status='duplicate',processed_at=now() WHERE id=$1`,[inserted.id]);
      return {duplicate:false,processed:true,status:'duplicate',reason:'escrow_already_funded'};
    }

    // A success received after local cancellation/refund is never credited automatically.
    // It is quarantined for reconciliation so the partner-side money cannot silently become LIVI escrow.
    if(!['payment_pending'].includes(e.status) || ['cancelled','refunded'].includes(e.order_status)){
      await c.query(`UPDATE partner_payment_events SET status='quarantined',processing_error='late_success_after_state_change',processed_at=now() WHERE id=$1`,[inserted.id]);
      return {duplicate:false,processed:true,status:'quarantined',reason:'late_success_after_state_change'};
    }

    const clearing=await accountId(c,ACCOUNT.clearing),customer=await accountId(c,ACCOUNT.customer),shipping=await accountId(c,ACCOUNT.shipping);
    await postBalanced(c,{reference:newReference('PAY'),type:'partner_payment',metadata:{provider,event_id:id,order_id:e.order_id,payment_reference:reference},entries:[{account_id:clearing,amount:amount},{account_id:customer,amount:-BigInt(e.amount)},{account_id:shipping,amount:-BigInt(e.shipping_fee)}]});
    await c.query(`UPDATE escrow_transactions SET status='funded',funded_at=now(),updated_at=now() WHERE id=$1`,[e.id]);
    await c.query(`UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1 AND status='payment_pending'`,[e.order_id]); await enqueueNotification(c,{userId:e.buyer_id,type:'payment_succeeded',title:'Paiement sécurisé',body:'Le paiement de votre commande est confirmé.',data:{order_id:e.order_id}}); await enqueueNotification(c,{userId:e.vendor_id,type:'payment_succeeded',title:'Commande payée',body:'Une commande a été payée et peut être préparée.',data:{order_id:e.order_id}});
    await c.query(`UPDATE partner_payment_events SET status='processed',processed_at=now() WHERE id=$1`,[inserted.id]); await markPartnerInstruction(c,{idempotencyKey:`${e.order_id}:HOLD`,status:'completed',providerReference:reference,response:req.body});
    return {duplicate:false,processed:true,status:'processed',payment_status:'succeeded'};
  });

  ok(res,result,200);
}));

export default r;
