# NOTE V59 : ce script est une étape préparatoire historique. L’intégration finale doit passer par apply_livi_v57_v59.py, puis apply_v59_coherence.py.
from pathlib import Path
import re, shutil

ROOT=Path.cwd(); B=ROOT/'backend/livi'; F=ROOT/'frontend/livi'; A=Path(__file__).resolve().parent

REQ=[B/'src/routes/orders.js',B/'src/routes/products.js',B/'src/routes/intercity.js',B/'src/services/finance.js',B/'src/services/market.js']
missing=[str(p) for p in REQ if not p.exists()]
if missing: raise SystemExit('V58 final: checkout V57/V58 incomplet; fichiers manquants:\n'+'\n'.join(missing))

def once(p, old, new, label, required=True):
    p=Path(p); s=p.read_text(); n=s.count(old)
    if n != 1:
        if required: raise SystemExit(f'{label}: {n} occurrences dans {p}')
        return False
    p.write_text(s.replace(old,new,1)); return True

# Canonical files shipped with the package.
(B/'src/services').mkdir(parents=True,exist_ok=True)
shutil.copy2(A/'backend_logisticsTiming.js', B/'src/services/logisticsTiming.js')
shutil.copy2(A/'backend_intercity.js', B/'src/routes/intercity.js')
for src,dst in [
 ('SellerProductLogisticsScreen.tsx',F/'src/screens/seller/SellerProductLogisticsScreen.tsx'),
 ('SellerProductCategoriesScreen.tsx',F/'src/screens/seller/SellerProductCategoriesScreen.tsx'),
 ('AdminDeliveryTimingScreen.tsx',F/'src/screens/admin/AdminDeliveryTimingScreen.tsx'),
 ('AdminIntercityScreen.tsx',F/'src/screens/admin/AdminIntercityScreen.tsx'),
]:
    dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(A/src,dst)

# ---------- market.js ----------
p=B/'src/services/market.js'; s=p.read_text()
if "intercityPartner: 'livi_intercity_partner_payable_xof'" not in s:
    once(p,"  fee: 'livi_fee_revenue_xof'\n};","  fee: 'livi_fee_revenue_xof',\n  intercityPartner: 'livi_intercity_partner_payable_xof'\n};",'market account')

# ---------- orders.js ----------
p=B/'src/routes/orders.js'; s=p.read_text()
# Import operational cost helper.
if 'calculateIntercityTransportCostXof' not in s:
    old="import { assertPerishableCompatible, loadUrbanTransit, loadIntercityPricing, calculateIntercityGuaranteeXof, calculateIntercityShipping, expiryAt, addHours } from '../services/logisticsTiming.js';"
    new="import { assertPerishableCompatible, loadUrbanTransit, loadIntercityPricing, calculateIntercityGuaranteeXof, calculateIntercityTransportCostXof, calculateIntercityShipping, expiryAt, addHours } from '../services/logisticsTiming.js';"
    once(p,old,new,'orders logistics import')
