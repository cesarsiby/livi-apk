import { Router } from 'express'; import { pool } from '../config/db.js'; import { asyncHandler,ok,HttpError } from '../utils/http.js';
import { activeCommissionBps, passthroughPrice } from '../services/orderPricing.js';
const r=Router();
// V54: adds display_price_xof next to the existing price_xof (left
// untouched — it's the vendor's own base price, still needed for the
// product editor and for vendor-side displays). display_price_xof is what
// a buyer actually pays, matching exactly what POST /orders will charge
// (see services/orderPricing.js) — computed once per request rather than
// per row, since it only depends on each product's vendor.
async function withDisplayPrice(rows) {
  const bps = await activeCommissionBps(pool);
  const passthroughByVendor = new Map();
  const vendorIds = [...new Set(rows.map(p=>p.vendor_id))];
  if (vendorIds.length) {
    const { rows: vrows } = await pool.query('SELECT id,commission_passthrough FROM vendors WHERE id=ANY($1)',[vendorIds]);
    for (const v of vrows) passthroughByVendor.set(v.id, v.commission_passthrough);
  }
  return rows.map(p => ({
    ...p,
    display_price_xof: passthroughByVendor.get(p.vendor_id) ? passthroughPrice(p.price_xof, bps) : Number(p.price_xof),
  }));
}
r.get('/',asyncHandler(async(req,res)=>{const limit=Math.min(Number(req.query.limit)||24,100);const q=String(req.query.q||'');const {rows}=await pool.query(`SELECT p.id,p.vendor_id,p.name,p.slug,p.description,p.price_xof,p.stock,p.status,p.category_id,coalesce((SELECT json_agg('/api/v1/products/'||p.id||'/media/'||pm.id ORDER BY pm.sort_order) FROM product_media pm WHERE pm.product_id=p.id AND pm.kind='image'),'[]'::json) images FROM products p WHERE p.status='active' AND ($1='' OR p.search_vector @@ plainto_tsquery('simple',$1)) ORDER BY p.created_at DESC LIMIT $2`,[q,limit]);ok(res,await withDisplayPrice(rows));}));
r.get('/:id',asyncHandler(async(req,res)=>{const {rows}=await pool.query("SELECT p.id,p.vendor_id,p.name,p.slug,p.description,p.price_xof,p.stock,p.status,p.category_id,coalesce((SELECT json_agg('/api/v1/products/'||p.id||'/media/'||pm.id ORDER BY pm.sort_order) FROM product_media pm WHERE pm.product_id=p.id AND pm.kind='image'),'[]'::json) images FROM products p WHERE p.id=$1 AND p.status='active'",[req.params.id]);if(!rows[0])throw new HttpError(404,'Produit introuvable');ok(res,(await withDisplayPrice(rows))[0]);}));
// V54 (RAPPORT — "VARIANTES PRODUITS"): the only variants route was
// vendor-only + ownership-checked (/vendor/products/:id/variants) — a buyer
// browsing the catalogue had no way to see what variants exist for a
// product before this.
r.get('/:id/variants',asyncHandler(async(req,res)=>{
  const rows=(await pool.query("SELECT v.id,v.sku,v.attributes,v.price_xof,v.stock_qty,p.price_xof base_price_xof,p.vendor_id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=$1 AND v.status='active' ORDER BY v.created_at",[req.params.id])).rows;
  if(!rows.length) return ok(res,[]);
  const bps=await activeCommissionBps(pool);
  const vendorIds=[...new Set(rows.map(r=>r.vendor_id))];
  const {rows:vrows}=await pool.query('SELECT id,commission_passthrough FROM vendors WHERE id=ANY($1)',[vendorIds]);
  const passthroughByVendor=new Map(vrows.map(v=>[v.id,v.commission_passthrough]));
  ok(res,rows.map(v=>{
    const base=v.price_xof??v.base_price_xof;
    return {id:v.id,sku:v.sku,attributes:v.attributes,price_xof:v.price_xof,stock_qty:v.stock_qty,display_price_xof:passthroughByVendor.get(v.vendor_id)?passthroughPrice(base,bps):Number(base)};
  }));
}));
export default r;
