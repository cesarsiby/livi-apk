import {Router} from 'express';
import {z} from 'zod';
import {pool,tx} from '../config/db.js';
import {asyncHandler,ok,HttpError} from '../utils/http.js';
import {requireAuth,requireRoles,requireKycLevel} from '../middleware/auth.js';
import {accountId,postBalanced,ACCOUNT,newReference} from '../services/market.js';
import {calculateWithdrawalFee} from '../services/withdrawal.js';
import {payableBalance,ledgerOwedToUser} from '../services/wallet.js';
import {enqueueNotification} from '../services/notifications.js';
import {ensurePartner,markPartnerInstruction} from '../services/partnerInstructions.js';

const r=Router(); r.use(requireAuth);

async function getRule(c,role){
  const row=(await c.query(`SELECT commission_bps,min_fee_xof,max_fee_xof FROM withdrawal_fee_rules WHERE role=$1 AND active=true ORDER BY effective_from DESC LIMIT 1`,[role])).rows[0];
  return row||{commission_bps:0,min_fee_xof:0,max_fee_xof:null};
}

r.get('/fee',requireRoles('vendor','transporter'),asyncHandler(async(req,res)=>{
  const roles=(req.user.roles||[]).map(r=>typeof r==='string'?r:r.role); const role=['vendor','transporter'].includes(req.user.role)?req.user.role:(roles.find(r=>['vendor','transporter'].includes(r))||'vendor');
  const rule=await getRule(pool,role);
  ok(res,{role,commission_bps:rule.commission_bps,min_fee_xof:rule.min_fee_xof,max_fee_xof:rule.max_fee_xof});
}));

r.get('/mine',asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference,provider,provider_reference,failure_reason,created_at,processed_at FROM payout_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.sub])).rows)));

r.post('/',requireRoles('vendor','transporter'),(req,res,next)=>{ const roles=(req.user.roles||[]).map(r=>typeof r==='string'?r:r.role); const role=['vendor','transporter'].includes(req.user.role)?req.user.role:(roles.find(r=>['vendor','transporter'].includes(r))||'vendor'); req.liviPayoutRole=role; return requireKycLevel(role,3)(req,res,next); },asyncHandler(async(req,res)=>{
  const s=z.object({amount_xof:z.number().int().positive(),destination_ref:z.string().min(3).max(200)}).parse(req.body);
  const result=await tx(async c=>{
    await c.query(`SELECT livi_payout_user_lock($1)`,[req.user.sub]);
    const role=req.liviPayoutRole || req.user.role; req.user.role=role; const bal=await payableBalance(c,req.user.role,req.user.sub);
    const gross=BigInt(s.amount_xof);
    if(bal.available<gross)throw new HttpError(409,'Solde disponible insuffisant','INSUFFICIENT_FUNDS');
    const rule=await getRule(c,req.user.role);
    const calc=calculateWithdrawalFee(gross,rule.commission_bps,rule.min_fee_xof,rule.max_fee_xof);
    const p=(await c.query(`INSERT INTO payout_requests(user_id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference) VALUES($1,$2,$3,$4,$5,'XOF',$6,'pending',$7) RETURNING id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference,created_at`,[req.user.sub,gross,rule.commission_bps,calc.fee,calc.net,s.destination_ref,newReference('PAYOUT')])).rows[0];
    await ensurePartner(c,{operationKey:`PAYOUT:${p.id}`,idempotencyKey:`${p.id}:PAYOUT`,type:'PAYOUT',amount:gross,payoutId:p.id,payload:{destination_ref:s.destination_ref,net_amount:calc.net.toString()}}); await enqueueNotification(c,{userId:req.user.sub,type:'payout_requested',title:'Demande de payout enregistrée',body:'Votre demande de payout est en attente de traitement.',data:{payout_id:p.id}}); return p;
  });
  ok(res,result,201);
}));


r.post('/:id/cancel',requireRoles('vendor','transporter'),asyncHandler(async(req,res)=>{const x=(await pool.query(`UPDATE payout_requests SET status='cancelled',updated_at=now() WHERE id=$1 AND user_id=$2 AND status='pending' RETURNING *`,[req.params.id,req.user.sub])).rows[0];if(!x)throw new HttpError(409,'Demande de retrait non annulable');ok(res,x)}));

