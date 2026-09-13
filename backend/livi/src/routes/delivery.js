import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok, HttpError } from '../utils/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js'; import { proofLimiter } from '../middleware/security.js';
import { assertOrderTransition } from '../services/orderLifecycle.js';
import { consumeProof } from '../services/deliveryProof.js';

// V48: this file had 14 routes; only the 3 below are ever actually reached
// (verified against every apiRequest/uploadFile call site in the frontend
// AND every internal fetch()/redirect() in compatibility.js). The other 11
// (/mine, /assign, /order/:orderId/buyer-proof, /order/:orderId/seller-
// pickup-proof, /:id/proof/rotate, /:id/proof, /:id/proof/resolve,
// /:id/status, /:id/delivery-code, /:id/confirm-reception,
// /:id/release-escrow) were dead: the transporter/buyer/seller-facing
// equivalents of what they did all live in compatibility.js under
// different paths (/transporter/missions/*, /orders/:id/confirm-receipt).
// Removed rather than left as an unreachable second implementation of the
// same money-moving logic (mission concern: duplicate endpoints).
const r=Router(); r.use(requireAuth);

// V49 (see RAPPORT_AUDIT_PARTIE5.md): the three handlers below are exported
// as plain functions, not just mounted as routes. compatibility.js's
// mobile-facing aliases (/transporter/missions/:id/{pickup,deliver} and
// /transporter/qr/scan) used to reach these either via an HTTP 307 redirect
// back to the client, or via a same-process loopback fetch() call to this
// same server. The redirect case could never actually work — the client
// only resends what IT originally sent (e.g. {pin:"..."} or
// {qr_token:"..."}), not the {credential:...} object the old handler
// reshaped req.body into just before redirecting, so the target route's
// `credential` field was always missing and pickup could never succeed.
// The loopback-fetch case worked, but added an avoidable network hop, a
// protocol/host guess (req.protocol + req.get('host')) that only holds if
// nothing sits between this process and itself, and no timeout of its own.
// Exporting these as functions lets compatibility.js call them in-process:
// identical SQL, transaction, authorization and error handling, reached by
// a plain awaited function call instead of a second HTTP round trip.

export async function resolveProof(credential, { actorRole, actorId }) {
 const body=z.object({credential:z.string().min(20).max(5000)}).parse({credential});
 let parsed=null;
 try { parsed=JSON.parse(body.credential); } catch { throw new HttpError(422,'QR LIVI invalide','QR_INVALID'); }
 if(parsed?.app!=='LIVI'||!parsed?.proof_id||!parsed?.token) throw new HttpError(422,'QR LIVI invalide','QR_INVALID');
 const row=(await pool.query(`SELECT sp.id,sp.shipment_id,sp.proof_type,sp.token_hash,sp.expires_at,sp.used_at,sp.revoked_at,s.status,o.id order_id,o.status order_status,o.buyer_id,o.vendor_id FROM shipment_proofs sp JOIN shipments s ON s.id=sp.shipment_id JOIN orders o ON o.id=s.order_id WHERE sp.id=$1`,[parsed.proof_id])).rows[0];
 if(!row) throw new HttpError(404,'Preuve introuvable','PROOF_NOT_FOUND');
 if(!(()=>{const a=Buffer.from(crypto.createHash('sha256').update(parsed.token).digest('hex'),'hex'),b=Buffer.from(row.token_hash,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b)})()) throw new HttpError(422,'QR LIVI invalide','QR_INVALID');
 if(row.used_at||row.revoked_at||new Date(row.expires_at)<=new Date()) throw new HttpError(409,'QR expiré ou déjà utilisé','PROOF_UNAVAILABLE');
 if(actorRole==='transporter'){
   const assigned=(await pool.query('SELECT transporter_id FROM shipments WHERE id=$1',[row.shipment_id])).rows[0];
   if(!assigned||assigned.transporter_id!==actorId) throw new HttpError(403,'Mission non autorisée');
 }
 return {proof_id:row.id,shipment_id:row.shipment_id,proof_type:row.proof_type,order_id:row.order_id,order_status:row.order_status,shipment_status:row.status};
}