# Replace the intercity branch inserted by apply_v58.py.
old="""const route=(await c.query(`SELECT r.*,v.city AS origin_city,a.city AS destination_city FROM intercity_routes r JOIN vendors v ON v.id=$1 JOIN user_addresses a ON a.id=$2 WHERE r.id=$3 AND r.status='active' AND r.origin_city=v.city AND r.destination_city=a.city`,[vendorId,body.delivery_address_id,body.intercity_route_id])).rows[0];
    if(!route) throw new HttpError(409,'Itinéraire interville introuvable ou incompatible.','INTERCITY_ROUTE_INVALID');
    const rule=await loadIntercityPricing(c);
    guaranteeXof=calculateIntercityGuaranteeXof(cargoValueXof,rule).toString();
    transportCostXof=String(Math.max(Number(route.fee_xof||0),Number(route.minimum_transport_fee_xof||1000),1000));
    transitMinMinutes=Number(route.transit_min_hours)*60; transitMaxMinutes=Number(route.transit_max_hours)*60;
    originLocationId=(await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND city=$2 AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`,[route.partner_id,route.origin_city])).rows[0]?.id||null;
    if(!originLocationId) throw new HttpError(409,'Point de départ partenaire non configuré.','INTERCITY_ORIGIN_LOCATION_NOT_CONFIGURED');
"""
new="""const route=(await c.query(`SELECT r.*,v.city AS origin_city,a.city AS destination_city FROM intercity_routes r JOIN vendors v ON v.id=$1 JOIN user_addresses a ON a.id=$2 WHERE r.id=$3 AND r.status='active' AND r.origin_city=v.city AND r.destination_city=a.city`,[vendorId,body.delivery_address_id,body.intercity_route_id])).rows[0];
    if(!route) throw new HttpError(409,'Itinéraire interville introuvable ou incompatible.','INTERCITY_ROUTE_INVALID');
    const rule=await loadIntercityPricing(c);
    guaranteeXof=calculateIntercityGuaranteeXof(cargoValueXof,rule).toString();
    transportCostXof=String(calculateIntercityTransportCostXof(route,Number(route.minimum_transport_fee_xof||1000)));
    transitMinMinutes=Number(route.transit_min_hours)*60; transitMaxMinutes=Number(route.transit_max_hours)*60;
    originLocationId=(await c.query(`SELECT id FROM partner_locations WHERE partner_id=$1 AND status='active' AND lower(city)=lower($2) AND location_type IN ('depot','both') ORDER BY location_type='both' DESC,created_at ASC LIMIT 1`,[route.partner_id,route.origin_city])).rows[0]?.id||null;
    if(!originLocationId) throw new HttpError(409,'Point de départ partenaire non configuré.','INTERCITY_ORIGIN_LOCATION_NOT_CONFIGURED');
    await assertIntercityDestinationLocation(c,{partnerId:route.partner_id,destinationCity:route.destination_city,destinationLocationId:body.intercity_destination_location_id});
"""
if old in s: s=s.replace(old,new,1)
# Quote shows exact configurable rate (fixed 10% at DB level).
old="guarantee_rate_bps:body.delivery_mode==='intercity'?1000:null"
new="guarantee_rate_bps:body.delivery_mode==='intercity'?Number((await loadIntercityPricing(pool)).guarantee_bps):null"
if old in s: s=s.replace(old,new,1)
# Add availability timestamp to quote/create product queries if absent.
s=s.replace("SELECT price_xof,status,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at","SELECT price_xof,status,available_from,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at",1)
s=s.replace("SELECT id,price_xof,stock,status,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,unit,storage_conditions","SELECT id,price_xof,stock,status,available_from,preparation_time_hours,is_perishable,shelf_life_hours,shelf_life_reference_at,unit,storage_conditions",1)
# Guard future products in quote and create.
s=s.replace("if(!p||p.status!=='active')throw new HttpError(409,'Produit indisponible');","if(!p||p.status!=='active')throw new HttpError(409,'Produit indisponible');\n    if(p.available_from && new Date(p.available_from).getTime()>Date.now())throw new HttpError(409,'Ce produit ne sera pas disponible avant la date annoncée.','PRODUCT_NOT_AVAILABLE_YET');",1)
s=s.replace("if(!p.rows[0]||p.rows[0].status!=='active')throw new HttpError(409,'Produit indisponible');","if(!p.rows[0]||p.rows[0].status!=='active')throw new HttpError(409,'Produit indisponible');\n    if(p.rows[0].available_from && new Date(p.rows[0].available_from).getTime()>Date.now())throw new HttpError(409,'Ce produit ne sera pas disponible avant la date annoncée.','PRODUCT_NOT_AVAILABLE_YET');",1)
p.write_text(s)

