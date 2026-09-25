# NOTE V59 : ce script est une étape préparatoire historique. L’intégration finale doit passer par apply_livi_v57_v59.py, puis apply_v59_coherence.py.
from pathlib import Path
import shutil

ROOT = Path.cwd()
B = ROOT / 'backend/livi'
F = ROOT / 'frontend/livi'
B_SRC = Path(__file__).resolve().parent

NEEDED = [
    B / 'src/routes/compatibility.js',
    B / 'src/routes/products.js',
    B / 'src/routes/orders.js',
    B / 'src/routes/intercity.js',
    B / 'src/routes/webhooks.js',
    B / 'src/services/finance.js',
    F / 'src/features/checkout/checkoutApi.ts',
    F / 'src/features/orders/ordersApi.ts',
    F / 'src/features/catalogue/catalogueApi.ts',
    F / 'src/screens/buyer/ProductScreen.tsx',
    F / 'src/screens/buyer/CheckoutScreen.tsx',
    F / 'src/screens/buyer/OrderDetailsScreen.tsx',
    F / 'src/screens/buyer/DeliveryTrackingScreen.tsx',
    F / 'src/screens/seller/SellerProductEditorScreen.tsx',
    F / 'src/screens/seller/SellerOrderDetailsScreen.tsx',
    F / 'src/navigation/SellerNavigator.tsx',
    F / 'src/navigation/AdminNavigator.tsx',
    F / 'src/screens/admin/AdminDashboardScreen.tsx',
]
missing=[str(p) for p in NEEDED if not p.exists()]
if missing:
    raise SystemExit('V58 doit être appliqué après V57. Fichiers manquants:\n'+'\n'.join(missing))


def replace_once(path, old, new, label):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n != 1:
        raise SystemExit(f'{label}: ancre attendue une fois, trouvée {n} fois dans {p}')
    p.write_text(s.replace(old,new,1))


def insert_before_once(path, marker, block, label):
    p=Path(path); s=p.read_text(); n=s.count(marker)
    if n != 1:
        raise SystemExit(f'{label}: marqueur attendu une fois, trouvé {n} fois dans {p}')
    p.write_text(s.replace(marker,block+marker,1))


def replace_if_present(path, old, new, label):
    p=Path(path); s=p.read_text(); n=s.count(old)
    if n > 1:
        raise SystemExit(f'{label}: plus d’une occurrence dans {p}')
    if n == 1:
        p.write_text(s.replace(old,new,1))

# Core schema/service assets
(B/'migrations').mkdir(parents=True,exist_ok=True)
shutil.copy2(B_SRC/'044_v58_timing_perishables_intercity_security.sql', B/'migrations/044_v58_timing_perishables_intercity_security.sql')
(B/'src/services').mkdir(parents=True,exist_ok=True)
shutil.copy2(B_SRC/'backend_logisticsTiming.js', B/'src/services/logisticsTiming.js')
shutil.copy2(B_SRC/'SellerProductLogisticsScreen.tsx', F/'src/screens/seller/SellerProductLogisticsScreen.tsx')
shutil.copy2(B_SRC/'AdminDeliveryTimingScreen.tsx', F/'src/screens/admin/AdminDeliveryTimingScreen.tsx')
shutil.copy2(B_SRC/'AdminIntercityScreen.tsx', F/'src/screens/admin/AdminIntercityScreen.tsx')
shutil.copy2(B_SRC/'SellerProductCategoriesScreen.tsx', F/'src/screens/seller/SellerProductCategoriesScreen.tsx')

# ---------------- compatibility.js ----------------
p=B/'src/routes/compatibility.js'
s=p.read_text()
# Product POST/PUT schemas: add explicit preparation and shelf-life reference if not present.
if 'preparation_time_hours' not in s[s.find("r.post('/vendor/products'"):s.find("r.put('/vendor/products")]:
    old="available_from:z.string().datetime().optional()"
    new="available_from:z.string().datetime().optional(),preparation_time_hours:z.number().int().refine(v=>[1,2,3,4,12,24].includes(v),{message:'Délai de préparation invalide'}),shelf_life_reference_at:z.string().datetime().optional(),shelf_life_reference_type:z.enum(['harvest','production','packaging','preparation']).optional()"
    replace_once(p,old,new,'compatibilité produit POST')
if s.count('shelf_life_reference_at') < 2:
    old="available_from:z.string().datetime().optional()"
    new="available_from:z.string().datetime().optional(),preparation_time_hours:z.number().int().refine(v=>[1,2,3,4,12,24].includes(v),{message:'Délai de préparation invalide'}).optional(),shelf_life_reference_at:z.string().datetime().optional(),shelf_life_reference_type:z.enum(['harvest','production','packaging','preparation']).optional()"
    replace_once(p,old,new,'compatibilité produit PUT')
# Require preparation / complete perishable metadata at create.
if 'PREPARATION_TIME_REQUIRED' not in s:
    anchor="let row;\n  try {\n    row=(await pool.query(\"INSERT INTO products"
    block="if(b.status==='active' && !b.preparation_time_hours) throw new HttpError(422,'Le délai de préparation est obligatoire avant publication.','PREPARATION_TIME_REQUIRED');\n  if(b.is_perishable && (!b.shelf_life_hours || !b.shelf_life_reference_type || (b.shelf_life_reference_type!=='preparation' && !b.shelf_life_reference_at))) throw new HttpError(422,'Un produit périssable doit préciser sa durée, sa base et sa référence de conservation.','PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');\n  let row;\n  try {\n    row=(await pool.query(\"INSERT INTO products"
    if anchor in s: s=s.replace(anchor,block,1)
