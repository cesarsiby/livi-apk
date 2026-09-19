import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok, HttpError } from '../utils/http.js';
import { requireAuth, requireRoles, requireKycLevel } from '../middleware/auth.js';
import { proofLimiter } from '../middleware/security.js';
import { env } from '../config/env.js';
import { assertOrderTransition, canBuyerConfirm } from '../services/orderLifecycle.js';
import { dispatchNextOffer } from '../services/missionDispatch.js';
// V49 (RAPPORT_AUDIT_PARTIE5.md): call the pickup/delivery/QR-resolve logic
// directly instead of via HTTP redirect/loopback — see delivery.js.
import { verifyPickupProof, verifyDeliveryProof, resolveProof } from './delivery.js';
import { KYC_DOCUMENT_TYPES } from './kyc.js';

const r = Router();
const upload = multer({ dest: path.resolve(process.cwd(), 'uploads') });
const mediaUpload = multer({ dest: path.resolve(process.cwd(), 'uploads'), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: (_req,file,cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)) });
const privateRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
const privateUpload = multer({ dest: privateRoot, limits: { fileSize: 10 * 1024 * 1024 } });
fs.mkdirSync(privateRoot, { recursive: true });
fs.mkdirSync(path.resolve(process.cwd(), 'uploads'), { recursive: true });