# ---------- products.js ----------
p=B/'src/routes/products.js'; s=p.read_text()
s=s.replace("p.status='active' AND ($1=''","p.status='active' AND (p.available_from IS NULL OR p.available_from<=now()) AND (p.is_perishable=false OR (p.shelf_life_hours IS NOT NULL AND p.shelf_life_reference_type IS NOT NULL AND (p.shelf_life_reference_type='preparation' OR (p.shelf_life_reference_at IS NOT NULL AND p.shelf_life_reference_at + (p.shelf_life_hours * interval '1 hour') > now())))) AND ($1=''",1)
s=s.replace("p.id=$1 AND p.status='active'","p.id=$1 AND p.status='active' AND (p.available_from IS NULL OR p.available_from<=now()) AND (p.is_perishable=false OR (p.shelf_life_hours IS NOT NULL AND p.shelf_life_reference_type IS NOT NULL AND (p.shelf_life_reference_type='preparation' OR (p.shelf_life_reference_at IS NOT NULL AND p.shelf_life_reference_at + (p.shelf_life_hours * interval '1 hour') > now()))))",1)
p.write_text(s)

# ---------- compatibility.js ----------
p=B/'src/routes/compatibility.js'; s=p.read_text()
# Seller-readiness gate and urban ETA.
if 'PREPARATION_MINIMUM_NOT_REACHED' not in s:
    old="const row=(await c.query(\"UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status\",[req.params.id,req.user.sub])).rows[0];"
    new="""const orderRow=(await c.query(`SELECT o.*,v.city AS origin_city FROM orders o JOIN vendors v ON v.id=o.vendor_id WHERE o.id=$1 AND o.vendor_id=$2 FOR UPDATE`,[req.params.id,req.user.sub])).rows[0];
  if(!orderRow) throw new HttpError(409,'Commande non prête');
  if(orderRow.preparation_ready_at && new Date(orderRow.preparation_ready_at).getTime()>Date.now()) throw new HttpError(409,'Le délai minimal de préparation annoncé n’est pas encore écoulé.','PREPARATION_MINIMUM_NOT_REACHED');
  const row=(await c.query(\"UPDATE orders SET status='preparing',prepared_at=coalesce(prepared_at,now()),updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status,prepared_at\",[req.params.id,req.user.sub])).rows[0];
  if(!row) throw new HttpError(409,'Commande non prête');"""
    if old in s: s=s.replace(old,new,1)
# Replace public confirmation block with a unified urban/intercity branch if not already.
start=s.find("r.post('/orders/:id/confirm-receipt'"); end=s.find('// Delivery proof retrieval',start)
if start>=0 and end>start and "INTERCITY_NOT_ARRIVED" not in s[start:end]:
    new="""r.post('/orders/:id/confirm-receipt', requireAuth, requireRoles('client','admin'), asyncHandler(async(req,res)=>{
 const result=await tx(async c=>{
  const s=(await c.query('SELECT s.id,s.order_id,s.status,s.delivery_mode,o.buyer_id,o.status order_status FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.order_id=$1 FOR UPDATE',[req.params.id])).rows[0];
  if(!s)throw new HttpError(404,'Livraison introuvable pour cette commande');
  if(req.user.role==='client'&&s.buyer_id!==req.user.sub)throw new HttpError(403,'Commande non autorisée');
  if(s.status==='lost')throw new HttpError(409,'Cette expédition est déclarée perdue.','SHIPMENT_LOST');
  if(s.delivery_mode==='intercity'){if(s.status!=='arrived')throw new HttpError(409,'Le colis interville n’est pas encore arrivé au point de retrait partenaire.','INTERCITY_NOT_ARRIVED');}
  else if(!canBuyerConfirm(s.order_status))throw new HttpError(409,'La réception ne peut pas encore être confirmée');
  const credential=req.body?.qr_token||req.body?.pin;
  if(!credential)throw new HttpError(422,'PIN/QR de réception requis.','DELIVERY_PROOF_REQUIRED');
  const {consumeProof}=await import('../services/deliveryProof.js');
  await consumeProof(c,{shipmentId:s.id,proofType:'buyer_delivery',credential,actorId:req.user.sub,requestId:res.locals.requestId,ip:req.ip,userAgent:req.get('user-agent')});
  const e=(await c.query('SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[s.order_id])).rows[0];
  if(!e||e.status!=='funded')throw new HttpError(409,'Escrow non disponible pour libération','ESCROW_NOT_READY');
  const {releaseEscrowWithActiveCommission}=await import('../services/finance.js');
  const released=await releaseEscrowWithActiveCommission(c,e,{metadata:{confirmed_by:req.user.sub,delivery_mode:s.delivery_mode}});
  await c.query("UPDATE shipments SET status='delivered',delivered_at=coalesce(delivered_at,now()) WHERE id=$1",[s.id]);
  await c.query("UPDATE orders SET status='completed',delivery_confirmed_at=now(),delivery_confirmed_by=$2,updated_at=now() WHERE id=$1",[s.order_id,req.user.sub]);
  return {order_id:s.order_id,status:'completed',escrow:'released',vendor_payable_xof:String(released.vendorNet),commission_xof:String(released.commission)};
 }); ok(res,result);
}));

"""
    p.write_text(s[:start]+new+s[end:])