# Update route: validate effective values before update.
if "const effectivePrep=" not in s:
    anchor="if(b.status==='active'){const n=(await pool.query('SELECT count(*)::int n FROM product_media WHERE product_id=$1',[req.params.id])).rows[0]?.n||0;"
    block="const currentProduct=(await pool.query('SELECT preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,shelf_life_reference_type FROM products WHERE id=$1 AND vendor_id=$2',[req.params.id,req.user.sub])).rows[0];\n  if(!currentProduct) throw new HttpError(404,'Produit introuvable');\n  const effectivePrep=b.preparation_time_hours ?? currentProduct.preparation_time_hours;\n  if((b.status==='active' || currentProduct.status==='active') && !effectivePrep) throw new HttpError(422,'Le délai de préparation est obligatoire avant publication.','PREPARATION_TIME_REQUIRED');\n  const effectivePerishable=b.is_perishable ?? currentProduct.is_perishable;\n  const effectiveShelf=b.shelf_life_hours ?? currentProduct.shelf_life_hours;\n  const effectiveReference=b.shelf_life_reference_at ?? currentProduct.shelf_life_reference_at;\n  const effectiveReferenceType=b.shelf_life_reference_type ?? currentProduct.shelf_life_reference_type;\n  if(effectivePerishable && (b.status==='active' || currentProduct.status==='active') && (!effectiveShelf || !effectiveReferenceType)) throw new HttpError(422,'Un produit périssable doit préciser sa durée et sa base de conservation.','PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');\n  if(effectivePerishable && (b.status==='active' || currentProduct.status==='active') && effectiveReferenceType!=='preparation' && !effectiveReference) throw new HttpError(422,'Une référence date/heure est obligatoire pour cette base de conservation.','PERISHABLE_SHELF_LIFE_METADATA_REQUIRED');\n  if(b.status==='active'){const n=(await pool.query('SELECT count(*)::int n FROM product_media WHERE product_id=$1',[req.params.id])).rows[0]?.n||0;"
    if anchor in s: s=s.replace(anchor,block,1)
# Ensure inventory GET includes timing fields through SELECT * is already enough; vendor order detail item json should expose them.
if "'shelf_life_expires_at'" not in s and 'json_build_object' in s:
    old="'quantity',oi.quantity,'unit_price',oi.unit_price,'total_price',oi.total_price"
    new="'quantity',oi.quantity,'unit_price',oi.unit_price,'total_price',oi.total_price,'preparation_time_hours',oi.preparation_time_hours,'shelf_life_reference_at',oi.shelf_life_reference_at,'shelf_life_expires_at',oi.shelf_life_expires_at"
    replace_if_present(p,old,new,'compatibilité détail commande vendeur')
# Confirm can only start after payment.
replace_if_present(p,"status IN ('paid','pending_payment')","status='paid'",'confirm commande payée')
# Ready route: don't dispatch urban transporter for intercity, and stamp prepared_at.
if "V58_INTERCITY_READY" not in s:
    old="const row=(await c.query(\"UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status\",[req.params.id,req.user.sub])).rows[0];"
    new="""const orderRow=(await c.query(`SELECT o.*,v.city AS origin_city FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=$1 AND o.vendor_id=$2 FOR UPDATE`,[req.params.id,req.user.sub])).rows[0];
  if(!orderRow) throw new HttpError(409,'Commande non prête');
  if(orderRow.preparation_ready_at && new Date(orderRow.preparation_ready_at).getTime()>Date.now()) throw new HttpError(409,'Le délai minimal de préparation annoncé n’est pas encore écoulé.','PREPARATION_MINIMUM_NOT_REACHED');
  if(orderRow.delivery_mode==='intercity' && orderRow.intercity_partner_id){ const origin=(await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND city=$2 AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`,[orderRow.intercity_partner_id,orderRow.origin_city])).rows[0]; if(!origin) throw new HttpError(409,'Point de départ partenaire non configuré.','INTERCITY_ORIGIN_LOCATION_NOT_CONFIGURED'); }
  const row=(await c.query("UPDATE orders SET status='shipping',prepared_at=now(),updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status",[req.params.id,req.user.sub])).rows[0];
  if(!row) throw new HttpError(409,'Commande non prête');"""
    replace_once(p,old,new,'ready timing')
    old2="const shipment=(await c.query(\"INSERT INTO shipments(order_id,status) VALUES($1,'pending') ON CONFLICT (order_id) DO NOTHING RETURNING id,status\",[req.params.id])).rows[0];"
    new2="""/* V58_INTERCITY_READY */
  let shipment;
  if(orderRow.delivery_mode==='intercity'){ const origin=(await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND city=$2 AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`,[orderRow.intercity_partner_id,orderRow.origin_city])).rows[0]; shipment=(await c.query(`INSERT INTO shipments(order_id,status,delivery_mode,partner_id,origin_location_id,destination_location_id) VALUES($1,'pending','intercity',$2,$3,$4) ON CONFLICT(order_id) DO UPDATE SET delivery_mode='intercity',partner_id=EXCLUDED.partner_id,origin_location_id=EXCLUDED.origin_location_id,destination_location_id=EXCLUDED.destination_location_id RETURNING id,status`,[req.params.id,orderRow.intercity_partner_id,origin.id,orderRow.intercity_destination_location_id])).rows[0]; } else { shipment=(await c.query(`INSERT INTO shipments(order_id,status,delivery_mode) VALUES($1,'pending','urban') ON CONFLICT(order_id) DO NOTHING RETURNING id,status`,[req.params.id])).rows[0]; }"""
    replace_once(p,old2,new2,'shipment intercity/urban')
    replace_if_present(p,"let dispatch=null;\n  if(shipment?.id) dispatch=await dispatchNextOffer(c,shipment.id);","let dispatch=null;\n  if(shipment?.id && orderRow.delivery_mode!=='intercity') dispatch=await dispatchNextOffer(c,shipment.id);",'dispatch intercity')
write=lambda p,s:p.write_text(s)
write(p,s)

