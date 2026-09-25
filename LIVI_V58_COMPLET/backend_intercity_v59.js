import { Router } from 'express';
import { z } from 'zod';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok, HttpError } from '../utils/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { assertPerishableCompatible } from '../services/logisticsTiming.js';
import { ACCOUNT, accountId, postBalanced, newReference } from '../services/market.js';

const r = Router();
r.use(requireAuth);
const city=z.string().trim().min(2).max(100);
const itemSchema=z.object({product_id:z.string().uuid(),quantity:z.number().int().positive()});

async function buildOptions(db,{origin,destination}){
  return (await db.query(`
    SELECT r.id route_id,r.partner_id,p.name partner_name,r.origin_city,r.destination_city,
           r.fee_xof,r.minimum_transport_fee_xof,r.fuel_cost_xof,r.operating_charges_xof,r.partner_service_fee_xof,r.transit_min_hours,r.transit_max_hours,
           coalesce((SELECT json_agg(json_build_object('id',l.id,'name',l.name,'code',l.code,'address_line',l.address_line,'city',l.city) ORDER BY l.name)
                     FROM partner_locations l WHERE l.partner_id=r.partner_id AND lower(l.city)=lower(r.destination_city)
                       AND l.status='active' AND l.location_type IN ('pickup','both')),'[]'::json) destination_locations
    FROM intercity_routes r JOIN partners p ON p.id=r.partner_id
    WHERE lower(r.origin_city)=lower($1) AND lower(r.destination_city)=lower($2)
      AND r.status='active' AND p.kind='logistics' AND p.status='active'
    ORDER BY p.name`,[origin,destination])).rows;
}

// Buyer checkout: derive origin from the first cart product's seller and
// destination from the selected buyer address. No fee/delay value is invented.
r.post('/intercity/options', asyncHandler(async(req,res)=>{
  const b=z.object({items:z.array(itemSchema).min(1),delivery_address_id:z.string().uuid()}).parse(req.body);
  const first=(await pool.query(`SELECT v.city origin_city,a.city destination_city
    FROM products p JOIN vendors v ON v.id=p.vendor_id
    JOIN user_addresses a ON a.id=$2
    WHERE p.id=$1 AND p.status='active'`,[b.items[0].product_id,b.delivery_address_id])).rows[0];
  if(!first)throw new HttpError(409,'Produit ou adresse indisponible');
  const options=await buildOptions(pool,{origin:first.origin_city,destination:first.destination_city});
  const productIds=[...new Set(b.items.map(i=>i.product_id))];
  const products=(await pool.query('SELECT id,name,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,shelf_life_reference_type FROM products WHERE id=ANY($1::uuid[])',[productIds])).rows;
  const preparationHours=Math.max(...products.map(p=>Number(p.preparation_time_hours||0)),0);
  ok(res,options.map(o=>{const conflicts=[]; for(const p of products){try{assertPerishableCompatible(p,preparationHours,Number(o.transit_max_hours)*60);}catch(e){if(e?.code==='PERISHABLE_SHELF_LIFE_INSUFFICIENT'||e?.code==='PERISHABLE_SHELF_LIFE_METADATA_REQUIRED') conflicts.push({id:p.id,name:p.name,reason:e.code});}} return {...o,preparation_time_hours:preparationHours,perishable_conflicts:conflicts};}));
}));

r.get('/intercity/options', asyncHandler(async(req,res)=>{
  const origin=city.parse(req.query.origin_city); const destination=city.parse(req.query.destination_city);
  ok(res,await buildOptions(pool,{origin,destination}));
}));

r.get('/intercity/partners/:id/locations', asyncHandler(async(req,res)=>{
  ok(res,(await pool.query(`SELECT id,partner_id,location_type,name,code,address_line,city,region,latitude,longitude
    FROM partner_locations WHERE partner_id=$1 AND status='active' ORDER BY city,name`,[req.params.id])).rows);
}));