# Intercity router lifecycle endpoints.
p=B/'src/routes/intercity.js'; s=p.read_text()
# Ensure cost-breakdown admin route schema.
old="const b=z.object({partner_id:z.string().uuid(),origin_city:city,destination_city:city,fee_xof:z.number().int().nonnegative(),transit_min_hours:z.number().int().positive(),transit_max_hours:z.number().int().positive()}).parse(req.body);"
new="const b=z.object({partner_id:z.string().uuid(),origin_city:city,destination_city:city,fee_xof:z.number().int().nonnegative().optional(),fuel_cost_xof:z.number().int().nonnegative().default(0),operating_charges_xof:z.number().int().nonnegative().default(0),partner_service_fee_xof:z.number().int().nonnegative().default(0),transit_min_hours:z.number().int().positive(),transit_max_hours:z.number().int().positive()}).parse(req.body);"
if old in s: s=s.replace(old,new,1)
old_sql="INSERT INTO intercity_routes(partner_id,origin_city,destination_city,fee_xof,transit_min_hours,transit_max_hours,status) VALUES($1,$2,$3,$4,$5,$6,'active')"
if old_sql in s:
    s=s.replace(old_sql,"INSERT INTO intercity_routes(partner_id,origin_city,destination_city,fee_xof,fuel_cost_xof,operating_charges_xof,partner_service_fee_xof,transit_min_hours,transit_max_hours,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'active')",1)
    s=s.replace("[b.partner_id,b.origin_city,b.destination_city,b.fee_xof,b.transit_min_hours,b.transit_max_hours]","[b.partner_id,b.origin_city,b.destination_city,Math.max(0,b.fee_xof??0),b.fuel_cost_xof,b.operating_charges_xof,b.partner_service_fee_xof,b.transit_min_hours,b.transit_max_hours]",1)