export async function verifyPickupProof(shipmentId, { credential, latitude, longitude, actorRole, actorId, requestId, ip, userAgent }) {
 const body=z.object({credential:z.string().min(4).max(5000),latitude:z.number().optional(),longitude:z.number().optional()}).parse({credential,latitude,longitude});
 return tx(async c=>{
  const s=(await c.query('SELECT s.*,o.status order_status,o.vendor_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE',[shipmentId])).rows[0];
  if(!s) throw new HttpError(404,'Livraison introuvable');
  if(actorRole==='transporter'&&s.transporter_id!==actorId) throw new HttpError(403,'Mission non autorisée');
  if(s.status!=='assigned') throw new HttpError(409,'Le colis n’est pas prêt pour la remise','INVALID_PICKUP_STATE');
  await consumeProof(c,{shipmentId:s.id,proofType:'seller_pickup',credential:body.credential,actorId,requestId,ip,userAgent});
  // V54: was status='picked_up' — a dead end. Nothing ever moved a shipment
  // from 'picked_up' to 'in_transit' (required by both POST .../arrive and
  // verifyDeliveryProof below), so a transporter who had just picked up a
  // package could never declare arrival or complete the handoff. Moving
  // straight to 'in_transit' here (the 'picked_up' shipment_events row right
  // below still records exactly when the physical handoff happened).
  await c.query("UPDATE shipments SET status='in_transit',pickup_at=now(),pickup_proof_used_at=now() WHERE id=$1",[s.id]);
  await c.query('INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by) VALUES($1,\'picked_up\',$2,$3,$4,$5)',[s.id,body.latitude||null,body.longitude||null,'Remise vendeur validée par preuve LIVI',actorId]);
  if(['paid','preparing'].includes(s.order_status)) { assertOrderTransition(s.order_status,'shipping'); await c.query("UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1",[s.order_id]); }
  return {shipment_id:s.id,status:'in_transit',proof:'seller_pickup_verified'};
 });
}

export async function verifyDeliveryProof(shipmentId, { credential, latitude, longitude, actorRole, actorId, requestId, ip, userAgent }) {
 const body=z.object({credential:z.string().min(4).max(5000),latitude:z.number().optional(),longitude:z.number().optional()}).parse({credential,latitude,longitude});
 return tx(async c=>{
  const s=(await c.query('SELECT s.*,o.buyer_id,o.vendor_id,o.status AS order_status,o.id AS order_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE',[shipmentId])).rows[0];
  if(!s) throw new HttpError(404,'Livraison introuvable');
  if(actorRole==='transporter'&&s.transporter_id!==actorId) throw new HttpError(403,'Mission non autorisée');
  if(!['in_transit','arrived'].includes(s.status)) throw new HttpError(409,'Le colis n’est pas arrivé au stade de remise','INVALID_DELIVERY_STATE');
  if(s.status==='in_transit') await c.query("UPDATE shipments SET status='arrived',arrived_at=now() WHERE id=$1",[s.id]);
  await consumeProof(c,{shipmentId:s.id,proofType:'buyer_delivery',credential:body.credential,actorId,requestId,ip,userAgent});
  await c.query("UPDATE shipments SET status='delivered',delivered_at=now(),delivery_proof_used_at=now() WHERE id=$1",[s.id]);
  await c.query('INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by) VALUES($1,\'delivered\',$2,$3,$4,$5)',[s.id,body.latitude||null,body.longitude||null,'Réception acheteur validée par QR/PIN LIVI',actorId]);
  assertOrderTransition(s.order_status,'delivered');
  await c.query("UPDATE orders SET status='delivered',delivered_at=now(),updated_at=now() WHERE id=$1",[s.order_id]);
  const e=(await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[s.order_id])).rows[0];
  if(!e || e.status!=='funded') throw new HttpError(409,'Escrow non disponible pour libération','ESCROW_NOT_READY');
  const { releaseEscrowWithActiveCommission }=await import('../services/finance.js');
  const released=await releaseEscrowWithActiveCommission(c,e,{metadata:{delivery_proof_verified_by:actorId}});
  await c.query("UPDATE orders SET status='completed',delivery_confirmed_at=now(),delivery_confirmed_by=$2,updated_at=now() WHERE id=$1",[s.order_id,s.buyer_id]);
  return {shipment_id:s.id,order_id:s.order_id,status:'completed',delivery_proof_verified:true,escrow:'released',vendor_payable_xof:String(released.vendorNet),commission_xof:String(released.commission),shipping_payable_xof:String(e.shipping_fee)};
 });
}

r.post('/proof/resolve',proofLimiter,requireRoles('transporter','admin'),asyncHandler(async(req,res)=>{
 ok(res, await resolveProof(req.body?.credential, {actorRole:req.user.role,actorId:req.user.sub}));
}));

r.post('/:id/pickup-proof/verify',proofLimiter,requireRoles('transporter','admin'),asyncHandler(async(req,res)=>{
 const result=await verifyPickupProof(req.params.id,{credential:req.body?.credential,latitude:req.body?.latitude,longitude:req.body?.longitude,actorRole:req.user.role,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});
 ok(res,result);
}));

r.post('/:id/delivery-proof/verify',proofLimiter,requireRoles('transporter','admin'),asyncHandler(async(req,res)=>{
 const result=await verifyDeliveryProof(req.params.id,{credential:req.body?.credential,latitude:req.body?.latitude,longitude:req.body?.longitude,actorRole:req.user.role,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});
 ok(res,result);
}));

export default r;