r.get('/admin/pending',requireRoles('admin'),asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT p.*,u.phone,u.email,u.role FROM payout_requests p JOIN users u ON u.id=p.user_id WHERE p.status='pending' ORDER BY p.created_at ASC LIMIT 100`)).rows)));
r.post('/admin/:id/mark-processing',requireRoles('admin'),asyncHandler(async(req,res)=>{const x=(await pool.query(`UPDATE payout_requests SET status='processing',updated_at=now() WHERE id=$1 AND status='pending' RETURNING *`,[req.params.id])).rows[0];if(!x)throw new HttpError(409,'Demande non disponible');ok(res,x)}));
r.post('/admin/:id/fail',requireRoles('admin'),asyncHandler(async(req,res)=>{const x=(await pool.query(`UPDATE payout_requests SET status='failed',failure_reason=$2,updated_at=now() WHERE id=$1 AND status IN ('pending','processing') RETURNING *`,[req.params.id,String(req.body?.reason||'Échec partenaire')])).rows[0];if(!x)throw new HttpError(409,'Demande non disponible');ok(res,x)}));

r.post('/admin/:id/complete',requireRoles('admin'),asyncHandler(async(req,res)=>{
  const result=await tx(async c=>{
    const p=(await c.query(`SELECT * FROM payout_requests WHERE id=$1 FOR UPDATE`,[req.params.id])).rows[0];
    if(!p)throw new HttpError(404,'Demande introuvable');
    if((!req.body?.provider || !req.body?.provider_reference)) throw new HttpError(422,'La référence du partenaire est obligatoire en production','PROVIDER_REFERENCE_REQUIRED');
    if(!['processing','pending'].includes(p.status))throw new HttpError(409,'Demande non exécutable');
    const u=(await c.query(`SELECT role FROM users WHERE id=$1`,[p.user_id])).rows[0];
    const acct=u.role==='vendor'?ACCOUNT.vendor:ACCOUNT.transporter;
    const balance=await ledgerOwedToUser(c,acct,p.user_id);
    if(balance<BigInt(p.amount))throw new HttpError(409,'Solde payable insuffisant');
    const payable=await accountId(c,acct),clearing=await accountId(c,ACCOUNT.clearing),feeAccount=await accountId(c,ACCOUNT.fee);
    const gross=BigInt(p.amount),fee=BigInt(p.fee_amount),net=BigInt(p.net_amount);
    if(gross!==fee+net)throw new HttpError(500,'Payout incohérent','PAYOUT_INCONSISTENT');
    const lt=await postBalanced(c,{reference:p.reference,type:'payout_settlement',metadata:{payout_id:p.id,user_id:p.user_id,role:u.role,gross_amount:String(gross),withdrawal_fee:String(fee),net_amount:String(net)},entries:[{account_id:payable,amount:gross,owner_user_id:p.user_id},{account_id:clearing,amount:-net},{account_id:feeAccount,amount:-fee}]});
    await markPartnerInstruction(c,{idempotencyKey:`${p.id}:PAYOUT`,status:'completed',providerReference:req.body?.provider_reference,response:{provider:req.body?.provider}}); await c.query(`UPDATE payout_requests SET status='paid',processed_at=now(),paid_at=now(),provider=$2,provider_reference=$3,updated_at=now() WHERE id=$1`,[p.id,req.body?.provider||'manual',req.body?.provider_reference||null]);
    await c.query(`INSERT INTO financial_operations(operation_key,payout_id,type,status,amount,ledger_transaction_id,metadata) VALUES($1,$2,'payout','completed',$3,$4,$5) ON CONFLICT(operation_key) DO NOTHING`,[p.reference,p.id,gross,lt,{gross_amount:String(gross),withdrawal_fee:String(fee),net_amount:String(net),role:u.role,provider:req.body?.provider||'manual'}]);
    return {status:'paid',payout_id:p.id,gross_amount:gross.toString(),withdrawal_fee:fee.toString(),net_amount:net.toString()};
  });
  ok(res,result);
}));

r.get('/:id',asyncHandler(async(req,res)=>{
  const {rows}=await pool.query('SELECT id,amount,fee_bps,fee_amount,net_amount,currency,destination_ref,status,reference,provider,provider_reference,failure_reason,created_at,processed_at,paid_at,updated_at FROM payout_requests WHERE id=$1 AND user_id=$2',[req.params.id,req.user.sub]);
  if(!rows[0]) throw new HttpError(404,'Versement introuvable');
  ok(res,rows[0]);
}));

export default r;