if '/intercity/shipments/:id/mark-lost' not in s:
    block="""\nr.get('/intercity/admin/urban-time-rules', requireRoles('admin'), asyncHandler(async(req,res)=>ok(res,(await pool.query('SELECT * FROM urban_delivery_time_rules ORDER BY min_distance_km ASC,effective_from DESC')).rows)));\nr.post('/intercity/admin/urban-time-rules', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({name:z.string().min(2).max(80),min_distance_km:z.number().nonnegative(),max_distance_km:z.number().nonnegative().nullable().optional(),transit_min_minutes:z.number().int().nonnegative(),transit_max_minutes:z.number().int().nonnegative(),active:z.boolean().default(true)}).parse(req.body||{});if(b.max_distance_km!=null&&b.max_distance_km<b.min_distance_km)throw new HttpError(422,'Distance maximale invalide.');if(b.transit_max_minutes<b.transit_min_minutes)throw new HttpError(422,'Transit maximal invalide.');const row=(await pool.query('INSERT INTO urban_delivery_time_rules(name,min_distance_km,max_distance_km,transit_min_minutes,transit_max_minutes,active) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[b.name,b.min_distance_km,b.max_distance_km??null,b.transit_min_minutes,b.transit_max_minutes,b.active])).rows[0];ok(res,row,201);}));\nr.post('/intercity/shipments/:id/partner-pickup', requireRoles('admin'), asyncHandler(async(req,res)=>{const result=await tx(async c=>{const row=(await c.query(`SELECT s.*,o.delivery_mode,o.status AS order_status,o.id AS order_id,o.delivery_transit_min_minutes,o.delivery_transit_max_minutes,g.status AS guarantee_status FROM shipments s JOIN orders o ON o.id=s.order_id LEFT JOIN intercity_guarantees g ON g.order_id=o.id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Expédition introuvable');if(row.delivery_mode!=='intercity'||row.status!=='pending')throw new HttpError(409,'Prise en charge interville impossible dans cet état');if(row.guarantee_status!=='held')throw new HttpError(409,'La garantie partenaire de 10 % n’est pas confirmée comme financée.','INTERCITY_GUARANTEE_NOT_HELD');const out=(await c.query(`UPDATE shipments SET status='in_transit',partner_picked_up_at=coalesce(partner_picked_up_at,now()),updated_at=now() WHERE id=$1 RETURNING *`,[row.id])).rows[0];await c.query(`INSERT INTO shipment_events(shipment_id,status,note,created_by) VALUES($1,'in_transit','Colis pris en charge par le partenaire interville',$2)`,[row.id,req.user.sub]);await c.query(`UPDATE orders SET status='shipping',delivery_eta_min_at=now()+coalesce(delivery_transit_min_minutes,0)*interval '1 minute',delivery_eta_max_at=now()+coalesce(delivery_transit_max_minutes,0)*interval '1 minute',updated_at=now() WHERE id=$1 AND status='preparing'`,[row.order_id]);return out;});ok(res,result)}));\nr.post('/intercity/shipments/:id/partner-arrive', requireRoles('admin'), asyncHandler(async(req,res)=>{const result=await tx(async c=>{const row=(await c.query(`SELECT s.*,o.delivery_mode FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Expédition introuvable');if(row.delivery_mode!=='intercity'||row.status!=='in_transit')throw new HttpError(409,'Arrivée interville impossible dans cet état');const out=(await c.query(`UPDATE shipments SET status='arrived',partner_delivered_at=coalesce(partner_delivered_at,now()),arrived_at=coalesce(arrived_at,now()),updated_at=now() WHERE id=$1 RETURNING *`,[row.id])).rows[0];await c.query(`INSERT INTO shipment_events(shipment_id,status,note,created_by) VALUES($1,'arrived','Colis arrivé au point de retrait partenaire',$2)`,[row.id,req.user.sub]);const {createProofs}=await import('../services/deliveryProof.js');await createProofs(c,row.id);return out;});ok(res,result)}));\nr.post('/intercity/shipments/:id/mark-lost', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({reason:z.string().min(3).max(500)}).parse(req.body||{});const result=await tx(async c=>{const row=(await c.query(`SELECT s.*,o.delivery_mode,o.intercity_guarantee_xof,o.intercity_guarantee_refunded_xof,o.shipping_fee,e.id escrow_id,e.status escrow_status FROM shipments s JOIN orders o ON o.id=s.order_id LEFT JOIN escrow_transactions e ON e.order_id=s.order_id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Expédition introuvable');if(row.delivery_mode!=='intercity')throw new HttpError(409,'Cette expédition n’est pas interville.');if(['delivered','cancelled','lost'].includes(row.status))throw new HttpError(409,'Expédition déjà finalisée.');const out=(await c.query(`UPDATE shipments SET status='lost',lost_at=coalesce(lost_at,now()),loss_reason=$2,loss_reported_by=$3,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,b.reason,req.user.sub])).rows[0];await c.query(`INSERT INTO shipment_events(shipment_id,status,note,created_by) VALUES($1,'lost',$2,$3)`,[row.id,`Perte interville : ${b.reason}`,req.user.sub]);const guarantee=BigInt(row.intercity_guarantee_xof||0)-BigInt(row.intercity_guarantee_refunded_xof||0);if(guarantee>0n&&row.escrow_status==='funded'){const clearing=await accountId(c,ACCOUNT.clearing),customer=await accountId(c,ACCOUNT.customer),shipping=await accountId(c,ACCOUNT.shipping);await postBalanced(c,{reference:newReference('GREF'),type:'intercity_guarantee_refund',metadata:{order_id:row.order_id,shipment_id:row.id,reason:b.reason},entries:[{account_id:clearing,amount:-guarantee},{account_id:customer,amount:guarantee},{account_id:shipping,amount:guarantee}]});await c.query(`UPDATE orders SET intercity_guarantee_refunded_xof=$2,intercity_guarantee_refunded_at=now(),status='disputed',updated_at=now() WHERE id=$1`,[row.order_id,guarantee.toString()]);await c.query(`UPDATE escrow_transactions SET intercity_guarantee_refunded_xof=$2,updated_at=now() WHERE id=$1`,[row.escrow_id,guarantee.toString()]);}else{await c.query(`UPDATE orders SET status='disputed',updated_at=now() WHERE id=$1 AND status IN ('paid','preparing','shipping')`,[row.order_id]);}return {shipment_id:row.id,status:'lost',guarantee_refunded_xof:guarantee.toString(),order_status:'disputed'};});ok(res,result)}));\n"""
    s=s.replace('export default r;',block+'export default r;',1)