// ---------- Buyer compatibility / previously UI-only features ----------
r.get('/users/me/addresses', requireAuth, asyncHandler(async (req,res)=>ok(res,(await pool.query('SELECT * FROM user_addresses WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC',[req.user.sub])).rows)));
r.post('/users/me/addresses', requireAuth, asyncHandler(async(req,res)=>{
  const b=z.object({label:z.string().max(80).optional(),recipient_name:z.string().min(2),phone:z.string().min(6),address_line:z.string().min(3),city:z.string().min(2),region:z.string().optional(),country:z.string().length(2).default('ML'),latitude:z.number().optional(),longitude:z.number().optional(),is_default:z.boolean().default(false),neighborhood:z.string().max(120).optional(),landmark_type:z.string().max(40).optional(),landmark_description:z.string().max(500).optional()}).parse(req.body);
  const result=await tx(async c=>{if(b.is_default)await c.query('UPDATE user_addresses SET is_default=false WHERE user_id=$1',[req.user.sub]);return (await c.query('INSERT INTO user_addresses(user_id,label,recipient_name,phone,address_line,city,region,country,latitude,longitude,is_default,neighborhood,landmark_type,landmark_description) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *',[req.user.sub,b.label||null,b.recipient_name,b.phone,b.address_line,b.city,b.region||null,b.country,b.latitude??null,b.longitude??null,b.is_default,b.neighborhood||null,b.landmark_type||null,b.landmark_description||null])).rows[0]});ok(res,result,201);
}));
r.put('/users/me/addresses/:id', requireAuth, asyncHandler(async(req,res)=>{const b=z.record(z.any()).parse(req.body);const allowed=['label','recipient_name','phone','address_line','city','region','country','latitude','longitude','is_default','neighborhood','landmark_type','landmark_description'];const entries=Object.entries(b).filter(([k])=>allowed.includes(k));if(!entries.length)throw new HttpError(422,'Aucune donnée à modifier');const sets=entries.map(([k],i)=>`${k}=$${i+1}`).join(',');const vals=entries.map(([,v])=>v);const row=(await pool.query(`UPDATE user_addresses SET ${sets} WHERE id=$${vals.length+1} AND user_id=$${vals.length+2} RETURNING *`,[...vals,req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Adresse introuvable');ok(res,row)}));
r.delete('/users/me/addresses/:id', requireAuth, asyncHandler(async(req,res)=>{const row=(await pool.query('DELETE FROM user_addresses WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Adresse introuvable');ok(res,null,204)}));

r.get('/users/me/wishlist', requireAuth, asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT p.* FROM wishlists w JOIN products p ON p.id=w.product_id WHERE w.user_id=$1 ORDER BY w.created_at DESC`,[req.user.sub])).rows)));
r.post('/users/me/wishlist', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({product_id:z.string().uuid()}).parse(req.body);const row=(await pool.query('INSERT INTO wishlists(user_id,product_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING user_id,product_id',[req.user.sub,b.product_id])).rows[0]||{user_id:req.user.sub,product_id:b.product_id};ok(res,row,201)}));
r.delete('/users/me/wishlist/:productId', requireAuth, asyncHandler(async(req,res)=>{await pool.query('DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2',[req.user.sub,req.params.productId]);ok(res,null,204)}));

r.get('/users/me/payment-methods', requireAuth, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT id,operator,phone,is_default,status,provider_reference,created_at FROM payment_methods WHERE user_id=$1 AND status<>\'disabled\' ORDER BY is_default DESC,created_at DESC',[req.user.sub])).rows)));
r.post('/users/me/payment-methods/initiate', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({operator:z.string().min(2),phone:z.string().min(6)}).parse(req.body);const row=(await pool.query('INSERT INTO payment_methods(user_id,operator,phone,status) VALUES($1,$2,$3,\'pending\') RETURNING id,operator,phone,status',[req.user.sub,b.operator,b.phone])).rows[0];ok(res,{session_id:row.id,...row,verification_required:true,external_provider_required:true},201)}));
r.post('/users/me/payment-methods/verify', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({session_id:z.string().uuid(),otp:z.string().min(4),is_default:z.boolean().default(false)}).parse(req.body);if(!/^\d{4,8}$/.test(b.otp))throw new HttpError(422,'OTP invalide');const row=await tx(async c=>{if(b.is_default)await c.query('UPDATE payment_methods SET is_default=false WHERE user_id=$1',[req.user.sub]);return (await c.query("UPDATE payment_methods SET status='verified',is_default=$1,updated_at=now() WHERE id=$2 AND user_id=$3 RETURNING id,operator,phone,is_default,status",[b.is_default,b.session_id,req.user.sub])).rows[0]});if(!row)throw new HttpError(404,'Méthode de paiement introuvable');ok(res,row)}));
r.post('/users/me/payment-methods/resend-otp', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({session_id:z.string().uuid()}).parse(req.body);const row=(await pool.query('SELECT id FROM payment_methods WHERE id=$1 AND user_id=$2',[b.session_id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Méthode introuvable');ok(res,{session_id:row.id,external_provider_required:true})}));
r.delete('/users/me/payment-methods/:id', requireAuth, asyncHandler(async(req,res)=>{await pool.query("UPDATE payment_methods SET status='disabled',updated_at=now() WHERE id=$1 AND user_id=$2",[req.params.id,req.user.sub]);ok(res,null,204)}));
r.patch('/users/me/payment-methods/:id/default', requireAuth, asyncHandler(async(req,res)=>{const row=await tx(async c=>{await c.query('UPDATE payment_methods SET is_default=false WHERE user_id=$1',[req.user.sub]);return (await c.query("UPDATE payment_methods SET is_default=true,updated_at=now() WHERE id=$1 AND user_id=$2 AND status='verified' RETURNING *",[req.params.id,req.user.sub])).rows[0]});if(!row)throw new HttpError(404,'Méthode de paiement introuvable');ok(res,row)}));

r.get('/users/me/analytics', requireAuth, asyncHandler(async(req,res)=>{const q=await pool.query(`SELECT count(*)::int order_count,coalesce(sum(total_amount),0)::text total_spend_xof FROM orders WHERE buyer_id=$1`,[req.user.sub]);ok(res,q.rows[0])}));
r.get('/orders/refunds', requireAuth, asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT e.id,e.order_id,e.amount,e.shipping_fee,e.status,e.refunded_at FROM escrow_transactions e WHERE e.buyer_id=$1 AND e.status='refunded' ORDER BY e.refunded_at DESC NULLS LAST",[req.user.sub])).rows)));

// ---------- KYC compatibility ----------
// NOTE: GET /kyc/mine used to be duplicated here. It shadowed the dedicated
// handler in routes/kyc.js (mounted at /kyc) because this router is mounted
// before it in routes/index.js — Express matched this one first, silently
// skipping kyc.js's noStoreSensitive cache-control header and its narrower,
// explicit column list. Removed so the one real implementation in kyc.js is
// what actually runs. Kept /users/me/kyc (document submission) here since
// there is no duplicate for it.
r.post('/users/me/kyc', requireAuth, privateUpload.single('document'), asyncHandler(async(req,res)=>{
  const documentType=String(req.body?.document_type||req.body?.step||'identity');
  // V-AUDIT (section 34): validate against the same enum the DB CHECK
  // constraint enforces (kyc_document_type_check, migrations/034) instead
  // of relying on the DB alone to reject an invalid value — that would
  // surface as a raw, uncaught constraint-violation error rather than a
  // clean, actionable response. KYC_DOCUMENT_TYPES already existed
  // (routes/kyc.js) but was only applied by that file's own, unused
  // duplicate submission route — this is the one the frontend actually
  // calls (see MATRICE_FRONTEND_BACKEND.csv).
  if(!KYC_DOCUMENT_TYPES.includes(documentType)) throw new HttpError(422,'Type de document invalide.','KYC_DOCUMENT_TYPE_INVALID');
  const fileKey=req.file ? path.basename(req.file.path) : String(req.body?.file_key||'');
  if(!fileKey)throw new HttpError(422,'Document requis');
  const row=(await pool.query("INSERT INTO kyc_documents(user_id,document_type,file_key,status) VALUES($1,$2,$3,'pending') RETURNING *",[req.user.sub,documentType,fileKey])).rows[0];
  ok(res,row,201);
}));

// ---------- Catalogue / order compatibility ----------
r.get('/products/featured', asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT * FROM products WHERE status='active' ORDER BY created_at DESC LIMIT 20")).rows)));
r.get('/products/trending', asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT * FROM products WHERE status='active' ORDER BY created_at DESC LIMIT 20")).rows)));
r.get('/products/search', asyncHandler(async(req,res)=>{const q=String(req.query.q||'');ok(res,(await pool.query("SELECT * FROM products WHERE status='active' AND ($1='' OR search_vector @@ plainto_tsquery('simple',$1)) ORDER BY created_at DESC LIMIT 100",[q])).rows)}));
r.post('/orders/:id/confirm-receipt', requireAuth, requireRoles('client','admin'), asyncHandler(async(req,res)=>{
 const result=await tx(async c=>{
  const s=(await c.query('SELECT s.id,s.order_id,s.status,o.buyer_id,o.status order_status FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.order_id=$1 FOR UPDATE',[req.params.id])).rows[0];
  if(!s)throw new HttpError(404,'Livraison introuvable pour cette commande');
  if(req.user.role==='client'&&s.buyer_id!==req.user.sub)throw new HttpError(403,'Commande non autorisée');
  if(!canBuyerConfirm(s.order_status))throw new HttpError(409,'La réception ne peut pas encore être confirmée');
  const credential=req.body?.qr_token||req.body?.pin;
  if(credential){const {consumeProof}=await import('../services/deliveryProof.js');await consumeProof(c,{shipmentId:s.id,proofType:'buyer_delivery',credential,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});}
  const e=(await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[s.order_id])).rows[0];
  if(!e||e.status!=='funded')throw new HttpError(409,'Escrow non disponible pour libération','ESCROW_NOT_READY');
  const {releaseEscrowWithActiveCommission}=await import('../services/finance.js');const released=await releaseEscrowWithActiveCommission(c,e,{metadata:{confirmed_by:req.user.sub}});
  await c.query("UPDATE shipments SET status='delivered',delivered_at=coalesce(delivered_at,now()) WHERE id=$1",[s.id]);
  await c.query("UPDATE orders SET status='completed',delivery_confirmed_at=now(),delivery_confirmed_by=$2,updated_at=now() WHERE id=$1",[s.order_id,req.user.sub]);
  return {order_id:s.order_id,status:'completed',escrow:'released',vendor_payable_xof:String(released.vendorNet),commission_xof:String(released.commission)};
 }); ok(res,result);
}));

// Delivery proof retrieval — lets the seller view their seller_pickup PIN/QR
// and the buyer view their buyer_delivery PIN/QR, once a transporter has been
// assigned to the shipment (createProofs() runs on mission acceptance above).
// Read-only: uses getActiveProof(), which never creates/mutates a proof, so
// it cannot conflict with an already-consumed one.
r.get('/orders/:id/pickup-proof', requireAuth, proofLimiter, requireRoles('vendor','admin'), asyncHandler(async(req,res)=>{
 const s=(await pool.query('SELECT s.id shipment_id,o.vendor_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.id=$1',[req.params.id])).rows[0];
 if(!s)throw new HttpError(404,'Livraison introuvable pour cette commande');
 if(req.user.role==='vendor'&&s.vendor_id!==req.user.sub)throw new HttpError(403,'Commande non autorisée');
 const {getActiveProof}=await import('../services/deliveryProof.js');
 const proof=await getActiveProof(pool,{shipmentId:s.shipment_id,proofType:'seller_pickup'});
 res.setHeader('Cache-Control','no-store');
 ok(res,{pin:proof.pin,qr_payload:proof.qrPayload,expires_at:proof.expiresAt});
}));
r.get('/orders/:id/delivery-proof', requireAuth, proofLimiter, requireRoles('client','admin'), asyncHandler(async(req,res)=>{
 const s=(await pool.query('SELECT s.id shipment_id,o.buyer_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.id=$1',[req.params.id])).rows[0];
 if(!s)throw new HttpError(404,'Livraison introuvable pour cette commande');
 if(req.user.role==='client'&&s.buyer_id!==req.user.sub)throw new HttpError(403,'Commande non autorisée');
 const {getActiveProof}=await import('../services/deliveryProof.js');
 const proof=await getActiveProof(pool,{shipmentId:s.shipment_id,proofType:'buyer_delivery'});
 res.setHeader('Cache-Control','no-store');
 ok(res,{pin:proof.pin,qr_payload:proof.qrPayload,expires_at:proof.expiresAt});
}));

// ---------- Seller ----------
r.get('/vendor/dashboard', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const q=await pool.query(`SELECT (SELECT count(*) FROM products WHERE vendor_id=$1)::int product_count,(SELECT count(*) FROM orders WHERE vendor_id=$1)::int order_count,(SELECT coalesce(sum(total_amount),0) FROM orders WHERE vendor_id=$1 AND status NOT IN ('cancelled','refunded'))::text gross_sales_xof`,[req.user.sub]);ok(res,q.rows[0])}));
r.get('/vendor/shop', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query('SELECT * FROM vendors WHERE id=$1',[req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Boutique introuvable');ok(res,row)}));
r.patch('/vendor/shop', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const b=z.object({shop_name:z.string().min(2).max(160).optional(),slug:z.string().min(2).max(160).optional(),slogan:z.string().max(200).optional(),category:z.string().max(120).optional(),phone:z.string().max(30).optional(),city:z.string().max(100).optional(),address:z.string().max(500).optional(),commission_passthrough:z.boolean().optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()}).parse(req.body);const sets=[];const vals=[];for(const [k,v] of Object.entries(b)){sets.push(`${k}=$${vals.length+1}`);vals.push(v)}if(!sets.length)return ok(res,(await pool.query('SELECT * FROM vendors WHERE id=$1',[req.user.sub])).rows[0]);const row=(await pool.query(`UPDATE vendors SET ${sets.join(',')} WHERE id=$${vals.length+1} RETURNING *`,[...vals,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Boutique introuvable');ok(res,row)}));
// V54 (RAPPORT — "catégorie... 10 catégorie essentielle"): categories
// existed since 001_initial.sql with no listing route anywhere — a vendor
// had no way to see what to pick from even if the form offered a selector.
r.get('/categories', asyncHandler(async (req, res) => ok(res, (await pool.query('SELECT id,name,slug FROM categories ORDER BY name')).rows)));
r.get('/vendor/products', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM products WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.sub])).rows)));
r.post('/vendor/products', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const b=z.object({name:z.string().min(2).optional(),title:z.string().min(2).optional(),description:z.string().optional(),price_xof:z.number().int().positive().optional(),price:z.number().int().positive().optional(),stock:z.number().int().nonnegative().default(0),status:z.enum(['draft','active','paused','archived']).default('draft'),category_id:z.string().uuid().optional()}).parse(req.body);const name=b.name||b.title;if(!name||!b.price_xof&&!b.price)throw new HttpError(422,'Nom et prix requis');const price=b.price_xof||b.price;
  // V-AUDIT (section 18): products.slug is UNIQUE NOT NULL *globally*
  // (migrations/001_initial.sql — not scoped per vendor), derived purely
  // from `name`. Two different vendors naming a product the same thing
  // (very plausible: "T-shirt bleu", "Sac à main", common category names)
  // used to hit a raw Postgres unique-violation on the INSERT with no
  // handling at all — an uncaught error, surfaced as a generic 500. Now
  // caught and mapped to a specific, actionable 409, matching the pattern
  // already used for phone/vendor conflicts (services/auth.js).
  let row;
  try {
    row=(await pool.query("INSERT INTO products(vendor_id,name,slug,description,price_xof,stock,status,category_id) VALUES($1,$2,lower(regexp_replace($2,'[^a-zA-Z0-9]+','-','g')), $3,$4,$5,$6,$7) RETURNING *",[req.user.sub,name,b.description||null,price,b.stock,b.status,b.category_id||null])).rows[0];
  } catch(e) {
    if(e.code==='23505') throw new HttpError(409,'Un produit avec un nom très similaire existe déjà. Choisissez un nom légèrement différent.','PRODUCT_SLUG_ALREADY_EXISTS');
    throw e;
  }
  ok(res,row,201)}));
r.put('/vendor/products/:id', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{
  // V-AUDIT (SESSION 26, §18-19) : contrairement à la création juste
  // au-dessus, cette route acceptait req.body brut, sans validation Zod —
  // un prix négatif, un stock non numérique ou un statut invalide
  // n'étaient rattrapés qu'au niveau de la contrainte DB (price_xof>0,
  // stock>=0, status IN(...)), remontant alors en 500 générique au lieu
  // d'un 422 clair. Même schéma que POST, tous les champs optionnels
  // puisqu'il s'agit d'une mise à jour partielle.
  const b=z.object({name:z.string().min(2).optional(),title:z.string().min(2).optional(),description:z.string().optional(),price_xof:z.number().int().positive().optional(),price:z.number().int().positive().optional(),stock:z.number().int().nonnegative().optional(),status:z.enum(['draft','active','paused','archived']).optional(),category_id:z.string().uuid().optional()}).parse(req.body||{});
  if(b.status==='active'){const n=(await pool.query('SELECT count(*)::int n FROM product_media WHERE product_id=$1',[req.params.id])).rows[0]?.n||0;if(n<3)throw new HttpError(422,'Un produit doit avoir au moins 3 photos avant publication','PRODUCT_MEDIA_MINIMUM');}
  const row=(await pool.query('UPDATE products SET name=coalesce($1,name),description=coalesce($2,description),price_xof=coalesce($3,price_xof),stock=coalesce($4,stock),status=coalesce($5,status),category_id=coalesce($6,category_id),updated_at=now() WHERE id=$7 AND vendor_id=$8 RETURNING *',[b.name??b.title??null,b.description??null,b.price_xof??b.price??null,b.stock??null,b.status??null,b.category_id??null,req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Produit introuvable');ok(res,row)}));
r.delete('/vendor/products/:id', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query("UPDATE products SET status='archived',updated_at=now() WHERE id=$1 AND vendor_id=$2 RETURNING id,status",[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Produit introuvable');ok(res,row)}));
r.get('/vendor/inventory', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT id,name,stock,status FROM products WHERE vendor_id=$1 ORDER BY name',[req.user.sub])).rows)));
r.patch('/vendor/inventory/:id', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const q=z.object({quantity:z.number().int().nonnegative()}).parse(req.body);const row=(await pool.query('UPDATE products SET stock=$1,updated_at=now() WHERE id=$2 AND vendor_id=$3 RETURNING id,name,stock,status',[q.quantity,req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Produit introuvable');ok(res,row)}));
r.get('/vendor/orders', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM orders WHERE vendor_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.sub])).rows)));
r.get('/vendor/orders/:id', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query(`SELECT o.*,s.transporter_id,coalesce((SELECT json_agg(json_build_object('id',oi.id,'product_id',oi.product_id,'product_name',p.name,'quantity',oi.quantity,'unit_price',oi.unit_price,'total_price',oi.total_price) ORDER BY oi.id) FROM order_items oi JOIN products p ON p.id=oi.product_id WHERE oi.order_id=o.id),'[]'::json) items FROM orders o LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1 AND o.vendor_id=$2`,[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Commande introuvable');ok(res,row)}));
r.post('/vendor/orders/:id/confirm', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query("UPDATE orders SET status='preparing',updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status IN ('paid','pending_payment') RETURNING id,status",[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(409,'Commande non confirmable');ok(res,row)}));
// V54: this used to UPDATE orders SET status='preparing' ... WHERE status='preparing'
// — a no-op that could never change anything — and never touched the
// `shipments` table at all. Grepping the whole backend confirms no other
// route ever inserted into `shipments` either, so a transporter could never
// see or accept a mission for ANY order: the entire delivery chain was
// unreachable in production. This now performs the real preparing->shipping
// transition (matches services/orderLifecycle.js's TRANSITIONS map) and
// opens the shipment into the unassigned pool (see /transporter/missions
// below for the matching claim logic). ON CONFLICT makes a repeat call safe.
r.post('/vendor/orders/:id/ready', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{
 const result=await tx(async c=>{
  const row=(await c.query("UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status",[req.params.id,req.user.sub])).rows[0];
  if(!row)throw new HttpError(409,'Commande non prête');
  const shipment=(await c.query("INSERT INTO shipments(order_id,status) VALUES($1,'pending') ON CONFLICT (order_id) DO NOTHING RETURNING id,status",[req.params.id])).rows[0];
  // V54: was left as an open, unassigned pool for any transporter to claim.
  // Now proposes it to the single nearest available transporter first, per
  // "la mission doit être proposée en priorité aux transporteurs disponibles
  // les plus proches du vendeur" — see services/missionDispatch.js.
  let dispatch=null;
  if(shipment?.id) dispatch=await dispatchNextOffer(c,shipment.id);
  return {...row,shipment_id:shipment?.id??null,shipment_status:shipment?.status??null,dispatch};
 });
 ok(res,result);
}));
r.get('/vendor/analytics', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{
  // V-AUDIT (section 47/49): 'metrics'/'top_products' didn't exist in the
  // old response at all (flat {orders,gross_sales_xof,completed_sales_xof},
  // no period filtering despite the frontend always sending
  // ?period=week|month|all) — every card on this screen, and the entire
  // "Meilleurs produits" section, were permanently blank regardless of
  // real sales. "sales"/"revenue" below count only completed orders
  // (canRelease(status)==='completed' in orderLifecycle.js is this
  // project's own definition of a fully successful order) — an order
  // still pending/shipping isn't revenue yet.
  const period = String(req.query.period||'week');
  const since = period==='month' ? "now() - interval '30 days'" : period==='all' ? null : "now() - interval '7 days'";
  const dateFilter = since ? `AND created_at >= ${since}` : '';
  const agg=(await pool.query(
    `SELECT count(*)::int orders,
            count(*) FILTER (WHERE status='completed')::int sales,
            coalesce(sum(CASE WHEN status='completed' THEN total_amount ELSE 0 END),0)::text revenue
     FROM orders WHERE vendor_id=$1 ${dateFilter}`,
    [req.user.sub]
  )).rows[0];
  const topProducts=(await pool.query(
    `SELECT p.id,p.name,sum(oi.quantity)::int sales,sum(oi.total_price)::text revenue
     FROM order_items oi
     JOIN orders o ON o.id=oi.order_id
     JOIN products p ON p.id=oi.product_id
     WHERE o.vendor_id=$1 AND o.status='completed' ${dateFilter.replace('created_at','o.created_at')}
     GROUP BY p.id,p.name ORDER BY sales DESC LIMIT 5`,
    [req.user.sub]
  )).rows.map((r,i)=>({...r,rank:i+1}));
  const average_order_value = agg.sales>0 ? Math.round(Number(agg.revenue)/agg.sales).toString() : '0';
  ok(res,{metrics:{...agg,average_order_value},top_products:topProducts});
}));

// ---------- Transporter ----------
r.get('/transporter/dashboard', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const q=await pool.query(`SELECT (SELECT count(*) FROM shipments WHERE transporter_id=$1 AND status NOT IN ('delivered','cancelled'))::int active_missions,(SELECT count(*) FROM shipments WHERE transporter_id=$1)::int total_missions`,[req.user.sub]);ok(res,q.rows[0])}));
// V54: was `WHERE s.transporter_id=$1 OR (s.transporter_id IS NULL AND
// s.status='pending')` — the open-pool model. Replaced by real sequential
// dispatch (see services/missionDispatch.js): a transporter now only sees
// their own missions plus whichever single offer is currently proposed to
// them specifically, with its expiry so the client can render the 5-minute
// countdown ("Mission disponible — 04:59 restantes").
r.get('/transporter/missions', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT s.*,o.status order_status,o.total_amount,o.shipping_fee,o.delivery_address_id,v.shop_name pickup_shop_name,v.city pickup_city FROM shipments s JOIN orders o ON o.id=s.order_id JOIN vendors v ON v.id=o.vendor_id WHERE s.transporter_id=$1 OR s.offered_to=$1 ORDER BY s.created_at DESC LIMIT 100`,[req.user.sub])).rows)));
r.get('/transporter/missions/:id', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const row=(await pool.query(`SELECT s.*,o.status order_status,o.buyer_id,o.vendor_id,o.total_amount,o.shipping_fee,o.delivery_address_id,
  v.shop_name pickup_shop_name,v.address pickup_address,v.city pickup_city,v.phone pickup_phone,
  a.address_line delivery_address_line,a.city delivery_city,a.neighborhood delivery_neighborhood,a.landmark_type delivery_landmark_type,a.landmark_description delivery_landmark_description,a.recipient_name delivery_recipient_name,a.phone delivery_phone
  FROM shipments s JOIN orders o ON o.id=s.order_id JOIN vendors v ON v.id=o.vendor_id LEFT JOIN user_addresses a ON a.id=o.delivery_address_id
  WHERE s.id=$1 AND (s.transporter_id=$2 OR s.offered_to=$2)`,[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Mission introuvable');ok(res,row)}));
r.post('/transporter/missions/:id/accept', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{
 const result=await tx(async c=>{
  // V54: was an open-pool claim (transporter_id IS NULL AND status='pending'
  // -> anyone could accept). Now only the transporter the mission is
  // CURRENTLY offered to, within the 5-minute window, can accept it — see
  // services/missionDispatch.js. Re-accepting a mission already assigned to
  // this same transporter stays a harmless idempotent no-op.
  let row;
  try {
    row=(await c.query("UPDATE shipments SET status='assigned',transporter_id=$2,offered_to=NULL,offer_expires_at=NULL WHERE id=$1 AND ((offered_to=$2 AND transporter_id IS NULL AND (offer_expires_at IS NULL OR offer_expires_at>now())) OR (transporter_id=$2 AND status IN ('assigned','pending'))) RETURNING *",[req.params.id,req.user.sub])).rows[0];
  } catch(e){
    // V56 (§28 prompt maître) : shipments_transporter_single_active_mission
    // (migration 042) — ce transporteur avait déjà une autre mission active
    // au moment précis de cet accept (offert deux fois par une course de
    // dispatch, voir le commentaire de la migration). Erreur métier
    // explicite plutôt qu'un 500 générique.
    if(e?.code==='23505') throw new HttpError(409,'Vous avez déjà une mission active en cours','TRANSPORTER_ALREADY_HAS_ACTIVE_MISSION');
    throw e;
  }
  if(!row)throw new HttpError(409,'Mission non acceptée (déjà attribuée, offre expirée, ou non proposée à ce compte)');
  await c.query("UPDATE shipment_offers SET status='accepted',responded_at=now() WHERE shipment_id=$1 AND transporter_id=$2 AND status='pending'",[req.params.id,req.user.sub]);
  // Generate (or, if already present and still valid, simply reuse) the
  // seller_pickup and buyer_delivery proofs for this shipment now that a
  // transporter is attached to it — see RAPPORT_AUDIT_QR_PIN.md, point L.1:
  // this was the missing trigger that left createProofs() unreachable and
  // every pickup/delivery verification permanently failing with PROOF_NOT_FOUND.
  const {createProofs}=await import('../services/deliveryProof.js');
  await createProofs(c,row.id);
  return row;
 });
 ok(res,result);
}));
r.post('/transporter/missions/:id/reject', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{
 const result=await tx(async c=>{
  // V54: covers both "refuse an active 5-minute offer" and "back out after
  // already accepting" — either way, the mission goes back into dispatch
  // for the next nearest transporter instead of being stranded (see
  // services/missionDispatch.js). Marking this transporter's own offer row
  // 'refused' keeps them excluded from being re-offered the same shipment.
  const offered=(await c.query("UPDATE shipments SET offered_to=NULL,offer_expires_at=NULL WHERE id=$1 AND offered_to=$2 AND transporter_id IS NULL RETURNING id",[req.params.id,req.user.sub])).rows[0];
  const assigned=offered?null:(await c.query("UPDATE shipments SET transporter_id=NULL,status='pending' WHERE id=$1 AND transporter_id=$2 AND status='assigned' RETURNING id",[req.params.id,req.user.sub])).rows[0];
  if(!offered&&!assigned)throw new HttpError(409,'Mission non rejetable');
  await c.query("UPDATE shipment_offers SET status='refused',responded_at=now() WHERE shipment_id=$1 AND transporter_id=$2 AND status IN ('pending','accepted')",[req.params.id,req.user.sub]);
  const dispatch=await dispatchNextOffer(c,req.params.id);
  return {rejected:true,dispatch};
 });
 ok(res,result);
}));
// V49 (RAPPORT_AUDIT_PARTIE5.md): this used to reshape req.body to
// {credential,...} and issue an HTTP 307 redirect. A 307 tells the CLIENT
// to resend ITS OWN original request body ({pin:...} or {qr_token:...}) to
// the new URL — the reshaped object above never reached the target route,
// so /pickup-proof/verify always received a body with no `credential` key
// and rejected it. This could never succeed. Calling verifyPickupProof()
// directly runs the exact same SQL/transaction/authorization logic without
// depending on the mobile HTTP client's redirect-following behavior.
// SESSION 26 (audit croisé frontend+backend simultané, §30/§52 prompt maître) :
// ces deux routes sont le vrai chemin de vérification PIN/QR utilisé par
// l'app (routes/delivery.js expose un doublon fonctionnel de la même
// logique, jamais appelé par le frontend — vérifié par recherche
// exhaustive — mais lui avait déjà `proofLimiter`, 20 tentatives/10min).
// Sans lui ici, sur le vrai chemin atteignable, rien ne limitait le nombre
// de PIN devinés contre la commande d'un acheteur. Ajouté.
r.post('/transporter/missions/:id/pickup', requireAuth, requireRoles('transporter'), proofLimiter, asyncHandler(async(req,res)=>{const credential=req.body?.qr_token||req.body?.pin;if(!credential)throw new HttpError(422,'QR/PIN requis');const result=await verifyPickupProof(req.params.id,{credential,latitude:req.body?.latitude,longitude:req.body?.longitude,actorRole:req.user.role,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});ok(res,result)}));
r.post('/transporter/missions/:id/arrive', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const b=req.body||{};
  // V-AUDIT (SESSION 26, §29) : ce doublet UPDATE+INSERT était resté en
  // deux pool.query() séparés — exactement l'anti-motif déjà corrigé un peu
  // plus bas dans ce même fichier pour /transporter/location (voir le
  // commentaire "section 29" ci-dessous), mais cette occurrence-ci n'avait
  // pas été rattrapée à l'époque. Même traitement : une seule transaction.
  const row=await tx(async c=>{
    const r=(await c.query("UPDATE shipments SET status='arrived' WHERE id=$1 AND transporter_id=$2 AND status='in_transit' RETURNING *",[req.params.id,req.user.sub])).rows[0];
    if(!r)throw new HttpError(409,'Arrivée impossible');
    await c.query('INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by) VALUES($1,\'arrived\',$2,$3,\'Transporteur arrivé\',$4)',[req.params.id,b.latitude??null,b.longitude??null,req.user.sub]);
    return r;
  });
  ok(res,row)}));
// V49: was a same-process loopback fetch() to this server's own public URL
// (req.protocol + req.get('host')) — worked, but added a needless network
// hop, a host/protocol assumption, and no timeout of its own. Direct call.
r.post('/transporter/missions/:id/deliver', requireAuth, requireRoles('transporter'), proofLimiter, asyncHandler(async(req,res)=>{const credential=req.body?.qr_token||req.body?.pin;if(!credential)throw new HttpError(422,'QR/PIN requis');const result=await verifyDeliveryProof(req.params.id,{credential,latitude:req.body?.latitude,longitude:req.body?.longitude,actorRole:req.user.role,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});ok(res,result)}));
r.post('/transporter/location', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const b=z.object({lat:z.number(),lng:z.number(),accuracy:z.number().optional()}).parse(req.body);
  // V-AUDIT (section 29): position UPDATE + shipment lookup + event INSERT
  // used to be three separate pool.query() calls — a transient failure
  // between any two left the transporter's position updated with no
  // matching shipment_events row, and no way to tell that happened after
  // the fact. Now one transaction: all three succeed together or none do.
  const shipmentId = await tx(async c => {
    await c.query('UPDATE transporters SET current_latitude=$1,current_longitude=$2,location_updated_at=now() WHERE id=$3',[b.lat,b.lng,req.user.sub]);
    const s=(await c.query("SELECT id FROM shipments WHERE transporter_id=$1 AND status IN ('assigned','picked_up','in_transit','arrived') ORDER BY created_at DESC LIMIT 1",[req.user.sub])).rows[0];
    if(s) await c.query('INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by) VALUES($1,\'location\',$2,$3,$4,$5)',[s.id,b.lat,b.lng,`accuracy=${b.accuracy??''}`,req.user.sub]);
    return s?.id||null;
  });
  ok(res,{recorded:true,shipment_id:shipmentId})}));
r.patch('/transporter/availability', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const b=z.object({status:z.enum(['online','offline','busy'])}).parse(req.body);const row=(await pool.query('UPDATE transporters SET availability=$1 WHERE id=$2 RETURNING *',[b.status,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Profil transporteur introuvable');ok(res,row)}));
// V54: there was no way for a transporter to read their own availability/
// vehicle_type/vehicle_plate/kyc_status — only PATCH .../availability
// existed (write-only). Needed by the dashboard (availability), the new
// Vehicle screen and TransporterKYCScreen. Mirrors GET/PATCH /vendor/shop
// immediately above: same dynamic-SET-list pattern, same table-scoped
// ownership (WHERE id=$user).
r.get('/transporter/profile', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const row=(await pool.query('SELECT id,availability,kyc_status,vehicle_type,vehicle_plate,certified_at,created_at FROM transporters WHERE id=$1',[req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Profil transporteur introuvable');ok(res,row)}));
r.patch('/transporter/profile', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const b=z.object({vehicle_type:z.string().max(80).optional(),vehicle_plate:z.string().max(40).optional()}).parse(req.body);const sets=[];const vals=[];for(const [k,v] of Object.entries(b)){sets.push(`${k}=$${vals.length+1}`);vals.push(v)}if(!sets.length)return ok(res,(await pool.query('SELECT id,availability,kyc_status,vehicle_type,vehicle_plate,certified_at,created_at FROM transporters WHERE id=$1',[req.user.sub])).rows[0]);const row=(await pool.query(`UPDATE transporters SET ${sets.join(',')} WHERE id=$${vals.length+1} RETURNING id,availability,kyc_status,vehicle_type,vehicle_plate,certified_at,created_at`,[...vals,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Profil transporteur introuvable');ok(res,row)}));
r.get('/transporter/earnings', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{
  const agg=(await pool.query("SELECT coalesce(sum(amount),0)::text gross_payable_xof,count(*)::int payout_count FROM payout_requests WHERE user_id=$1 AND status='paid'",[req.user.sub])).rows[0];
  // V-AUDIT (section 47/49): the frontend (EarningsScreen.tsx) already
  // rendered a "Détail" list assuming an itemized breakdown existed
  // (data?.items ?? data?.transactions ?? data?.earnings) — this response
  // never provided one, so that list was always empty regardless of real
  // activity. Added directly from the same table the aggregate above
  // already sums, rather than leaving the UI's own assumption unmet.
  const payouts=(await pool.query("SELECT id,reference,amount,currency,status,paid_at,created_at FROM payout_requests WHERE user_id=$1 AND status='paid' ORDER BY paid_at DESC NULLS LAST LIMIT 50",[req.user.sub])).rows;
  ok(res,{...agg,payouts});
}));
r.get('/transporter/wallet', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const {payableBalance}=await import('../services/wallet.js');const bal=await payableBalance(pool,'transporter',req.user.sub);ok(res,{currency:'XOF',available_amount:bal.available.toString(),locked_amount:bal.reserved.toString(),owed_total:bal.owed.toString()})}));
r.get('/transporter/history', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM shipments WHERE transporter_id=$1 ORDER BY created_at DESC LIMIT 100',[req.user.sub])).rows)));
// V49: same loopback-fetch pattern as .../deliver above; same fix.
r.post('/transporter/qr/scan', requireAuth, requireRoles('transporter'), asyncHandler(async(req,res)=>{const b=z.object({qr_code:z.string().min(4)}).parse(req.body);ok(res,await resolveProof(b.qr_code,{actorRole:req.user.role,actorId:req.user.sub}))}));

// ---------- Wallet compatibility ----------
// V48: removed (dead code, zero frontend callers). Real balance/transactions
// come from GET /escrow/balance and GET /escrow/transactions(/:id); real
// withdrawals come from POST /payouts. This block duplicated all of it
// under a different name — GET /wallet/transactions even queried a
// different, less complete source (ledger_transactions by metadata->>'user_id'
// rather than the escrow-position calculation escrow.js uses) and
// POST /wallet/withdraw was a permanent 501 stub.

// ---------- Product variants ----------
r.get('/vendor/products/:id/variants', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM product_variants WHERE product_id=$1 AND EXISTS (SELECT 1 FROM products p WHERE p.id=product_variants.product_id AND p.vendor_id=$2) ORDER BY created_at',[req.params.id,req.user.sub])).rows)));
r.post('/vendor/products/:id/variants', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const b=z.object({sku:z.string().max(100).optional(),attributes:z.record(z.any()).default({}),price_xof:z.number().int().positive().optional(),stock_qty:z.number().int().nonnegative().default(0),status:z.enum(['active','paused','archived']).default('active')}).parse(req.body);const p=(await pool.query('SELECT id FROM products WHERE id=$1 AND vendor_id=$2',[req.params.id,req.user.sub])).rows[0];if(!p)throw new HttpError(404,'Produit introuvable');
  // V-AUDIT (même classe de bug que sections 12/18 — conflit d'unicité non
  // géré) : product_variants a un index UNIQUE(product_id, sku) (migration
  // 033) sans aucune gestion de conflit ici ; un SKU dupliqué pour le même
  // produit déclenchait une violation Postgres brute (500 générique) au
  // lieu d'une erreur explicite.
  let row;
  try {
    row=(await pool.query('INSERT INTO product_variants(product_id,sku,attributes,price_xof,stock_qty,status) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[p.id,b.sku||null,b.attributes,b.price_xof??null,b.stock_qty,b.status])).rows[0];
  } catch(e) {
    if(e.code==='23505') throw new HttpError(409,'Ce SKU existe déjà pour ce produit.','VARIANT_SKU_ALREADY_EXISTS');
    throw e;
  }
  ok(res,row,201)}));
r.put('/vendor/products/:id/variants/:variantId', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const b=z.object({sku:z.string().max(100).optional(),attributes:z.record(z.any()).optional(),price_xof:z.number().int().positive().nullable().optional(),stock_qty:z.number().int().nonnegative().optional(),status:z.enum(['active','paused','archived']).optional()}).parse(req.body);
  let row;
  try {
    row=(await pool.query('UPDATE product_variants v SET sku=coalesce($1,v.sku),attributes=coalesce($2,v.attributes),price_xof=coalesce($3,v.price_xof),stock_qty=coalesce($4,v.stock_qty),status=coalesce($5,v.status),updated_at=now() FROM products p WHERE v.id=$6 AND v.product_id=p.id AND p.vendor_id=$7 RETURNING v.*',[b.sku??null,b.attributes??null,b.price_xof,b.stock_qty??null,b.status??null,req.params.variantId,req.user.sub])).rows[0];
  } catch(e) {
    if(e.code==='23505') throw new HttpError(409,'Ce SKU existe déjà pour ce produit.','VARIANT_SKU_ALREADY_EXISTS');
    throw e;
  }
  if(!row)throw new HttpError(404,'Variante introuvable');ok(res,row)}));
r.delete('/vendor/products/:id/variants/:variantId', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query("UPDATE product_variants v SET status='archived',updated_at=now() FROM products p WHERE v.id=$1 AND v.product_id=p.id AND p.vendor_id=$2 RETURNING v.id,v.status",[req.params.variantId,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Variante introuvable');ok(res,row)}));

// ---------- Product media ----------
r.get('/vendor/products/:id/media', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT id,product_id,kind,sort_order,alt_text,created_at,'/api/v1/products/'||product_id||'/media/'||id media_url FROM product_media WHERE product_id=$1 AND EXISTS (SELECT 1 FROM products p WHERE p.id=product_media.product_id AND p.vendor_id=$2) ORDER BY sort_order,created_at`,[req.params.id,req.user.sub])).rows)));
r.post('/vendor/products/:id/media', requireAuth, requireRoles('vendor'), mediaUpload.single('media'), asyncHandler(async(req,res)=>{ if(!req.file) throw new HttpError(422,'Image JPG/PNG/WebP requise'); const p=(await pool.query('SELECT id FROM products WHERE id=$1 AND vendor_id=$2',[req.params.id,req.user.sub])).rows[0]; if(!p)throw new HttpError(404,'Produit introuvable'); const count=(await pool.query('SELECT count(*)::int n FROM product_media WHERE product_id=$1',[p.id])).rows[0].n; const row=(await pool.query(`INSERT INTO product_media(product_id,file_key,kind,sort_order,alt_text) VALUES($1,$2,'image',$3,$4) RETURNING id,product_id,kind,sort_order,alt_text,created_at`,[p.id,path.basename(req.file.path),count,req.body?.alt_text||null])).rows[0]; ok(res,{...row,media_url:`/api/v1/products/${p.id}/media/${row.id}`},201); }));
r.delete('/vendor/products/:id/media/:mediaId', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query('DELETE FROM product_media pm USING products p WHERE pm.id=$1 AND pm.product_id=p.id AND p.id=$2 AND p.vendor_id=$3 RETURNING pm.id,pm.file_key',[req.params.mediaId,req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Média introuvable');try{fs.unlinkSync(path.resolve(process.cwd(),'uploads',path.basename(row.file_key)));}catch{} ok(res,null,204);}));
r.get('/products/:productId/media/:mediaId', asyncHandler(async(req,res)=>{const row=(await pool.query(`SELECT pm.file_key FROM product_media pm JOIN products p ON p.id=pm.product_id WHERE pm.id=$1 AND pm.product_id=$2 AND p.status='active'`,[req.params.mediaId,req.params.productId])).rows[0];if(!row)throw new HttpError(404,'Média introuvable');res.sendFile(path.resolve(process.cwd(),'uploads',path.basename(row.file_key)));}));

// ---------- Social ----------
// V48: every field FeedItem (features/social/socialApi.ts) reads was either
// named differently here or missing outright — kind/caption/media_url vs
// type/description/video_url, author_id/author_name vs vendor_id/vendor_name,
// like_count/comment_count vs likes_count/comments_count (singular vs
// plural), and product_name/product_price/liked/following/shares_count
// didn't exist at all. FeedScreen.tsx's fallbacks kept it from crashing, but
// every card rendered as a generic, imageless, zero-engagement placeholder
// regardless of the real content. Aliased to the real contract and added
// the missing joins/subqueries; media_url is exposed as video_url for video
// posts and thumbnail_url otherwise, since the schema only stores one URL
// per post (a real per-video thumbnail would need its own column).
r.get('/feed', requireAuth, asyncHandler(async(req,res)=>{const limit=Math.min(Math.max(parseInt(req.query.limit,10)||50,1),100);ok(res,(await pool.query(`SELECT p.id,p.kind type,p.caption description,CASE WHEN p.kind='video' THEN p.media_url END video_url,CASE WHEN p.kind!='video' THEN p.media_url END thumbnail_url,p.author_id vendor_id,u.name vendor_name,p.product_id,pr.name product_name,pr.price_xof product_price,p.created_at,(SELECT count(*) FROM social_likes l WHERE l.post_id=p.id)::int likes_count,(SELECT count(*) FROM social_comments c WHERE c.post_id=p.id)::int comments_count,(SELECT count(*) FROM social_shares sh WHERE sh.post_id=p.id)::int shares_count,EXISTS(SELECT 1 FROM social_likes l2 WHERE l2.post_id=p.id AND l2.user_id=$1) liked,EXISTS(SELECT 1 FROM social_follows f WHERE f.follower_id=$1 AND f.following_id=p.author_id) following FROM social_posts p JOIN users u ON u.id=p.author_id LEFT JOIN products pr ON pr.id=p.product_id ORDER BY p.created_at DESC LIMIT ${limit}`,[req.user.sub])).rows)}));
r.post('/social/:postId/like', requireAuth, asyncHandler(async(req,res)=>{await pool.query('INSERT INTO social_likes(post_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.params.postId,req.user.sub]);ok(res,{liked:true})}));
r.delete('/social/:postId/like', requireAuth, asyncHandler(async(req,res)=>{await pool.query('DELETE FROM social_likes WHERE post_id=$1 AND user_id=$2',[req.params.postId,req.user.sub]);ok(res,{liked:false})}));
r.get('/social/:postId/comments', requireAuth, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT c.*,u.name author_name FROM social_comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=$1 ORDER BY c.created_at ASC',[req.params.postId])).rows)));
r.post('/social/:postId/comments', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({body:z.string().min(1).max(2000),text:z.string().min(1).max(2000).optional()}).parse(req.body);const body=b.body||b.text;const row=(await pool.query('INSERT INTO social_comments(post_id,user_id,body) VALUES($1,$2,$3) RETURNING *',[req.params.postId,req.user.sub,body])).rows[0];ok(res,row,201)}));
r.post('/social/vendors/:id/follow', requireAuth, asyncHandler(async(req,res)=>{await pool.query('INSERT INTO social_follows(follower_id,following_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[req.user.sub,req.params.id]);ok(res,{following:true})}));
r.delete('/social/vendors/:id/follow', requireAuth, asyncHandler(async(req,res)=>{await pool.query('DELETE FROM social_follows WHERE follower_id=$1 AND following_id=$2',[req.user.sub,req.params.id]);ok(res,{following:false})}));
r.post('/social/:postId/share', requireAuth, asyncHandler(async(req,res)=>{const row=(await pool.query('INSERT INTO social_shares(post_id,user_id) VALUES($1,$2) RETURNING *',[req.params.postId,req.user.sub])).rows[0];ok(res,row,201)}));

// ---------- Dispute detail / conversation compatibility ----------
// V48: two bugs. (1) This response never included a `messages` field —
// DisputeDetailsScreen.tsx always read dispute.messages, so "Échanges" was
// permanently empty even after replies were sent and saved successfully.
// Messages live in the same conversations/messages tables chat.js uses;
// scoped here to created_at >= the dispute's own created_at so a
// pre-existing general chat thread between the two parties doesn't bleed
// into the dispute view. (2) POST .../messages authorized `opened_by=$2`
// only — whichever party did NOT open the dispute got a 403 on every reply,
// so a dispute opened by a buyer could never receive a vendor reply (or
// vice versa). Both routes now check opened_by/buyer_id/vendor_id alike.
r.get('/disputes/:id', requireAuth, asyncHandler(async(req,res)=>{const row=(await pool.query('SELECT d.*,o.buyer_id,o.vendor_id FROM disputes d JOIN orders o ON o.id=d.order_id WHERE d.id=$1 AND (d.opened_by=$2 OR o.buyer_id=$2 OR o.vendor_id=$2)',[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Litige introuvable');const convo=(await pool.query(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=$1 JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=$2 WHERE (SELECT count(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1`,[row.buyer_id,row.vendor_id])).rows[0];const messages=convo?(await pool.query('SELECT id,sender_id,content,created_at FROM messages WHERE conversation_id=$1 AND created_at>=$2 ORDER BY created_at ASC',[convo.id,row.created_at])).rows:[];ok(res,{...row,messages})}));
r.post('/disputes/:id/messages', requireAuth, asyncHandler(async(req,res)=>{const b=z.object({content:z.string().min(1).max(2000),text:z.string().optional()}).parse(req.body);const d=(await pool.query('SELECT d.order_id,o.buyer_id,o.vendor_id FROM disputes d JOIN orders o ON o.id=d.order_id WHERE d.id=$1 AND (d.opened_by=$2 OR o.buyer_id=$2 OR o.vendor_id=$2)',[req.params.id,req.user.sub])).rows[0];if(!d)throw new HttpError(403,'Litige non autorisé');const other=d.buyer_id===req.user.sub?d.vendor_id:d.buyer_id;const existing=(await pool.query(`SELECT c.id FROM conversations c JOIN conversation_members a ON a.conversation_id=c.id AND a.user_id=$1 JOIN conversation_members b ON b.conversation_id=c.id AND b.user_id=$2 WHERE (SELECT count(*) FROM conversation_members x WHERE x.conversation_id=c.id)=2 LIMIT 1`,[req.user.sub,other])).rows[0];let cid=existing?.id;if(!cid){cid=(await pool.query('INSERT INTO conversations DEFAULT VALUES RETURNING id')).rows[0].id;await pool.query('INSERT INTO conversation_members(conversation_id,user_id) VALUES($1,$2),($1,$3)',[cid,req.user.sub,other])}const row=(await pool.query('INSERT INTO messages(conversation_id,sender_id,content) VALUES($1,$2,$3) RETURNING *',[cid,req.user.sub,b.content||b.text])).rows[0];ok(res,row,201)}));

// ---------- Admin UI compatibility ----------
const adminGuard=[requireAuth,requireRoles('admin')];
r.get('/admin/sellers', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT u.id,u.phone,u.name,u.status,u.created_at,v.shop_name,v.kyc_status FROM users u JOIN vendors v ON v.id=u.id WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='vendor') ORDER BY u.created_at DESC LIMIT 100")).rows)));
r.get('/admin/transporters', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT u.id,u.phone,u.name,u.status,u.created_at,t.availability,t.kyc_status,t.vehicle_type,t.vehicle_plate FROM users u JOIN transporters t ON t.id=u.id WHERE EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='transporter') ORDER BY u.created_at DESC LIMIT 100")).rows)));
r.get('/admin/orders', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/payments', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM escrow_transactions ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/escrow', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM escrow_transactions ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/withdrawals', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM payout_requests ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/disputes', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM disputes ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/verifications', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM kyc_documents ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/products', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM products ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/missions', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM shipments ORDER BY created_at DESC LIMIT 100')).rows)));
r.get('/admin/logs', ...adminGuard, asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')).rows)));

// ---------- Video / Live internal implementation ----------
r.get('/live/active', requireAuth, asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT l.*,v.shop_name vendor_name FROM live_shops l JOIN vendors v ON v.id=l.vendor_id WHERE l.status='live' ORDER BY l.started_at DESC LIMIT 50")).rows)));
r.get('/live/:id', requireAuth, asyncHandler(async(req,res)=>{const row=(await pool.query("SELECT l.*,v.shop_name vendor_name FROM live_shops l JOIN vendors v ON v.id=l.vendor_id WHERE l.id=$1",[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Live introuvable');ok(res,row)}));
r.get('/vendor/videos', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT id,title,description,status,'/api/v1/videos/'||id video_url,thumbnail_url,views,likes,created_at FROM vendor_videos WHERE vendor_id=$1 ORDER BY created_at DESC",[req.user.sub])).rows)));
r.post('/vendor/videos', requireAuth, requireRoles('vendor'), upload.single('video'), asyncHandler(async(req,res)=>{
  if(!req.file)throw new HttpError(422,'Fichier vidéo requis');
  // V54: file_key used to store req.file.path directly — the server's own
  // disk path (e.g. /home/.../uploads/xyz), not a URL a client can ever
  // fetch. product_media already gets this right (path.basename() + a real
  // /api/v1/... route, see GET /videos/:videoId below) — mirrored here.
  const fileKey=path.basename(req.file.path);
  const row=await tx(async c=>{
    const video=(await c.query('INSERT INTO vendor_videos(vendor_id,title,description,file_key) VALUES($1,$2,$3,$4) RETURNING id,title,description,status,views,likes,created_at',[req.user.sub,req.body?.title||null,req.body?.description||null,fileKey])).rows[0];
    const videoUrl=`/api/v1/videos/${video.id}`;
    await c.query("INSERT INTO social_posts(author_id,kind,media_url,caption) VALUES($1,'video',$2,$3)",[req.user.sub,videoUrl,req.body?.description||req.body?.title||null]);
    return {...video,video_url:videoUrl};
  });
  ok(res,row,201);
}));
// V54: was missing entirely — nothing streamed a vendor video's actual file
// content to a client, mirroring GET /products/:productId/media/:mediaId.
r.get('/videos/:videoId', asyncHandler(async(req,res)=>{const row=(await pool.query("SELECT file_key FROM vendor_videos WHERE id=$1 AND status<>'deleted'",[req.params.videoId])).rows[0];if(!row)throw new HttpError(404,'Vidéo introuvable');res.sendFile(path.resolve(process.cwd(),'uploads',path.basename(row.file_key)));}));
r.delete('/vendor/videos/:id', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{
  const row=await tx(async c=>{
    const v=(await c.query("UPDATE vendor_videos SET status='deleted',updated_at=now() WHERE id=$1 AND vendor_id=$2 RETURNING id,status",[req.params.id,req.user.sub])).rows[0];
    if(v) await c.query("DELETE FROM social_posts WHERE author_id=$1 AND kind='video' AND media_url=$2",[req.user.sub,`/api/v1/videos/${v.id}`]);
    return v;
  });
  if(!row)throw new HttpError(404,'Vidéo introuvable');
  ok(res,{id:row.id,status:row.status});
}));
r.get('/vendor/videos/:id/analytics', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query('SELECT id,views,likes,created_at FROM vendor_videos WHERE id=$1 AND vendor_id=$2',[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Vidéo introuvable');ok(res,row)}));
r.post('/vendor/live/start', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const b=z.object({title:z.string().min(2).max(200),stream_url:z.string().url().optional(),thumbnail_url:z.string().optional()}).parse(req.body);const row=(await pool.query("INSERT INTO live_shops(vendor_id,title,stream_url,thumbnail_url) VALUES($1,$2,$3,$4) RETURNING *",[req.user.sub,b.title,b.stream_url||null,b.thumbnail_url||null])).rows[0];ok(res,row,201)}));
r.post('/vendor/live/:id/end', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>{const row=(await pool.query("UPDATE live_shops SET status='ended',ended_at=now() WHERE id=$1 AND vendor_id=$2 RETURNING *",[req.params.id,req.user.sub])).rows[0];if(!row)throw new HttpError(404,'Live introuvable');ok(res,row)}));
// V48: was `WHERE follower_id=$1` — the vendors *this account* follows.
// CreatorToolsScreen.tsx labels the count "Abonnés" (followers) and wants
// the reverse: who follows this vendor. Flipped to following_id=$1.
r.get('/vendor/subscriptions', requireAuth, requireRoles('vendor'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT follower_id,created_at FROM social_follows WHERE following_id=$1 ORDER BY created_at DESC',[req.user.sub])).rows)));

// ---------- Notifications ----------
r.post('/notifications/read-all', requireAuth, asyncHandler(async(req,res)=>{await pool.query('UPDATE notifications SET read_at=coalesce(read_at,now()) WHERE user_id=$1',[req.user.sub]);ok(res,null,204)}));
r.post('/notifications/push-token', requireAuth, asyncHandler(async(req,res)=>ok(res,{registered:false,external_provider_required:true}))); 
r.delete('/notifications/push-token', requireAuth, asyncHandler(async(req,res)=>ok(res,null,204)));

export default r;