// Pre-commit validation: partner route + destination pickup point + perishability.
r.post('/intercity/validate', asyncHandler(async(req,res)=>{
  const b=z.object({items:z.array(itemSchema).min(1),delivery_address_id:z.string().uuid(),partner_id:z.string().uuid(),destination_location_id:z.string().uuid(),route_id:z.string().uuid().optional()}).parse(req.body);
  const first=(await pool.query(`SELECT v.city origin_city,a.city destination_city
    FROM products p JOIN vendors v ON v.id=p.vendor_id JOIN user_addresses a ON a.id=$2
    WHERE p.id=$1 AND p.status='active'`,[b.items[0].product_id,b.delivery_address_id])).rows[0];
  if(!first)throw new HttpError(409,'Produit ou adresse indisponible');
  const route=(await pool.query(`SELECT r.*,p.name partner_name FROM intercity_routes r JOIN partners p ON p.id=r.partner_id
    WHERE r.id=coalesce($1,r.id) AND r.partner_id=$2 AND lower(r.origin_city)=lower($3) AND lower(r.destination_city)=lower($4)
      AND r.status='active' AND p.kind='logistics' AND p.status='active' LIMIT 1`,[b.route_id||null,b.partner_id,first.origin_city,first.destination_city])).rows[0];
  if(!route)throw new HttpError(409,'Aucune liaison interville configurée pour ce trajet');
  const location=(await pool.query(`SELECT id FROM partner_locations WHERE id=$1 AND partner_id=$2 AND lower(city)=lower($3)
    AND status='active' AND location_type IN ('pickup','both')`,[b.destination_location_id,b.partner_id,first.destination_city])).rows[0];
  if(!location)throw new HttpError(422,'Point de retrait interville invalide');
  const products=(await pool.query('SELECT id,name,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,shelf_life_reference_type FROM products WHERE id=ANY($1::uuid[])',[b.items.map(i=>i.product_id)])).rows;
  const preparationHours=Math.max(...products.map(p=>Number(p.preparation_time_hours||0)),0);
  const conflicts=[]; for(const p of products){try{assertPerishableCompatible(p,preparationHours,Number(route.transit_max_hours)*60);}catch(e){if(e?.code==='PERISHABLE_SHELF_LIFE_INSUFFICIENT'||e?.code==='PERISHABLE_SHELF_LIFE_METADATA_REQUIRED') conflicts.push({id:p.id,name:p.name,reason:e.code});}}
  ok(res,{valid:conflicts.length===0,preparation_time_hours:preparationHours,route:{id:route.id,partner_id:route.partner_id,partner_name:route.partner_name,fee_xof:Number(route.fee_xof),minimum_transport_fee_xof:Number(route.minimum_transport_fee_xof||1000),fuel_cost_xof:Number(route.fuel_cost_xof||0),operating_charges_xof:Number(route.operating_charges_xof||0),partner_service_fee_xof:Number(route.partner_service_fee_xof||0),transit_min_hours:Number(route.transit_min_hours),transit_max_hours:Number(route.transit_max_hours)},perishable_conflicts:conflicts});
}));