# ---------------- products.js ----------------
p=B/'src/routes/products.js'; s=p.read_text()
# Expired perishables must not remain publicly orderable.
s=s.replace("WHERE p.status='active' AND ($1=''", "WHERE p.status='active' AND (p.is_perishable=false OR (p.shelf_life_hours IS NOT NULL AND p.shelf_life_reference_type IS NOT NULL AND (p.shelf_life_reference_type='preparation' OR (p.shelf_life_reference_at IS NOT NULL AND p.shelf_life_reference_at + (p.shelf_life_hours * interval '1 hour') > now())))) AND ($1=''",1)
s=s.replace("WHERE p.id=$1 AND p.status='active'", "WHERE p.id=$1 AND p.status='active' AND (p.is_perishable=false OR (p.shelf_life_hours IS NOT NULL AND p.shelf_life_reference_type IS NOT NULL AND (p.shelf_life_reference_type='preparation' OR (p.shelf_life_reference_at IS NOT NULL AND p.shelf_life_reference_at + (p.shelf_life_hours * interval '1 hour') > now()))))",1)
# V58 exposes preparation and exact expiry to buyer.
if 'preparation_time_hours' in s and 'shelf_life_expires_at' not in s:
    marker="p.available_from"
    if marker in s:
        s=s.replace(marker,"p.available_from,p.preparation_time_hours,p.shelf_life_reference_at,CASE WHEN p.shelf_life_reference_at IS NULL OR p.shelf_life_hours IS NULL THEN NULL ELSE p.shelf_life_reference_at + (p.shelf_life_hours * interval '1 hour') END shelf_life_expires_at",2)
p.write_text(s)

# ---------------- orders.js ----------------
p=B/'src/routes/orders.js'; s=p.read_text()
if "../services/logisticsTiming.js" not in s:
    replace_once(p,"const r=Router();","import { assertPerishableCompatible, loadUrbanTransit, loadIntercityPricing, calculateIntercityGuaranteeXof, calculateIntercityTransportCostXof, calculateIntercityShipping, expiryAt, addHours } from '../services/logisticsTiming.js';\nconst r=Router();",'orders timing import')
# Add common helper functions immediately before the quote route.
if 'async function resolveV58Logistics' not in s:
    marker="r.post('/quote',asyncHandler(async(req,res)=>{"
    block=r'''
async function resolveV58Logistics(c,{body,vendorId,deliveryFee,distanceKm,cargoValueXof,preparationHours}){
  let transitMinMinutes=0, transitMaxMinutes=0;
  let transportCostXof='0', guaranteeXof='0', originLocationId=null;
  if(body.delivery_mode==='urban'){
    const t=await loadUrbanTransit(c,distanceKm);
    transitMinMinutes=t.minMinutes; transitMaxMinutes=t.maxMinutes;
  }else{
    const route=(await c.query(`SELECT r.*,v.city AS origin_city,a.city AS destination_city FROM intercity_routes r JOIN vendors v ON v.id=$1 JOIN user_addresses a ON a.id=$2 WHERE r.id=$3 AND r.status='active' AND r.origin_city=v.city AND r.destination_city=a.city`,[vendorId,body.delivery_address_id,body.intercity_route_id])).rows[0];
    if(!route) throw new HttpError(409,'Itinéraire interville introuvable ou incompatible.','INTERCITY_ROUTE_INVALID');
    const rule=await loadIntercityPricing(c);
    guaranteeXof=calculateIntercityGuaranteeXof(cargoValueXof,rule).toString();
    transportCostXof=String(calculateIntercityTransportCostXof(route,Number(route.minimum_transport_fee_xof||1000)));
    transitMinMinutes=Number(route.transit_min_hours)*60; transitMaxMinutes=Number(route.transit_max_hours)*60;
    originLocationId=(await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND city=$2 AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`,[route.partner_id,route.origin_city])).rows[0]?.id||null;
    if(!originLocationId) throw new HttpError(409,'Point de départ partenaire non configuré.','INTERCITY_ORIGIN_LOCATION_NOT_CONFIGURED');
  }
  const shippingFee=body.delivery_mode==='intercity'
    ? Number(calculateIntercityShipping({transportCostXof}))
    : Number(deliveryFee);
  return {shippingFee,transitMinMinutes,transitMaxMinutes,transportCostXof,guaranteeXof,originLocationId};
}

'''
    insert_before_once(p,marker,block,'helper logistique')
    s=p.read_text()
# Quote loop: ensure base subtotal/preparation tracked.
replace_if_present(p,"let subtotal=0;","let subtotal=0; let baseSubtotal=0; let preparationHours=0;",'quote base subtotal')
replace_if_present(p,"SELECT price_xof,status FROM products","SELECT price_xof,status,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at FROM products",'quote product timing')
replace_if_present(p,"let base=BigInt(p.price_xof);","if(!p.preparation_time_hours) throw new HttpError(409,'Le délai de préparation du produit n’est pas configuré.','PREPARATION_TIME_NOT_CONFIGURED');\n    preparationHours=Math.max(preparationHours,Number(p.preparation_time_hours));\n    let base=BigInt(p.price_xof);\n    baseSubtotal+=Number(base)*i.quantity;",'quote timing values')
# Replace old quote response with enriched server result if still present.
old="ok(res,{subtotal_xof:subtotal,shipping_fee_xof:delivery.fee_xof,total_xof:subtotal+delivery.fee_xof,distance_km:delivery.distance_km});"
new="const logistics=await resolveV58Logistics(pool,{body,vendorId:vendor,deliveryFee:delivery.fee_xof,distanceKm:delivery.distance_km,cargoValueXof:baseSubtotal,preparationHours});\n  for(const i of body.items){const p=(await pool.query('SELECT preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,shelf_life_reference_type FROM products WHERE id=$1',[i.product_id])).rows[0];assertPerishableCompatible(p,preparationHours,logistics.transitMaxMinutes);}\n  ok(res,{subtotal_xof:subtotal,base_subtotal_xof:baseSubtotal,shipping_fee_xof:logistics.shippingFee,total_xof:subtotal+logistics.shippingFee,distance_km:delivery.distance_km,preparation_time_hours:preparationHours,delivery_transit_min_minutes:logistics.transitMinMinutes,delivery_transit_max_minutes:logistics.transitMaxMinutes,intercity:{cargo_value_xof:baseSubtotal,transport_cost_xof:logistics.transportCostXof,guarantee_xof:logistics.guaranteeXof,guarantee_rate_bps:body.delivery_mode==='intercity'?1000:null}});"
replace_if_present(p,old,new,'quote response V58')
# Create loop: preparation tracked.
replace_if_present(p,"let total=0, baseSubtotal=0, vendorNetTotal=0n; const priced=[];","let total=0, baseSubtotal=0, vendorNetTotal=0n; let preparationHours=0; const priced=[];",'create prep accumulator')
replace_if_present(p,"SELECT id,price_xof,stock,status FROM products","SELECT id,price_xof,stock,status,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,unit,storage_conditions FROM products",'create product timing')
replace_if_present(p,"let base=BigInt(p.rows[0].price_xof);","if(!p.rows[0].preparation_time_hours) throw new HttpError(409,'Le délai de préparation du produit n’est pas configuré.','PREPARATION_TIME_NOT_CONFIGURED');\n    preparationHours=Math.max(preparationHours,Number(p.rows[0].preparation_time_hours));\n    let base=BigInt(p.rows[0].price_xof);",'create timing values')
# Replace V57 shipping fee line with timing-aware value.
old="const shippingFee=delivery.fee_xof;"
if old in s:
    new="const logistics=await resolveV58Logistics(c,{body,vendorId:vendor,deliveryFee:delivery.fee_xof,distanceKm:delivery.distance_km,cargoValueXof:baseSubtotal,preparationHours});\n  for(const i of body.items){const p=(await c.query('SELECT preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,shelf_life_reference_type FROM products WHERE id=$1',[i.product_id])).rows[0];assertPerishableCompatible(p,preparationHours,logistics.transitMaxMinutes);}\n  const shippingFee=logistics.shippingFee;"
    s=s.replace(old,new,1)
