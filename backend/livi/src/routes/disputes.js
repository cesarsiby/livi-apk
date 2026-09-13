import { Router } from 'express';
import { z } from 'zod';
import { pool,tx } from '../config/db.js';
import { asyncHandler,ok,HttpError } from '../utils/http.js';
import { requireAuth,requireRoles } from '../middleware/auth.js';
import { releaseEscrowWithActiveCommission,refundEscrow } from '../services/finance.js';
const r=Router(); r.use(requireAuth);
const openSchema=z.object({order_id:z.string().uuid(),reason:z.string().min(10).max(2000),category:z.enum(['non_delivery','damaged','wrong_item','fraud','other']).default('other')});
r.get('/',asyncHandler(async(req,res)=>{const {rows}=await pool.query('SELECT d.*,o.total_amount,o.status order_status FROM disputes d JOIN orders o ON o.id=d.order_id WHERE d.opened_by=$1 OR o.buyer_id=$1 OR o.vendor_id=$1 ORDER BY d.created_at DESC LIMIT 100',[req.user.sub]);ok(res,rows);}));
r.post('/',asyncHandler(async(req,res)=>{const b=openSchema.parse(req.body);const result=await tx(async c=>{const o=(await c.query('SELECT * FROM orders WHERE id=$1 AND (buyer_id=$2 OR vendor_id=$2) FOR UPDATE',[b.order_id,req.user.sub])).rows[0];if(!o)throw new HttpError(404,'Commande introuvable');if(!['paid','preparing','shipping','delivered'].includes(o.status))throw new HttpError(409,'Commande non contestable à ce stade','DISPUTE_NOT_ALLOWED');
  // V54 (RAPPORT — "LITIGE APRÈS LIVRAISON"): 10 minutes after delivery
  // confirmation to open a dispute, enforced here (not just in the UI) so a
  // client can't bypass a countdown timer by calling the API directly.
  // Pre-delivery disputes (paid/preparing/shipping — e.g. never shipped)
  // aren't affected; the 10-minute rule is specifically about the window
  // after delivered_at.
  if(o.status==='delivered'&&o.delivered_at&&(Date.now()-new Date(o.delivered_at).getTime())>10*60*1000)throw new HttpError(409,'Le délai de 10 minutes pour signaler un problème après livraison est dépassé','DISPUTE_WINDOW_EXPIRED');
  const e=(await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[b.order_id])).rows[0];if(!e||!['funded','disputed'].includes(e.status))throw new HttpError(409,'Escrow non financé ou déjà réglé','DISPUTE_ESCROW_STATE');const d=(await c.query("INSERT INTO disputes(order_id,opened_by,reason,category) VALUES($1,$2,$3,$4) RETURNING *",[b.order_id,req.user.sub,b.reason,b.category])).rows[0];await c.query("UPDATE escrow_transactions SET status='disputed',updated_at=now() WHERE order_id=$1 AND status='funded'",[b.order_id]);await c.query("UPDATE orders SET status='disputed',updated_at=now() WHERE id=$1",[b.order_id]);return d;});ok(res,result,201);}));

r.post('/:id/resolve',requireRoles('admin'),asyncHandler(async(req,res)=>{
 const b=z.object({resolution:z.enum(['release','refund']),note:z.string().min(2).max(2000)}).parse(req.body);
 const result=await tx(async c=>{
  const d=(await c.query('SELECT d.* FROM disputes d WHERE d.id=$1 FOR UPDATE',[req.params.id])).rows[0];
  if(!d)throw new HttpError(404,'Litige introuvable');
  if(d.status!=='open')throw new HttpError(409,'Litige déjà résolu');
  // V37 fix: this route used to spread the dispute row (`{...d,status:...}`)
  // directly into releaseEscrow()/refundEscrow() as if it were the escrow
  // row itself. `disputes` has no buyer_id/vendor_id columns, and its own
  // `id` field is the DISPUTE's id, not the escrow's id. The practical
  // consequences were severe and had zero test coverage:
  //   (a) refundEscrow(c, e, ...) re-selects
  //       `escrow_transactions WHERE id=$1` using `e.id` — with the
  //       dispute's id substituted for the escrow's, that lookup always
  //       failed, so every dispute resolved as "refund" threw 404
  //       ESCROW_NOT_FOUND and never actually refunded the buyer.
  //   (b) releaseEscrow(c, e, ...) posted the vendor/customer ledger
  //       entries with owner_user_id=undefined (silently coerced to NULL
  //       by postBalanced()), so a vendor who won a dispute WAS credited
  //       in the ledger, but the credit was permanently unattributed —
  //       unwithdrawable and invisible to their balance — while the
  //       global ledger still summed to zero (which is why a purely
  //       global reconciliation check, like V36's, could not have caught
  //       this on its own; per-owner attribution has to be checked
  //       directly, see scripts/v37_payout_commission_reconciliation.js).
  // Fixed by selecting the real, locked escrow row and passing it as-is.
  const e=(await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[d.order_id])).rows[0];
  if(!e) throw new HttpError(404,'Escrow introuvable pour ce litige','DISPUTE_ESCROW_NOT_FOUND');
  if(b.resolution==='release'){
   await releaseEscrowWithActiveCommission(c,e,{metadata:{dispute_id:d.id}});
   await c.query("UPDATE orders SET status='completed',updated_at=now() WHERE id=$1",[d.order_id]);
  } else {
   await refundEscrow(c,e,{metadata:{dispute_id:d.id}});
   await c.query("UPDATE escrow_transactions SET status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1",[e.id]);
   await c.query("UPDATE orders SET status='refunded',updated_at=now() WHERE id=$1",[d.order_id]);
  }
  const out=(await c.query("UPDATE disputes SET status='resolved',resolution=$1,resolved_by=$2,resolved_at=now(),closed_at=now() WHERE id=$3 RETURNING *",[`${b.resolution}: ${b.note}`,req.user.sub,d.id])).rows[0];
  return out;
 });
 ok(res,result);
}));
export default r;