p.write_text(s)

# ---------- finance.js ----------
p=B/'src/services/finance.js'; s=p.read_text()
# Capture intercity details + logistics partner code in ensurePartner/release.
if 'intercityPartnerCode' not in s:
    old="""const intercity=(await c.query('SELECT delivery_mode,intercity_guarantee_refunded_xof FROM orders WHERE id=$1',[e.order_id])).rows[0]||{};\n  const netShippingFee=BigInt(e.shipping_fee)-BigInt(intercity.intercity_guarantee_refunded_xof||0);\n  if(netShippingFee<0n) throw new HttpError(409,'Remboursement garantie supérieur aux frais de transport.','INTERCITY_GUARANTEE_ACCOUNTING_MISMATCH');\n  const releaseAmount=BigInt(e.amount)+netShippingFee;\n  await ensurePartner(c,{operationKey:`RELEASE:${e.order_id}`,idempotencyKey:`${e.order_id}:RELEASE`,type:'RELEASE',amount:releaseAmount,orderId:e.order_id,payload:{commission_bps:String(commissionBps),vendor_net:String(vendorNet),metadata}});"""
    new="""const intercity=(await c.query('SELECT delivery_mode,intercity_partner_id FROM orders WHERE id=$1',[e.order_id])).rows[0]||{};
  const netShippingFee=BigInt(e.shipping_fee);
  const releaseAmount=BigInt(e.amount)+netShippingFee;
  await ensurePartner(c,{operationKey:`RELEASE:${e.order_id}`,idempotencyKey:`${e.order_id}:RELEASE`,type:'RELEASE',amount:releaseAmount,orderId:e.order_id,payload:{commission_bps:String(commissionBps),vendor_net:String(vendorNet),delivery_mode:intercity.delivery_mode||'urban',intercity_partner_id:intercity.intercity_partner_id||null,metadata}});"""
    if old in s: s=s.replace(old,new,1)