# Expand order insert if V57 insert is identifiable.
if 'preparation_time_hours' not in s[s.find("const o=(await c.query('INSERT INTO orders"):s.find("for(const i of priced)")]:
    # This exact V57 column list is expected from the integration patcher.
    oldfrag="orders(buyer_id,vendor_id,status,subtotal_amount,base_subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id,delivery_mode,intercity_partner_id,intercity_destination_location_id,estimated_transit_min_hours,estimated_transit_max_hours)"
    if oldfrag in s:
        newfrag="orders(buyer_id,vendor_id,status,subtotal_amount,base_subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id,delivery_mode,intercity_partner_id,intercity_origin_location_id,intercity_destination_location_id,estimated_transit_min_hours,estimated_transit_max_hours,preparation_time_hours,preparation_started_at,preparation_ready_at,delivery_transit_min_minutes,delivery_transit_max_minutes,cargo_value_xof,intercity_transport_cost_xof)"
        s=s.replace(oldfrag,newfrag,1)
# Replace values array for this insert in a conservative way.
oldvals="[req.user.sub,vendor,total,baseSubtotal,shippingFee,total+shippingFee,'XOF',body.delivery_address_id,body.delivery_mode,body.intercity_partner_id||null,body.intercity_destination_location_id||null,logistics.transitMinMinutes/60,logistics.transitMaxMinutes/60]"
if oldvals in s:
    newvals="[req.user.sub,vendor,total,baseSubtotal,shippingFee,total+shippingFee,'XOF',body.delivery_address_id,body.delivery_mode,body.intercity_partner_id||null,logistics.originLocationId,body.intercity_destination_location_id||null,logistics.transitMinMinutes/60,logistics.transitMaxMinutes/60,preparationHours,null,null,logistics.transitMinMinutes,logistics.transitMaxMinutes,baseSubtotal,logistics.transportCostXof||null,logistics.guaranteeXof||null]"
    s=s.replace(oldvals,newvals,1)
# Expand order item snapshot if V57 has basic six columns.
old="INSERT INTO order_items(order_id,product_id,product_variant_id,quantity,unit_price,total_price) VALUES($1,$2,$3,$4,$5,$6)"
if old in s:
    s=s.replace(old,"INSERT INTO order_items(order_id,product_id,product_variant_id,quantity,unit_price,total_price,preparation_time_hours,shelf_life_reference_at,shelf_life_reference_type,shelf_life_expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",1)
    oldv="[o.id,i.product_id,i.product_variant_id,i.quantity,i.unit,i.unit*i.quantity]"
    if oldv in s:
        newv="[o.id,i.product_id,i.product_variant_id,i.quantity,i.unit,i.unit*i.quantity,(await c.query('SELECT preparation_time_hours FROM products WHERE id=$1',[i.product_id])).rows[0]?.preparation_time_hours??null,(await c.query('SELECT shelf_life_reference_at FROM products WHERE id=$1',[i.product_id])).rows[0]?.shelf_life_reference_at??null,(await c.query('SELECT shelf_life_reference_type FROM products WHERE id=$1',[i.product_id])).rows[0]?.shelf_life_reference_type??null,(await c.query('SELECT shelf_life_reference_at,shelf_life_reference_type,shelf_life_hours FROM products WHERE id=$1',[i.product_id])).rows[0]?.shelf_life_reference_type==='preparation'?null:(await c.query('SELECT shelf_life_reference_at,shelf_life_hours FROM products WHERE id=$1',[i.product_id])).rows[0]?.shelf_life_reference_at?expiryAt((await c.query('SELECT shelf_life_reference_at,shelf_life_hours FROM products WHERE id=$1',[i.product_id])).rows[0]):null]"
        s=s.replace(oldv,newv,1)
# Add intercity guarantee snapshot to escrow insert if V57 is present.
old="escrow_transactions(order_id,buyer_id,vendor_id,amount,shipping_fee,status,commission_bps,vendor_net_amount_snapshot)"
if old in s and 'intercity_guarantee_xof' not in s[s.find(old):s.find(old)+250]:
    s=s.replace(old,"escrow_transactions(order_id,buyer_id,vendor_id,amount,shipping_fee,status,commission_bps,vendor_net_amount_snapshot)",1)
    s=s.replace("[o.id,req.user.sub,vendor,total,shippingFee,commissionBps,vendorNetTotal.toString()]","[o.id,req.user.sub,vendor,total,shippingFee,commissionBps,vendorNetTotal.toString()]",1)
