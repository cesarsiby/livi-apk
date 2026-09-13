import { Router } from 'express'; import { z } from 'zod'; import { pool } from '../config/db.js'; import { asyncHandler,ok,HttpError } from '../utils/http.js'; import { requireAuth,requireRoles } from '../middleware/auth.js'; import { reconcileLedger, reconcileEscrows } from '../services/reconciliation.js'; import { reconcilePartnerPayments } from '../services/partnerReconciliation.js';
import { openCorrection, approveCorrection, rejectCorrection, executeCustomerCompensation } from '../services/financialCorrections.js'; import { tx } from '../config/db.js';
const r=Router(); r.use(requireAuth,requireRoles('admin'));
r.get('/dashboard',asyncHandler(async(req,res)=>{const q=await pool.query("SELECT (SELECT count(*) FROM users) users,(SELECT count(*) FROM orders) orders,(SELECT count(*) FROM orders WHERE status='paid') paid_orders,(SELECT coalesce(sum(total_amount),0) FROM orders WHERE status NOT IN ('cancelled','refunded')) gross_order_value");ok(res,q.rows[0]);}));
r.get('/users',asyncHandler(async(req,res)=>{const {rows}=await pool.query('SELECT u.id,u.phone,u.name,u.role,u.status,u.created_at,coalesce(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL),ARRAY[u.role]) roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id ORDER BY created_at DESC LIMIT 100');ok(res,rows);}));

// V40: this route ingests a partner's payment statement into the
// reconciliation engine (mission section 9 — "LIVI doit comparer BASE LIVI
// vs RELEVÉ PARTENAIRE") and previously took `req.body||{}` with zero
// shape validation before handing it to reconcilePartnerPayments(), which
// iterates `records` and inserts each into partner_reconciliation_items.
// A malformed or missing `records` array, or non-numeric amounts, would
// have surfaced as an opaque runtime error deep inside the service layer
// instead of a clear 400 at the API boundary. Now validated explicitly.
const partnerPaymentsSchema = z.object({
  provider: z.string().min(1).max(60),
  period_start: z.string().datetime().or(z.string().min(8)),
  period_end: z.string().datetime().or(z.string().min(8)),
  source_reference: z.string().max(200).optional(),
  // Field names below match what src/services/partnerReconciliation.js
  // actually reads (normalizeProviderRecord: r.event_id, r.reference,
  // r.amount, r.currency, r.type) — the schema exists to reject a
  // malformed statement at the API boundary with a clear 400, not to
  // rename fields the service doesn't consume.
  records: z.array(z.object({
    event_id: z.string().min(1).max(200),
    reference: z.string().min(1).max(200).optional(),
    payment_reference: z.string().min(1).max(200).optional(),
    order_id: z.string().uuid().optional(),
    amount: z.union([z.number(), z.string()]),
    currency: z.string().length(3).optional(),
    type: z.string().max(60).optional()
  })).min(1)
});
r.post('/reconciliation/partner-payments',asyncHandler(async(req,res)=>{
 const {provider,period_start,period_end,records,source_reference}=partnerPaymentsSchema.parse(req.body);
 const result=await tx(c=>reconcilePartnerPayments(c,{provider,periodStart:period_start,periodEnd:period_end,records,sourceReference:source_reference,createdBy:req.user.sub}));
 ok(res,result,201);
}));
r.get('/reconciliation/runs',asyncHandler(async(req,res)=>{
 const {rows}=await pool.query(`SELECT id,provider,period_start,period_end,source_reference,status,totals,created_at FROM partner_reconciliation_runs ORDER BY created_at DESC LIMIT 50`); ok(res,rows);
}));
r.get('/reconciliation/runs/:id',asyncHandler(async(req,res)=>{
 const run=(await pool.query(`SELECT * FROM partner_reconciliation_runs WHERE id=$1`,[req.params.id])).rows[0];
 if(!run) throw new HttpError(404,'Réconciliation introuvable','RECON_RUN_NOT_FOUND');
 const {rows}=await pool.query(`SELECT id,external_event_id,payment_reference,order_id,expected_amount::text,provider_amount::text,currency,discrepancy_type,details,created_at FROM partner_reconciliation_items WHERE run_id=$1 ORDER BY created_at`,[run.id]); ok(res,{run,items:rows});
}));

// V40: this route opens a financial-correction case (mission section 10 —
// anomalie → investigation → dossier → approbation → exécution). Previously
// `req.body||{}` was read with no shape validation at all before being
// passed to openCorrection(); `case_type`/`reason` (both NOT NULL columns
// per migration) could be undefined, again only failing deep inside the
// service layer instead of at the API boundary. Now validated explicitly.
const openCorrectionSchema = z.object({
  reconciliation_item_id: z.string().uuid().optional(),
  provider: z.string().max(60).optional(),
  order_id: z.string().uuid().optional(),
  payment_reference: z.string().max(200).optional(),
  case_type: z.enum(['amount_mismatch','missing_in_livi','missing_at_partner','duplicate','unknown_reference','state_mismatch','manual_adjustment']),
  proposed_amount: z.number().int().optional(),
  reason: z.string().min(5).max(2000),
  evidence: z.record(z.any()).optional()
});
r.post('/reconciliation/corrections',asyncHandler(async(req,res)=>{
 const b=openCorrectionSchema.parse(req.body);
 const result=await tx(c=>openCorrection(c,{reconciliationItemId:b.reconciliation_item_id||null,provider:b.provider||null,orderId:b.order_id||null,paymentReference:b.payment_reference||null,caseType:b.case_type,proposedAmount:b.proposed_amount,reason:b.reason,evidence:b.evidence||{},createdBy:req.user.sub}));
 ok(res,result,201);
}));
r.get('/reconciliation/corrections',asyncHandler(async(req,res)=>{ const {rows}=await pool.query(`SELECT * FROM financial_correction_cases ORDER BY created_at DESC LIMIT 100`); ok(res,rows); }));
r.post('/reconciliation/corrections/:id/approve',asyncHandler(async(req,res)=>{ const result=await tx(c=>approveCorrection(c,{caseId:req.params.id,actorId:req.user.sub,reason:req.body?.reason})); ok(res,result); }));
r.post('/reconciliation/corrections/:id/reject',asyncHandler(async(req,res)=>{ const result=await tx(c=>rejectCorrection(c,{caseId:req.params.id,actorId:req.user.sub,reason:req.body?.reason})); ok(res,result); }));
r.post('/reconciliation/corrections/:id/execute-customer-compensation',asyncHandler(async(req,res)=>{ const result=await tx(c=>executeCustomerCompensation(c,{caseId:req.params.id,actorId:req.user.sub})); ok(res,result); }));

r.get('/integrity',asyncHandler(async(req,res)=>{
 const [ledger,escrows]=await Promise.all([reconcileLedger(pool),reconcileEscrows(pool)]);
 ok(res,{ok:ledger.length===0&&escrows.length===0,ledger_unbalanced:ledger,escrow_inconsistencies:escrows});
}));
export default r;