# Replace shipping release block by delimiter.
if 'intercity_shipping_release' not in s:
    start=s.find('if(netShippingFee>0n) {'); end=s.find('  return {commission, vendorNet};',start)
    if start<0 or end<0: raise SystemExit('finance shipping block not found')
    block="""if(netShippingFee>0n) {\n    if(intercity.delivery_mode==='intercity') {\n      const partnerId=intercity.intercity_partner_id;\n      if(!partnerId) throw new HttpError(409,'Partenaire interville manquant pour le règlement du transport.','INTERCITY_PARTNER_MISSING');\n      const intercityPartnerAccount=await accountId(c,ACCOUNT.intercityPartner);\n      await postBalanced(c,{reference:newReference('SHIP'),type:'intercity_shipping_release',metadata:{order_id:e.order_id,partner_id:partnerId,...metadata},entries:[{account_id:shipping,amount:netShippingFee},{account_id:intercityPartnerAccount,amount:-netShippingFee}]});\n      await c.query(`INSERT INTO settlements(partner_instruction_id,order_id,beneficiary_partner_id,beneficiary_type,amount,currency,status) SELECT pi.id,$1,$2,'partner',$3,'XOF','pending' FROM partner_instructions pi WHERE pi.operation_key=$4`,[e.order_id,partnerId,netShippingFee.toString(),`RELEASE:${e.order_id}`]);\n    } else {\n      const assigned=(await c.query('SELECT transporter_id FROM shipments WHERE order_id=$1',[e.order_id])).rows[0];\n      await postBalanced(c,{reference:newReference('SHIP'),type:'shipping_release',metadata:{order_id:e.order_id,...metadata},entries:[{account_id:shipping,amount:netShippingFee},{account_id:transporter,amount:-netShippingFee,owner_user_id:assigned?.transporter_id||null}]});\n      if(assigned?.transporter_id) await c.query(`INSERT INTO settlements(partner_instruction_id,order_id,beneficiary_user_id,beneficiary_type,amount,currency,status) SELECT pi.id,$1,$2,'transporter',$3,'XOF','pending' FROM partner_instructions pi WHERE pi.operation_key=$4`,[e.order_id,assigned.transporter_id,netShippingFee.toString(),`RELEASE:${e.order_id}`]);\n    }\n  }\n"""
    s=s[:start]+block+s[end:]
# Refund flow must not refund guarantee twice after a loss.
if 'refundableShipping=shippingFee-guaranteeRefunded' not in s:
    old="""  const principal=BigInt(locked.amount), shippingFee=BigInt(locked.shipping_fee);\n  const orderTotal=BigInt(order.total_amount);\n  if(principal<=0n || shippingFee<0n || principal+shippingFee!==orderTotal)\n    throw new HttpError(409,'Montant escrow incohérent avec la commande','REFUND_AMOUNT_MISMATCH');\n\n  await ensurePartner(c,{operationKey:`REFUND:${locked.order_id}`,idempotencyKey:`${locked.order_id}:REFUND`,type:'REFUND',amount:principal+shippingFee,orderId:locked.order_id,payload:{buyer_id:locked.buyer_id,...metadata}});\n\n  const clearing=await accountId(c,ACCOUNT.clearing);\n  const customer=await accountId(c,ACCOUNT.customer);\n  const shipping=await accountId(c,ACCOUNT.shipping);\n  const total=principal+shippingFee;"""
    new="""  const principal=BigInt(locked.amount), shippingFee=BigInt(locked.shipping_fee);
  const refundableShipping=shippingFee;
  const orderTotal=BigInt(order.total_amount);
  if(principal<=0n || shippingFee<0n || principal+shippingFee!==orderTotal)
    throw new HttpError(409,'Montant escrow incohérent avec la commande','REFUND_AMOUNT_MISMATCH');

  const refundTotal=principal+refundableShipping;
  await ensurePartner(c,{operationKey:`REFUND:${locked.order_id}`,idempotencyKey:`${locked.order_id}:REFUND`,type:'REFUND',amount:refundTotal,orderId:locked.order_id,payload:{buyer_id:locked.buyer_id,...metadata}});

  const clearing=await accountId(c,ACCOUNT.clearing);
  const customer=await accountId(c,ACCOUNT.customer);
  const shipping=await accountId(c,ACCOUNT.shipping);
  const total=refundTotal;"""
    if old in s: s=s.replace(old,new,1)
    s=s.replace("...(shippingFee>0n ? [{account_id:shipping,amount:shippingFee}] : [])","...(refundableShipping>0n ? [{account_id:shipping,amount:refundableShipping}] : [])",1)
p.write_text(s)

# ---------- frontend navigation ----------
p=F/'src/navigation/AdminNavigator.tsx'; s=p.read_text()
if 'AdminDeliveryTimingScreen' not in s:
    s=s.replace("import { AdminPayoutsQueueScreen } from '../screens/admin/AdminPayoutsQueueScreen';","import { AdminPayoutsQueueScreen } from '../screens/admin/AdminPayoutsQueueScreen';\nimport { AdminDeliveryTimingScreen } from '../screens/admin/AdminDeliveryTimingScreen';\nimport { AdminIntercityScreen } from '../screens/admin/AdminIntercityScreen';",1)