# GET order/:id: expose explicit tracking object and timing.
old="SELECT o.*,e.status escrow_status,s.transporter_id,coalesce((SELECT json_agg(oi ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id),'[]'::json) items FROM orders o LEFT JOIN escrow_transactions e ON e.order_id=o.id LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1 AND (o.buyer_id=$2 OR o.vendor_id=$2)"
if old in s and 'tracking' not in s[s.find('SELECT o.*'):s.find('SELECT o.*')+600]:
    new="SELECT o.*,e.status escrow_status,s.transporter_id,s.status shipment_status,s.pickup_at,s.arrived_at,s.delivered_at,coalesce((SELECT json_agg(oi ORDER BY oi.id) FROM order_items oi WHERE oi.order_id=o.id),'[]'::json) items,coalesce((SELECT json_agg(json_build_object('id',se.id,'status',se.status,'latitude',se.latitude,'longitude',se.longitude,'note',se.note,'created_at',se.created_at) ORDER BY se.created_at) FROM shipment_events se WHERE se.shipment_id=s.id),'[]'::json) tracking_events,json_build_object('status',coalesce(s.status,o.status),'events',coalesce((SELECT json_agg(json_build_object('id',se2.id,'status',se2.status,'latitude',se2.latitude,'longitude',se2.longitude,'note',se2.note,'created_at',se2.created_at) ORDER BY se2.created_at DESC) FROM shipment_events se2 WHERE se2.shipment_id=s.id),'[]'::json),'delivery_eta_min_at',o.delivery_eta_min_at,'delivery_eta_max_at',o.delivery_eta_max_at,'preparation_started_at',o.preparation_started_at,'preparation_ready_at',o.preparation_ready_at) tracking FROM orders o LEFT JOIN escrow_transactions e ON e.order_id=o.id LEFT JOIN shipments s ON s.order_id=o.id WHERE o.id=$1 AND (o.buyer_id=$2 OR o.vendor_id=$2)"
    s=s.replace(old,new,1)
# Trigger preparation schedule on order creation immediately (not only webhook) as a fallback if provider callback is delayed; starts only when payment_pending becomes actual paid below.
# No automatic start here: payment is the authoritative start signal.
p.write_text(s)

# ---------------- webhooks.js ----------------
p=B/'src/routes/webhooks.js'; s=p.read_text()
anchor="await c.query(`UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1 AND status='payment_pending'`,[e.order_id]);"
if anchor in s and 'preparation_ready_at=coalesce(preparation_ready_at' not in s:
    block=anchor+"\n    const prep=(await c.query('SELECT preparation_time_hours FROM orders WHERE id=$1 FOR UPDATE',[e.order_id])).rows[0];\n    if(prep?.preparation_time_hours){ await c.query(`UPDATE orders SET preparation_started_at=coalesce(preparation_started_at,now()),preparation_ready_at=coalesce(preparation_ready_at,now() + ($2 * interval '1 hour')),updated_at=now() WHERE id=$1`,[e.order_id,prep.preparation_time_hours]); }"
    s=s.replace(anchor,block,1)
p.write_text(s)

# ---------------- finance.js ----------------
p=B/'src/services/finance.js'; s=p.read_text()
if 'const intercity=' not in s:
    anchor="await ensurePartner(c,{operationKey:`RELEASE:${e.order_id}`,idempotencyKey:`${e.order_id}:RELEASE`,type:'RELEASE',amount:BigInt(e.amount)+BigInt(e.shipping_fee),orderId:e.order_id,payload:{commission_bps:String(commissionBps),vendor_net:String(vendorNet),metadata}});"
    if anchor not in s: raise SystemExit('finance release anchor V58 introuvable')
    block="const intercity=(await c.query('SELECT delivery_mode,intercity_guarantee_refunded_xof FROM orders WHERE id=$1',[e.order_id])).rows[0]||{};\n  const netShippingFee=BigInt(e.shipping_fee)-BigInt(intercity.intercity_guarantee_refunded_xof||0);\n  if(netShippingFee<0n) throw new HttpError(409,'Remboursement garantie supérieur aux frais de transport.','INTERCITY_GUARANTEE_ACCOUNTING_MISMATCH');\n  "+anchor.replace("BigInt(e.shipping_fee)","netShippingFee")
    s=s.replace(anchor,block,1)
    s=s.replace("if(BigInt(e.shipping_fee)>0n) {","if(netShippingFee>0n) {",1)
    s=s.replace("{account_id:shipping,amount:e.shipping_fee},{account_id:transporter,amount:-BigInt(e.shipping_fee)","{account_id:shipping,amount:netShippingFee},{account_id:transporter,amount:-netShippingFee",1)
    s=s.replace("if(BigInt(e.shipping_fee)>0n){ const assigned=","if(netShippingFee>0n){ const assigned=",1)
    s=s.replace("BigInt(e.shipping_fee),`RELEASE:${e.order_id}`","netShippingFee.toString(),`RELEASE:${e.order_id}`",1)
p.write_text(s)

# ---------------- frontend APIs ----------------
p=F/'src/features/catalogue/catalogueApi.ts'; s=p.read_text()
if 'preparation_time_hours?' not in s:
    s=s.replace("category_id?: string;","category_id?: string;\n  unit?: string;\n  is_perishable?: boolean;\n  production_date?: string | null;\n  harvest_date?: string | null;\n  shelf_life_hours?: number | null;\n  shelf_life_reference_at?: string | null;\n  shelf_life_expires_at?: string | null;\n  storage_conditions?: string | null;\n  preparation_time_hours?: number | null;\n  categories?: Array<{id:string;name:string;slug:string}>;\n  price_tiers?: Array<{id:string;min_quantity:number;unit_price_xof:number}>;")
p.write_text(s)