// Admin configuration for companies, depots/pickup points and city-pair routes.
r.post('/intercity/admin/partners', requireRoles('admin'), asyncHandler(async(req,res)=>{
  const b=z.object({code:z.string().min(2).max(50),name:z.string().min(2).max(160),kind:z.literal('logistics').default('logistics')}).parse(req.body);
  try{const row=(await pool.query(`INSERT INTO partners(code,name,kind,status) VALUES($1,$2,'logistics','active') RETURNING *`,[b.code,b.name])).rows[0];ok(res,row,201);}catch(e){if(e?.code==='23505')throw new HttpError(409,'Code partenaire déjà utilisé','PARTNER_CODE_EXISTS');throw e;}
}));
r.get('/intercity/admin/partners', requireRoles('admin'), asyncHandler(async(req,res)=>ok(res,(await pool.query("SELECT * FROM partners WHERE kind='logistics' ORDER BY name")).rows)));
r.patch('/intercity/admin/partners/:id', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({name:z.string().min(2).max(160).optional(),status:z.enum(['pending','active','disabled']).optional()}).parse(req.body);const entries=Object.entries(b);if(!entries.length)return ok(res,(await pool.query('SELECT * FROM partners WHERE id=$1',[req.params.id])).rows[0]);const set=entries.map(([k],i)=>`${k}=$${i+1}`).join(',');const vals=entries.map(([,v])=>v);const row=(await pool.query(`UPDATE partners SET ${set},updated_at=now() WHERE id=$${vals.length+1} AND kind='logistics' RETURNING *`,[...vals,req.params.id])).rows[0];if(!row)throw new HttpError(404,'Partenaire introuvable');ok(res,row);}));
r.post('/intercity/admin/partners/:id/locations', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({location_type:z.enum(['depot','pickup','both']),name:z.string().min(2).max(160),code:z.string().max(80).optional(),address_line:z.string().min(3),city:city,region:z.string().max(100).optional(),latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()}).parse(req.body);const row=(await pool.query(`INSERT INTO partner_locations(partner_id,location_type,name,code,address_line,city,region,latitude,longitude) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[req.params.id,b.location_type,b.name,b.code||null,b.address_line,b.city,b.region||null,b.latitude??null,b.longitude??null])).rows[0];ok(res,row,201);}));
r.post('/intercity/admin/routes', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({partner_id:z.string().uuid(),origin_city:city,destination_city:city,fuel_cost_xof:z.number().int().nonnegative().default(0),operating_charges_xof:z.number().int().nonnegative().default(0),partner_service_fee_xof:z.number().int().nonnegative().default(0),transit_min_hours:z.number().int().positive(),transit_max_hours:z.number().int().positive()}).parse(req.body);if(b.transit_max_hours<b.transit_min_hours)throw new HttpError(422,'Le délai maximum doit être supérieur ou égal au minimum');const transportCost=b.fuel_cost_xof+1000+b.operating_charges_xof+b.partner_service_fee_xof;try{const row=(await pool.query(`INSERT INTO intercity_routes(partner_id,origin_city,destination_city,fee_xof,minimum_transport_fee_xof,fuel_cost_xof,operating_charges_xof,partner_service_fee_xof,transit_min_hours,transit_max_hours,status) VALUES($1,$2,$3,$4,1000,$5,$6,$7,$8,$9,'active') RETURNING *`,[b.partner_id,b.origin_city,b.destination_city,transportCost,b.fuel_cost_xof,b.operating_charges_xof,b.partner_service_fee_xof,b.transit_min_hours,b.transit_max_hours])).rows[0];ok(res,row,201);}catch(e){if(e?.code==='23505')throw new HttpError(409,'Cette liaison existe déjà pour ce partenaire','INTERCITY_ROUTE_EXISTS');throw e;}}));
r.get('/intercity/admin/routes', requireRoles('admin'), asyncHandler(async(req,res)=>ok(res,(await pool.query(`SELECT r.*,p.name partner_name FROM intercity_routes r JOIN partners p ON p.id=r.partner_id ORDER BY r.origin_city,r.destination_city,p.name`)).rows)));

// Admin may associate a ready intercity shipment with the physical origin/destination points.
r.post('/intercity/shipments/:id/assign-partner', requireRoles('admin'), asyncHandler(async(req,res)=>{
  const b=z.object({partner_id:z.string().uuid(),origin_location_id:z.string().uuid(),destination_location_id:z.string().uuid()}).parse(req.body);
  const row=await tx(async c=>{
    const s=(await c.query(`SELECT s.id,s.delivery_mode,o.delivery_mode order_delivery_mode FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];
    if(!s)throw new HttpError(404,'Livraison introuvable'); if(s.delivery_mode!=='intercity'||s.order_delivery_mode!=='intercity')throw new HttpError(409,'Cette livraison n’est pas interville');
    const locations=(await c.query(`SELECT id,partner_id FROM partner_locations WHERE id IN($1,$2) AND partner_id=$3 AND status='active'`,[b.origin_location_id,b.destination_location_id,b.partner_id])).rows;
    if(locations.length!==2)throw new HttpError(422,'Points partenaires invalides');
    return (await c.query(`UPDATE shipments SET partner_id=$1,origin_location_id=$2,destination_location_id=$3 WHERE id=$4 RETURNING *`,[b.partner_id,b.origin_location_id,b.destination_location_id,s.id])).rows[0];
  }); ok(res,row);
}));

export default r;