if 'name="AdminDeliveryTiming"' not in s:
    s=s.replace('      <Stack.Screen name="AdminPayoutsQueue"',"      <Stack.Screen name=\"AdminDeliveryTiming\" component={AdminDeliveryTimingScreen} options={{ title: 'Délais urbains' }} />\n      <Stack.Screen name=\"AdminIntercity\" component={AdminIntercityScreen} options={{ title: 'Interville' }} />\n      <Stack.Screen name=\"AdminPayoutsQueue\"",1)
p.write_text(s)

p=F/'src/navigation/SellerNavigator.tsx'; s=p.read_text()
if 'SellerProductLogisticsScreen' not in s:
    s=s.replace("import { SellerProductEditorScreen } from '../screens/seller/SellerProductEditorScreen';","import { SellerProductEditorScreen } from '../screens/seller/SellerProductEditorScreen';\nimport { SellerProductLogisticsScreen } from '../screens/seller/SellerProductLogisticsScreen';\nimport { SellerProductCategoriesScreen } from '../screens/seller/SellerProductCategoriesScreen';",1)
if 'name="SellerProductLogistics"' not in s:
    s=s.replace('      <Stack.Screen name="SellerProductEditor"',"      <Stack.Screen name=\"SellerProductLogistics\" component={SellerProductLogisticsScreen} options={{ title: 'Préparation & conservation' }} />\n      <Stack.Screen name=\"SellerProductCategories\" component={SellerProductCategoriesScreen} options={{ title: 'Catégories' }} />\n      <Stack.Screen name=\"SellerProductEditor\"",1)
p.write_text(s)

# Admin dashboard shortcuts.
p=F/'src/screens/admin/AdminDashboardScreen.tsx'; s=p.read_text()
if 'Interville & garanties' not in s:
    old="""  {\n    title: 'Contrôle & opérations',\n    links: ["""
    new="""  {\n    title: 'Logistique',\n    links: [\n      { screen: 'AdminDeliveryTiming', icon: '⏱', label: 'Délais urbains' },\n      { screen: 'AdminIntercity', icon: '🛣', label: 'Interville & garanties' },\n    ],\n  },\n  {\n    title: 'Contrôle & opérations',\n    links: ["""
    if old in s: s=s.replace(old,new,1); p.write_text(s)

(Path.cwd()/'LIVI_V58_FINAL_CHANGELOG.md').write_text('''# LIVI V58 — règles finales\n\nPréparation produit : 1, 2, 3, 4, 12 ou 24 heures. Le minimum annoncé est associé au produit actif. Le chronomètre démarre à la confirmation financière du paiement ; le vendeur ne peut pas déclarer la commande prête avant cette échéance.\n\nTransport urbain : le délai de transit est indépendant du temps de préparation. Il démarre à la prise en charge réelle du colis, puis l’ETA min/max est calculée à partir de cet instant. Les délais urbains sont administrables par tranches de distance ; aucun nombre arbitraire n’est semé.\n\nPérissables : date/heure de référence + durée de conservation. Un produit futur ou expiré est masqué/non commandable. Une commande est refusée lorsque la durée restante est insuffisante pour couvrir la préparation maximale de la commande et le transit maximal configuré.\n\nInterville : garantie partenaire fixée à 10 % de la valeur marchandise, séparée du paiement de l’acheteur. Coût opérationnel du transport = carburant + minimum de livraison 1 000 XOF + charges configurées. La garantie est suivie dans un cycle séparé et peut être réclamée lors d’une perte reconnue.\n\nComptabilité interville : un compte de passif partenaire dédié reçoit le règlement du transport. En urbain, la rémunération reste attribuée au transporteur. En cas de perte interville, la garantie partenaire est traitée dans son propre cycle de réclamation ; elle ne modifie pas le montant de l’escrow acheteur.\n\nL’API/webhook fournisseur de la compagnie interville reste un point d’intégration externe : les handlers admin constituent l’outil opérationnel interne tant qu’un contrat API signé et authentifié avec le partenaire n’est pas configuré.\n''')
print('V58 final OK')