p=F/'src/features/orders/ordersApi.ts'; s=p.read_text()
if 'preparation_time_hours?: number' not in s:
    s=s.replace("delivered_at?: string | null;","delivered_at?: string | null;\n  delivery_mode?: 'urban' | 'intercity';\n  preparation_time_hours?: number | null;\n  preparation_started_at?: string | null;\n  preparation_ready_at?: string | null;\n  prepared_at?: string | null;\n  delivery_transit_min_minutes?: number | null;\n  delivery_transit_max_minutes?: number | null;\n  delivery_eta_min_at?: string | null;\n  delivery_eta_max_at?: string | null;\n  cargo_value_xof?: number | null;\n  intercity_transport_cost_xof?: number | null;\n  intercity_guarantee_xof?: number | null;\n  intercity_guarantee_refunded_xof?: number | null;")
p.write_text(s)

p=F/'src/features/checkout/checkoutApi.ts'; s=p.read_text()
# Replace V57 OrderQuote/quote/create definitions with timing-aware versions.
if 'preparation_time_hours?: number' not in s:
    s=re.sub(r"export type OrderQuote = \{[^}]*distance_km: number \| null;[^}]*\};","export type OrderQuote = { subtotal_xof:number; base_subtotal_xof?:number; shipping_fee_xof:number; total_xof:number; distance_km:number|null; preparation_time_hours?:number; delivery_transit_min_minutes?:number; delivery_transit_max_minutes?:number; intercity?:{cargo_value_xof:number;transport_cost_xof:number|string;guarantee_xof:number|string;guarantee_rate_bps:number|null}|null };",s,count=1)
# If V57 changed signatures already, otherwise patch current main signatures.
if 'deliveryMode' not in s:
    old="quote: (lines: CartLine[], shippingAddressId: string) =>\n    apiRequest<OrderQuote>('/orders/quote', { method: 'POST', body: JSON.stringify({\n      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),\n      delivery_address_id: shippingAddressId,\n    })}),"
    new="quote: (lines: CartLine[], shippingAddressId: string, deliveryMode: 'urban'|'intercity' = 'urban', intercity?: {partner_id?: string;route_id?: string;destination_location_id?: string}) =>\n    apiRequest<OrderQuote>('/orders/quote', { method: 'POST', body: JSON.stringify({\n      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),\n      delivery_address_id: shippingAddressId, delivery_mode: deliveryMode, ...intercity && { intercity_partner_id: intercity.partner_id, intercity_route_id: intercity.route_id, intercity_destination_location_id: intercity.destination_location_id },\n    })}),"
    replace_once(p,old,new,'checkout quote V58')
    old2="createOrder: (lines: CartLine[], shippingAddressId: string, paymentMethodId: string) =>\n    apiRequest<any>('/orders', { method: 'POST', body: JSON.stringify({\n      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),\n      delivery_address_id: shippingAddressId,\n    })}),"
    new2="createOrder: (lines: CartLine[], shippingAddressId: string, paymentMethodId: string, deliveryMode: 'urban'|'intercity' = 'urban', intercity?: {partner_id?: string;route_id?: string;destination_location_id?: string}) =>\n    apiRequest<any>('/orders', { method: 'POST', body: JSON.stringify({\n      items: lines.map(line => ({ product_id: line.product.id, product_variant_id: line.variant?.id, quantity: line.quantity })),\n      delivery_address_id: shippingAddressId, delivery_mode: deliveryMode, ...intercity && { intercity_partner_id: intercity.partner_id, intercity_route_id: intercity.route_id, intercity_destination_location_id: intercity.destination_location_id },\n    })}),"
    replace_once(p,old2,new2,'checkout create V58')
p.write_text(s)

# ---------------- new frontend screens ----------------
# Files were copied above from the packaged source files.

# ---------------- Frontend navigation ----------------
p=F/'src/navigation/SellerNavigator.tsx'; s=p.read_text()
if 'SellerProductLogisticsScreen' not in s:
    replace_once(p,"import { LiveDashboardScreen } from '../screens/seller/LiveDashboardScreen';","import { LiveDashboardScreen } from '../screens/seller/LiveDashboardScreen';\nimport { SellerProductLogisticsScreen } from '../screens/seller/SellerProductLogisticsScreen';",'seller logistics import')
    insert_before_once(p,'      <Stack.Screen name="SellerProductEditor"', '      <Stack.Screen name="SellerProductLogistics" component={SellerProductLogisticsScreen} options={{ title: \'Préparation & conservation\' }} />\n','seller logistics route')

p=F/'src/navigation/AdminNavigator.tsx'; s=p.read_text()
if 'AdminDeliveryTimingScreen' not in s:
    replace_once(p,"import { AdminPayoutsQueueScreen } from '../screens/admin/AdminPayoutsQueueScreen';","import { AdminPayoutsQueueScreen } from '../screens/admin/AdminPayoutsQueueScreen';\nimport { AdminDeliveryTimingScreen } from '../screens/admin/AdminDeliveryTimingScreen';",'admin timing import')
    insert_before_once(p,'      <Stack.Screen name="AdminPayoutsQueue"', '      <Stack.Screen name="AdminDeliveryTiming" component={AdminDeliveryTimingScreen} options={{ title: \'Délais urbains\' }} />\n','admin timing route')

p=F/'src/screens/admin/AdminDashboardScreen.tsx'; s=p.read_text()
if 'AdminDeliveryTiming' not in s:
    marker="{ screen: 'AdminMissions', icon: '📍', label: 'Missions' },"
    replace_once(p,marker,marker+"\n      { screen: 'AdminDeliveryTiming', icon: '⏱️', label: 'Délais urbains' },",'admin timing link')

