import { Router } from 'express';
import { z } from 'zod';
import { pool,tx } from '../config/db.js';
import { asyncHandler,ok,HttpError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';
import { assertOrderTransition } from '../services/orderLifecycle.js';
import { cancelOrder } from '../services/orderCancellation.js';
import { replayIdempotency, saveIdempotency } from '../middleware/idempotency.js';
import { enqueueNotification } from '../services/notifications.js';
import { computeDeliveryFee, passthroughPrice, activeCommissionBps, calculateCommission, calculateBuyerPrice, calculateVendorNet } from '../services/orderPricing.js';
const r=Router(); r.use(requireAuth);
const create=z.object({items:z.array(z.object({product_id:z.string().uuid(),product_variant_id:z.string().uuid().optional(),quantity:z.number().int().positive().max(1000)})).min(1),delivery_address_id:z.string().uuid(),shipping_fee_xof:z.number().int().nonnegative().optional()});
r.get('/',asyncHandler(async(req,res)=>{
  const roles=(req.user.roles||[]).map(r=>typeof r==='string'?r:r.role);
  const isVendor=req.user.role==='vendor' || roles.includes('vendor');
  const q=isVendor
    ? 'SELECT id,status,total_amount,currency,created_at FROM orders WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 100'
    : 'SELECT id,status,total_amount,currency,created_at FROM orders WHERE buyer_id=$1 ORDER BY created_at DESC LIMIT 100';
  const {rows}=await pool.query(q,[req.user.sub]); ok(res,rows);
}));
r.get('/:id',asyncHandler(async(req,res)=>{const {rows}=await pool.query(`SELECT o.*,e.status escrow_status,s.transporter_id,coalesce((SELECT json_agg(oi ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id),'[]'::json) items FROM orders o LEFT JOIN escrow_transactions e ON e.order_id=o.id LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1 AND (o.buyer_id=$2 OR o.vendor_id=$2)`,[req.params.id,req.user.sub]); if(!rows[0])throw new HttpError(404,'Commande introuvable');ok(res,rows[0]);}));r.post('/quote',asyncHandler(async(req,res)=>{
  const body=create.parse(req.body);
  const firstProduct=(await pool.query('SELECT vendor_id FROM products WHERE id=$1',[body.items[0].product_id])).rows[0];
  if(!firstProduct)throw new HttpError(409,'Produit indisponible');
  const vendor=firstProduct.vendor_id;
  const vendorRow=(await pool.query('SELECT commission_passthrough FROM vendors WHERE id=$1',[vendor])).rows[0];
  const commissionBps=vendorRow?.commission_passthrough?await activeCommissionBps(pool):0;
  let subtotal=0;
  for(const i of body.items){
    const p=(await pool.query('SELECT price_xof,status FROM products WHERE id=$1',[i.product_id])).rows[0];
    if(!p||p.status!=='active')throw new HttpError(409,'Produit indisponible');
    let base=BigInt(p.price_xof);
    if(i.product_variant_id){const v=(await pool.query('SELECT price_xof,status FROM product_variants WHERE id=$1 AND product_id=$2',[i.product_variant_id,i.product_id])).rows[0];if(!v||v.status!=='active')throw new HttpError(409,'Variante indisponible');base=BigInt(v.price_xof??p.price_xof);}
    const unit=commissionBps>0?passthroughPrice(base,commissionBps):Number(base);
    subtotal+=unit*i.quantity;
  }
  const delivery=await computeDeliveryFee(pool,{vendorId:vendor,addressId:body.delivery_address_id});
  ok(res,{subtotal_xof:subtotal,shipping_fee_xof:delivery.fee_xof,total_xof:subtotal+delivery.fee_xof,distance_km:delivery.distance_km});
}));
r.post('/',asyncHandler(async(req,res)=>{const body=create.parse(req.body);
  // SESSION 26 (§25 prompt maître, idempotence) : le mécanisme
  // idempotency_keys existe déjà et est déjà utilisé par /:id/cancel
  // juste plus bas dans ce même fichier, mais pas par la création de
  // commande elle-même — la route la plus exposée à un double-tap ou une
  // requête rejouée après un timeout réseau (chaque tentative décrémente
  // le stock et crée sa propre ligne escrow_transactions indépendamment).
  // Strictement additif : si le client n'envoie pas l'en-tête
  // Idempotency-Key, replayIdempotency() renvoie immédiatement `null`
  // (faux) et le comportement reste exactement celui d'avant.
  if (await replayIdempotency(req,res)) return;
  const result=await tx(async c=>{
  const firstProduct=(await c.query('SELECT vendor_id FROM products WHERE id=$1',[body.items[0].product_id])).rows[0];
  if(!firstProduct)throw new HttpError(409,'Produit indisponible');
  const vendor=firstProduct.vendor_id;
  for(const i of body.items){const v=(await c.query('SELECT vendor_id FROM products WHERE id=$1',[i.product_id])).rows[0];if(!v||v.vendor_id!==vendor)throw new HttpError(422,'Une commande LIVI doit concerner un seul vendeur');}
  const addr=(await c.query('SELECT id FROM user_addresses WHERE id=$1 AND user_id=$2',[body.delivery_address_id,req.user.sub])).rows[0];
  if(!addr)throw new HttpError(422,'Adresse de livraison invalide');

  // V-AUDIT (correction financière critique — sections 21/22 de l'audit):
  // the commission rate is now ALWAYS snapshotted at order creation, not
  // only when the vendor passes it through to the buyer. Whether or not
  // the buyer's price is marked up, the vendor's payout at release is
  // still reduced by this same rate (absorbed silently when passthrough
  // is off) — so the rate that applies must be the one active *now*,
  // locked in, regardless of which branch prices the line items. Fetching
  // it only conditionally (as before) meant a non-passthrough order's
  // eventual payout used whatever rate was active at release time, which
  // can differ from the rate active when the order was placed.
  const vendorRow=(await c.query('SELECT commission_passthrough FROM vendors WHERE id=$1',[vendor])).rows[0];
  const passthrough = !!vendorRow?.commission_passthrough;
  const commissionBps = await activeCommissionBps(c);

  let total=0, baseSubtotal=0, vendorNetTotal=0n; const priced=[];
  for(const i of body.items){
    const p=await c.query('SELECT id,price_xof,stock,status FROM products WHERE id=$1 FOR UPDATE',[i.product_id]);
    if(!p.rows[0]||p.rows[0].status!=='active')throw new HttpError(409,'Produit indisponible');
    let base=BigInt(p.rows[0].price_xof);
    if(i.product_variant_id){ const v=(await c.query('SELECT id,price_xof,stock_qty,status FROM product_variants WHERE id=$1 AND product_id=$2 FOR UPDATE',[i.product_variant_id,i.product_id])).rows[0]; if(!v||v.status!=='active'||v.stock_qty<i.quantity)throw new HttpError(409,'Variante indisponible'); base=BigInt(v.price_xof??p.rows[0].price_xof); } else if(p.rows[0].stock<i.quantity) throw new HttpError(409,'Produit indisponible');
    // Commission computed off this item's own base price, per unit, the
    // same way passthroughPrice() already built the buyer-facing price —
    // matching that exact per-item computation (rather than computing
    // once against a summed total) is what guarantees vendorNetTotal and
    // total reconcile to the cent with no separate rounding path.
    const commission = calculateCommission(base, commissionBps);
    const unit = passthrough ? calculateBuyerPrice(base, commission, true) : Number(base);
    const vendorNetUnit = calculateVendorNet(base, commission, passthrough);
    total+=Number(unit)*i.quantity;
    baseSubtotal+=Number(base)*i.quantity;
    vendorNetTotal+=vendorNetUnit*BigInt(i.quantity);
    priced.push({product_id:i.product_id,product_variant_id:i.product_variant_id||null,quantity:i.quantity,unit:Number(unit)});
  }

  // V54: shipping_fee_xof used to be trusted verbatim from the client
  // (`.default(0)`, no server-side computation at all — see git history of
  // this route). Now backend-authoritative: computed from
  // delivery_fee_rules + real distance when coordinates are available.
  const delivery=await computeDeliveryFee(c,{vendorId:vendor,addressId:body.delivery_address_id});
  const shippingFee=delivery.fee_xof;

  const o=(await c.query('INSERT INTO orders(buyer_id,vendor_id,status,subtotal_amount,base_subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id) VALUES($1,$2,\'pending_payment\',$3,$4,$5,$6,\'XOF\',$7) RETURNING *',[req.user.sub,vendor,total,baseSubtotal,shippingFee,total+shippingFee,body.delivery_address_id])).rows[0];
  for(const i of priced){
    await c.query('INSERT INTO order_items(order_id,product_id,product_variant_id,quantity,unit_price,total_price) VALUES($1,$2,$3,$4,$5,$6)',[o.id,i.product_id,i.product_variant_id,i.quantity,i.unit,i.unit*i.quantity]);
    if(i.product_variant_id) await c.query('UPDATE product_variants SET stock_qty=stock_qty-$1,updated_at=now() WHERE id=$2',[i.quantity,i.product_variant_id]);
    else await c.query('UPDATE products SET stock=stock-$1,updated_at=now() WHERE id=$2',[i.quantity,i.product_id]);
  }
  // vendor_net_amount_snapshot + commission_bps: read directly by
  // releaseEscrow()/releaseEscrowWithActiveCommission() (services/finance.js)
  // instead of being re-derived from `amount` and the *currently* active
  // commission rate at release time — see migrations/040_v55_commission_snapshot.sql
  // for the full rationale and the bug this fixes.
  await c.query('INSERT INTO escrow_transactions(order_id,buyer_id,vendor_id,amount,shipping_fee,status,commission_bps,vendor_net_amount_snapshot) VALUES($1,$2,$3,$4,$5,\'awaiting_payment\',$6,$7)',[o.id,req.user.sub,vendor,total,shippingFee,commissionBps,vendorNetTotal.toString()]);
  await enqueueNotification(c,{userId:vendor,type:'order_created',title:'Nouvelle commande',body:'Une nouvelle commande attend votre préparation.',data:{order_id:o.id}});
  return {...o,delivery_distance_km:delivery.distance_km};
}); await saveIdempotency(req,201,{success:true,data:result,request_id:res.locals.requestId}); ok(res,result,201);}));


r.post('/:id/review',asyncHandler(async(req,res)=>{
  const b=z.object({product_id:z.string().uuid(),rating:z.number().int().min(1).max(5),comment:z.string().max(2000).optional()}).parse(req.body);
  const row=await tx(async c=>{
    const o=(await c.query('SELECT id,status,buyer_id FROM orders WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if(!o)throw new HttpError(404,'Commande introuvable');
    if(o.buyer_id!==req.user.sub)throw new HttpError(403,'Commande non autorisée');
    if(!['delivered','completed'].includes(o.status))throw new HttpError(409,'La commande doit être livrée avant de laisser un avis');
    const item=(await c.query('SELECT 1 FROM order_items WHERE order_id=$1 AND product_id=$2 LIMIT 1',[o.id,b.product_id])).rows[0];
    if(!item)throw new HttpError(422,'Produit absent de la commande');
    return (await c.query('INSERT INTO reviews(order_id,product_id,user_id,rating,comment) VALUES($1,$2,$3,$4,$5) RETURNING *',[o.id,b.product_id,req.user.sub,b.rating,b.comment||null])).rows[0];
  });
  ok(res,row,201);
}));

r.post('/:id/cancel',asyncHandler(async(req,res)=>{
 const body=z.object({reason:z.string().min(3).max(500).default('Annulation demandée')}).parse(req.body||{});
 // V35: honor Idempotency-Key so a client retry (timeout, double-tap,
 // network drop before the response arrived) replays the original result
 // instead of re-entering the cancellation transaction. This is on top of,
 // not instead of, the row-lock + stock_restored_at guard inside
 // cancelOrder(), which remains the authoritative protection against
 // double stock restitution regardless of whether a caller sends a key.
 if (await replayIdempotency(req,res)) return;
 const result=await tx(c=>cancelOrder(c,{orderId:req.params.id,actorId:req.user.sub,actorRole:req.user.role,reason:body.reason}));
 await saveIdempotency(req,200,{success:true,data:result,request_id:res.locals.requestId});
 ok(res,result);
}));

export default r;