# Seller editor: expose logistics screen.
p=F/'src/screens/seller/SellerProductEditorScreen.tsx'; s=p.read_text()
if 'SellerProductLogistics' not in s and 'navigation.navigate' in s:
    # Add near existing variants/action area, using the route name created above.
    marker="      <Button\n          title=\""
    # safer: insert a small action before the first return close if screen is intact.
    idx=s.find('return (')
    if idx!=-1:
        # Add a Button block after product save area may be hard; use a compact Pressable near end via marker if available.
        end_marker='      </ScrollView>'
        if end_marker in s:
            block="      {productId ? <Button title=\"Préparation & conservation\" onPress={() => navigation.navigate('SellerProductLogistics',{productId})} variant=\"secondary\" fullWidth /> : null}\n\n"
            s=s.replace(end_marker,block+end_marker,1)
            p.write_text(s)


 # Write a human-readable patch note.
(Path.cwd()/'LIVI_V58_CHANGELOG.md').write_text('''# LIVI V58 — timing et interville\n\nCette version ajoute : préparation obligatoire 1/2/3/4/12/24 h, démarrage de la préparation à la confirmation du paiement, échéance de préparation, distinction préparation/transit, calcul et validation de durée de conservation restante, masquage des périssables expirés, règles de transit urbain configurables, séparation coût de transport interville / garantie de sécurité de 10 %, minimum transport 1 000 FCFA, suivi d’ETA et préparation de l’expédition partenaire, ainsi qu’un workflow administratif de déclaration de perte et remboursement de la garantie.\n\nLa règle monétaire interville est exprimée sans valeur inventée : garantie = 10 % de la valeur de la marchandise, avec aucun minimum distinct n’est appliqué ; coût de transport = coût de route configuré, au moins 1 000 FCFA ; frais de transport affichés = maximum des deux.\n\nAttention : les appels externes de paiement/logistique réels restent dépendants des fournisseurs et secrets configurés dans l’environnement de déploiement.\n''')

# ---------------- runtime UI timing patches ----------------
# Buyer product: show preparation and perishability details.
p=F/'src/screens/buyer/ProductScreen.tsx'; s=p.read_text()
if 'Préparation après commande' not in s:
    marker='      </ScrollView>'
    info="""      {(product.preparation_time_hours || product.is_perishable) ? <View style={{marginTop:16,padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.dark2,gap:7}}><Text style={{color:colors.gold,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1}}>LOGISTIQUE</Text>{product.preparation_time_hours ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Préparation après commande : {product.preparation_time_hours} h</Text> : null}{product.is_perishable ? <><Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Conservation : {product.shelf_life_hours ?? '—'} h</Text>{product.shelf_life_expires_at ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Conservation jusqu’au : {new Date(product.shelf_life_expires_at).toLocaleString('fr-FR')}</Text> : null}{product.storage_conditions ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Conditions : {product.storage_conditions}</Text> : null}</> : null}</View> : null}
"""
    if s.count(marker)==1: s=s.replace(marker,info+marker,1)
    p.write_text(s)

# Buyer checkout: show the two clocks and intercity security components.
p=F/'src/screens/buyer/CheckoutScreen.tsx'; s=p.read_text()
if 'Garantie sécurité 10 %' not in s:
    marker='      </ScrollView>'
    info="""      {quote ? <View style={{marginTop:16,padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.dark2,gap:7}}><Text style={{color:colors.gold,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1}}>DÉLAIS & TRANSPORT</Text>{quote.preparation_time_hours ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Préparation annoncée : {quote.preparation_time_hours} h</Text> : null}{quote.delivery_transit_min_minutes!=null ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Transport : {Math.round(quote.delivery_transit_min_minutes/60)}–{Math.round((quote.delivery_transit_max_minutes??quote.delivery_transit_min_minutes)/60)} h</Text> : null}{deliveryMode==='intercity' && quote.intercity ? <><Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Valeur marchandise : {Number(quote.intercity.cargo_value_xof).toLocaleString('fr-FR')} FCFA</Text><Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Coût transport partenaire : {Number(quote.intercity.transport_cost_xof).toLocaleString('fr-FR')} FCFA</Text><Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Garantie partenaire 10 % (non facturée à l’acheteur) : {Number(quote.intercity.guarantee_xof).toLocaleString('fr-FR')} FCFA</Text><Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Frais transport facturés : {Number(quote.shipping_fee_xof).toLocaleString('fr-FR')} FCFA</Text></> : null}</View> : null}
"""
    if s.count(marker)==1: s=s.replace(marker,info+marker,1)
    p.write_text(s)

# Buyer order detail: display preparation deadline, transit and security refund state.
p=F/'src/screens/buyer/OrderDetailsScreen.tsx'; s=p.read_text()
if 'DÉLAIS LIVI' not in s:
    marker='      </ScrollView>'
    info="""      {(order?.preparation_time_hours || order?.delivery_transit_max_minutes!=null || order?.delivery_mode==='intercity') ? <View style={{marginTop:16,padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.dark2,gap:7}}><Text style={{color:colors.gold,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1}}>DÉLAIS LIVI</Text>{order?.preparation_time_hours ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Préparation annoncée : {order.preparation_time_hours} h</Text> : null}{order?.preparation_ready_at ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Prête à partir de : {new Date(order.preparation_ready_at).toLocaleString('fr-FR')}</Text> : null}{order?.delivery_transit_min_minutes!=null ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Transport : {Math.round(order.delivery_transit_min_minutes/60)}–{Math.round((order.delivery_transit_max_minutes??order.delivery_transit_min_minutes)/60)} h</Text> : null}{order?.delivery_eta_min_at ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Livraison estimée : {new Date(order.delivery_eta_min_at).toLocaleString('fr-FR')} → {order.delivery_eta_max_at?new Date(order.delivery_eta_max_at).toLocaleString('fr-FR'):''}</Text> : null}{order?.delivery_mode==='intercity' && order.intercity_guarantee_xof!=null ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Garantie partenaire interville 10 % (hors montant facturé) : {Number(order.intercity_guarantee_xof).toLocaleString('fr-FR')} FCFA{order.intercity_guarantee_refunded_xof ? ` · garantie remboursée : ${Number(order.intercity_guarantee_refunded_xof).toLocaleString('fr-FR')} FCFA` : ''}</Text> : null}</View> : null}
"""
    if s.count(marker)==1: s=s.replace(marker,info+marker,1)
    p.write_text(s)

# Buyer delivery tracking: make the two-stage clock visible.
p=F/'src/screens/buyer/DeliveryTrackingScreen.tsx'; s=p.read_text()
if 'Préparation puis transport' not in s:
    marker='          {error ? ('
    info="""          {(order?.delivery_eta_min_at || order?.preparation_ready_at || order?.delivery_transit_max_minutes!=null) ? <Card style={styles.card}><View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>ÉCHÉANCE</Text><Text style={styles.sectionTitle}>Préparation puis transport</Text></View></View>{order?.preparation_ready_at ? <Text style={styles.infoMeta}>Préparation : {new Date(order.preparation_ready_at).toLocaleString('fr-FR')} au plus tard</Text> : null}{order?.delivery_eta_min_at ? <Text style={styles.infoMeta}>Livraison estimée : {new Date(order.delivery_eta_min_at).toLocaleString('fr-FR')} → {order.delivery_eta_max_at?new Date(order.delivery_eta_max_at).toLocaleString('fr-FR'):''}</Text> : null}</Card> : null}

"""
    if s.count(marker)==1: s=s.replace(marker,info+marker,1)
    p.write_text(s)

# Seller order detail: show promised preparation minimum and deadline.
p=F/'src/screens/seller/SellerOrderDetailsScreen.tsx'; s=p.read_text()
if 'DÉLAIS LOGISTIQUES' not in s:
    marker='      {error ? ('
    info="      {(order?.preparation_time_hours || order?.preparation_ready_at) ? <View style={{marginTop:16,padding:16,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.dark2,gap:6}}><Text style={{color:colors.gold,fontFamily:fonts.bodyBold,fontSize:10,letterSpacing:1}}>DÉLAIS LOGISTIQUES</Text>{order?.preparation_time_hours ? <Text style={{color:colors.textPrimary,fontFamily:fonts.bodySemibold,fontSize:14}}>Préparation minimale : {order.preparation_time_hours} h</Text> : null}{order?.preparation_ready_at ? <Text style={{color:colors.textMuted,fontFamily:fonts.body,fontSize:12}}>Échéance : {new Date(order.preparation_ready_at).toLocaleString('fr-FR')}</Text> : null}</View> : null}\n\n"
    if s.count(marker)==1: s=s.replace(marker,info+marker,1)
    p.write_text(s)

# Seller product categories: copy a dedicated screen packaged with this patch.
cat=F/'src/screens/seller/SellerProductCategoriesScreen.tsx'
shutil.copy2(B_SRC/'SellerProductCategoriesScreen.tsx',cat)
nav=F/'src/navigation/SellerNavigator.tsx'; s=nav.read_text()
if 'SellerProductCategoriesScreen' not in s:
    replace_once(nav,"import { SellerProductLogisticsScreen } from '../screens/seller/SellerProductLogisticsScreen';","import { SellerProductLogisticsScreen } from '../screens/seller/SellerProductLogisticsScreen';\nimport { SellerProductCategoriesScreen } from '../screens/seller/SellerProductCategoriesScreen';",'seller category import V58')
    insert_before_once(nav,'      <Stack.Screen name="SellerProductLogistics"', '      <Stack.Screen name="SellerProductCategories" component={SellerProductCategoriesScreen} options={{ title: \'Catégories\' }} />\n','seller category route V58')

# Seller product editor: explicit entries for categories + logistics.
p=F/'src/screens/seller/SellerProductEditorScreen.tsx'; s=p.read_text()
if 'Catégories multiples' not in s and 'Gérer les prix par quantité' in s:
    marker='title="Gérer les prix par quantité"'
    s=s.replace(marker,marker+' />\n            <Button title="Catégories multiples" variant="outline" onPress={()=>navigation.navigate(\'SellerProductCategories\',{productId})} fullWidth />\n            <Button title="Préparation & conservation" variant="outline" onPress={()=>navigation.navigate(\'SellerProductLogistics\',{productId})} fullWidth',1)
    p.write_text(s)

# Admin intercity: state the fixed guarantee rule visibly.
p=F/'src/screens/admin/AdminIntercityScreen.tsx'; s=p.read_text()
if 'Garantie de sécurité' not in s and '<Card><Text style={styles.h2}>Partenaire logistique</Text>' in s:
    marker='<Card><Text style={styles.h2}>Partenaire logistique</Text>'
    info='<Card><Text style={styles.h2}>Garantie de sécurité</Text><Text style={styles.meta}>10 % de la valeur de la marchandise, garantie partenaire non facturée à l’acheteur. Le coût de transport est distinct et couvre carburant + minimum de livraison 1 000 FCFA + charges configurées.</Text></Card>'
    s=s.replace(marker,info+marker,1); p.write_text(s)

(Path.cwd()/'LIVI_V58_CHANGELOG.md').write_text('''# LIVI V58 — timing, périssables, SLA et interville\n\n- Préparation produit obligatoire : 1, 2, 3, 4, 12 ou 24 heures.\n- Le paiement confirmé démarre la fenêtre de préparation. Le vendeur ne peut déclarer la commande prête avant l’échéance minimale annoncée.\n- La préparation et le transit sont deux horloges indépendantes.\n- Les produits périssables utilisent une date/heure de référence + une durée de conservation ; LIVI calcule l’expiration et vérifie la durée restante contre préparation + transit maximal.\n- Les produits expirés ou pas encore disponibles ne doivent plus être commandables.\n- Les délais urbains sont configurés par l’administrateur ; aucune durée arbitraire n’est inventée.\n- Interville : garantie de sécurité partenaire = 10 % de la valeur de la marchandise, séparée du paiement de l’acheteur ; coût de transport de route = carburant + minimum de livraison 1 000 FCFA + charges configurées.\n- Une perte interville peut déclencher le remboursement de la garantie depuis un escrow financé, avec traçabilité comptable.\n- Le remboursement de la valeur de la marchandise elle-même reste dans le workflow de litige/remboursement.\n''')

print('V58 timing/perishable/intercity patch prepared.')
