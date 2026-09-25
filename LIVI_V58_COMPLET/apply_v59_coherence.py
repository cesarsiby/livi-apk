from pathlib import Path
import re, shutil, sys

ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
B = ROOT / 'backend' / 'livi'
F = ROOT / 'frontend' / 'livi'
A = Path(__file__).resolve().parent

REQ = [
    B / 'src' / 'routes' / 'orders.js',
    B / 'src' / 'routes' / 'compatibility.js',
    B / 'src' / 'routes' / 'delivery.js',
    B / 'src' / 'routes' / 'escrow.js',
    B / 'src' / 'routes' / 'webhooks.js',
    B / 'src' / 'services' / 'finance.js',
]
missing = [str(p) for p in REQ if not p.exists()]
if missing:
    raise SystemExit('V59: dépôt non préparé / V58 non appliqué; fichiers manquants:\n' + '\n'.join(missing))

def write_once(path, old, new, label, required=True):
    path = Path(path)
    s = path.read_text()
    n = s.count(old)
    if n != 1:
        if required:
            raise SystemExit(f'{label}: {n} occurrence(s) trouvée(s) dans {path}; arrêt sans modification.')
        return False
    path.write_text(s.replace(old, new, 1))
    return True

def regex_once(path, pattern, repl, label, required=True, flags=re.S):
    path = Path(path)
    s = path.read_text()
    rx = re.compile(pattern, flags)
    n = len(rx.findall(s))
    if n != 1:
        if required:
            raise SystemExit(f'{label}: {n} occurrence(s) trouvée(s) dans {path}; arrêt sans modification.')
        return False
    path.write_text(rx.sub(repl, s, count=1))
    return True

# ---------- SQL ----------
(B / 'migrations').mkdir(parents=True, exist_ok=True)
shutil.copy2(A / '045_v59_coherence.sql', B / 'migrations' / '045_v59_coherence.sql')

# ---------- logisticsTiming.js: canonical V59 implementation ----------
shutil.copy2(A / 'backend_logisticsTiming_v59.js', B / 'src' / 'services' / 'logisticsTiming.js')
shutil.copy2(A / 'backend_intercity_v59.js', B / 'src' / 'routes' / 'intercity.js')

# ---------- shared preparation clock ----------
prep_service = B / 'src' / 'services' / 'preparation.js'
prep_service.write_text("""import { HttpError } from '../utils/http.js';\n\nexport async function startPreparationClock(c, orderId) {\n  const row = (await c.query(`\n    SELECT id,status,preparation_time_hours,preparation_started_at,preparation_ready_at\n    FROM orders WHERE id=$1 FOR UPDATE\n  `,[orderId])).rows[0];\n  if (!row) throw new HttpError(404,'Commande introuvable','ORDER_NOT_FOUND');\n  if (!['paid','preparing'].includes(row.status)) {\n    if (row.preparation_started_at) return row;\n    throw new HttpError(409,`La préparation ne peut pas démarrer depuis l’état ${row.status}.`,'PREPARATION_START_NOT_ALLOWED');\n  }\n  if (!row.preparation_time_hours) throw new HttpError(409,'Délai de préparation absent sur la commande.','PREPARATION_TIME_REQUIRED');\n  return (await c.query(`\n    UPDATE orders\n       SET preparation_started_at=coalesce(preparation_started_at,now()),\n           preparation_ready_at=coalesce(preparation_ready_at,now() + ($2::int * interval '1 hour')),\n           updated_at=now()\n     WHERE id=$1\n     RETURNING id,status,preparation_time_hours,preparation_started_at,preparation_ready_at\n  `,[orderId,row.preparation_time_hours])).rows[0];\n}\n""")

# ---------- delivery proof: physical handoff only, escrow stays funded ----------
p = B / 'src' / 'routes' / 'delivery.js'
s = p.read_text()
old_import = "import { assertOrderTransition } from '../services/orderLifecycle.js';\nimport { consumeProof } from '../services/deliveryProof.js';"
new_import = "import { assertOrderTransition } from '../services/orderLifecycle.js';\nimport { consumeProof } from '../services/deliveryProof.js';"
if old_import not in s and new_import not in s:
    raise SystemExit('delivery import anchor absent')

pattern = r"export async function verifyDeliveryProof\(shipmentId, \{[\s\S]*?\n}\n\nr\.post\('/proof/resolve'"
replacement = """export async function verifyDeliveryProof(shipmentId, { credential, latitude, longitude, actorRole, actorId, requestId, ip, userAgent }) {
 const body=z.object({credential:z.string().min(4).max(5000),latitude:z.number().optional(),longitude:z.number().optional()}).parse({credential,latitude,longitude});
 return tx(async c=>{
  const s=(await c.query('SELECT s.*,o.buyer_id,o.vendor_id,o.status AS order_status,o.id AS order_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE',[shipmentId])).rows[0];
  if(!s) throw new HttpError(404,'Livraison introuvable');
  if(actorRole==='transporter'&&s.transporter_id!==actorId) throw new HttpError(403,'Mission non autorisée');
  if(!['in_transit','arrived'].includes(s.status)) throw new HttpError(409,'Le colis n’est pas arrivé au stade de remise','INVALID_DELIVERY_STATE');
  if(s.status==='in_transit') await c.query("UPDATE shipments SET status='arrived',arrived_at=coalesce(arrived_at,now()) WHERE id=$1",[s.id]);
  await consumeProof(c,{shipmentId:s.id,proofType:'buyer_delivery',credential:body.credential,actorId,requestId,ip,userAgent});
  await c.query("UPDATE shipments SET status='delivered',delivered_at=now(),delivery_proof_used_at=now() WHERE id=$1",[s.id]);
  await c.query('INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by) VALUES($1,\'delivered\',$2,$3,$4,$5)',[s.id,body.latitude||null,body.longitude||null,'Remise acheteur validée par QR/PIN LIVI',actorId]);
  assertOrderTransition(s.order_status,'delivered');
  await c.query("UPDATE orders SET status='delivered',delivered_at=coalesce(delivered_at,now()),updated_at=now() WHERE id=$1",[s.order_id]);
  const e=(await c.query('SELECT status FROM escrow_transactions WHERE order_id=$1 FOR UPDATE',[s.order_id])).rows[0];
  if(!e||e.status!=='funded') throw new HttpError(409,'Escrow non disponible après livraison','ESCROW_NOT_READY');
  return {shipment_id:s.id,order_id:s.order_id,status:'delivered',delivery_proof_verified:true,escrow:'held_until_confirmation_or_auto_release'};
 });
}

r.post('/proof/resolve'"""
if len(re.findall(pattern,s,flags=re.S)) == 1:
    s=re.sub(pattern,replacement,s,count=1,flags=re.S)
else:
    raise SystemExit('delivery verifyDeliveryProof: cible introuvable ou multiple')
# Urban transporters must never process intercity shipments; those follow the partner lifecycle.
s=s.replace("SELECT s.*,o.status order_status,o.vendor_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE","SELECT s.*,o.status order_status,o.vendor_id,o.delivery_mode FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE",1)
guard="  if(s.delivery_mode==='intercity') throw new HttpError(409,'Cette expédition interville doit être prise en charge par le partenaire prévu.','INTERCITY_PICKUP_NOT_ALLOWED');\n"
anchor="  if(actorRole==='transporter'&&s.transporter_id!==actorId) throw new HttpError(403,'Mission non autorisée');\n"
if guard.strip() not in s[s.find('export async function verifyPickupProof'):s.find('export async function verifyDeliveryProof')]:
    s=s.replace(anchor,anchor+guard,1)
p.write_text(s)

# ---------- compatibility: seller ready stays preparing until physical pickup ----------
p = B / 'src' / 'routes' / 'compatibility.js'
s = p.read_text()
# Add preparation reference type to seller product payloads when V58 fields exist.
s = s.replace("shelf_life_reference_at:z.string().datetime().optional()", "shelf_life_reference_at:z.string().datetime().optional(),shelf_life_reference_type:z.enum(['harvest','production','packaging','preparation']).optional()")
# Do not claim transit at seller readiness. Support both V58 code forms.
old_ready = """const row=(await c.query("UPDATE orders SET status='shipping',prepared_at=now(),updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status",[req.params.id,req.user.sub])).rows[0];
  if(!row) throw new HttpError(409,'Commande non prête');"""
if old_ready in s:
    new_ready = """const row=(await c.query("UPDATE orders SET status='preparing',prepared_at=coalesce(prepared_at,now()),updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status,prepared_at",[req.params.id,req.user.sub])).rows[0];
  if(!row) throw new HttpError(409,'Commande non prête');"""
    s=s.replace(old_ready,new_ready,1)
else:
    old_ready2 = """const row=(await c.query("UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status",[req.params.id,req.user.sub])).rows[0];"""
    if old_ready2 in s:
        new_ready2 = """const row=(await c.query("UPDATE orders SET status='preparing',prepared_at=coalesce(prepared_at,now()),updated_at=now() WHERE id=$1 AND vendor_id=$2 AND status='preparing' RETURNING id,status,prepared_at",[req.params.id,req.user.sub])).rows[0];"""
        s=s.replace(old_ready2,new_ready2,1)
    elif "prepared_at" in s and "UPDATE orders SET status='preparing'" in s:
        pass
    elif "UPDATE orders SET status='shipping'" in s and "prepared_at" in s:
        raise SystemExit('compatibility: seller-ready shipping assignment remains but exact V58 anchor was not found')

# Buyer confirmation is an authenticated state transition, not reuse of the single-use delivery proof.
confirm_snippet = (A / 'confirm_receipt_route.txt').read_text()
confirm_start=s.find("r.post('/orders/:id/confirm-receipt'")
confirm_end=s.find('// Delivery proof retrieval',confirm_start)
if confirm_start<0 or confirm_end<0:
    raise SystemExit('compatibility confirm-receipt block not found')
s=s[:confirm_start]+confirm_snippet+'\n'+s[confirm_end:]

# Seller pickup proof becomes available from explicit prepared_at while still in preparing.
s=s.replace("const canShowPickupProof =\n    status === 'shipping' ||", "const canShowPickupProof =\n    (status === 'preparing' && Boolean(order?.prepared_at)) ||\n    status === 'shipping' ||") if False else s
# Add intercity guarantee tracking to ready block after shipment creation where possible.
if "INSERT INTO intercity_guarantees" not in s:
    marker = "  if(shipment?.id) dispatch=await dispatchNextOffer(c,shipment.id);"
    if marker in s:
        repl = """  if(orderRow?.delivery_mode==='intercity' && orderRow?.intercity_partner_id && shipment?.id){
    await c.query(`INSERT INTO intercity_guarantees(order_id,shipment_id,partner_id,cargo_value_xof,guarantee_bps,guarantee_amount_xof)
      SELECT o.id,s.id,o.intercity_partner_id,o.cargo_value_xof,1000,((o.cargo_value_xof*1000+9999)/10000)::bigint
      FROM orders o JOIN shipments s ON s.order_id=o.id
      WHERE o.id=$1
      ON CONFLICT(order_id) DO UPDATE SET shipment_id=excluded.shipment_id,partner_id=excluded.partner_id,cargo_value_xof=excluded.cargo_value_xof,guarantee_bps=excluded.guarantee_bps,guarantee_amount_xof=excluded.guarantee_amount_xof,updated_at=now()`,[req.params.id]);
  }
  if(shipment?.id && orderRow?.delivery_mode==='urban') dispatch=await dispatchNextOffer(c,shipment.id);"""
        s=s.replace(marker,repl,1)
p.write_text(s)

# ---------- intercity lifecycle: guarantee separated from buyer escrow ----------
p = B / 'src' / 'routes' / 'compatibility.js'
s = p.read_text()
ml_start = s.find("r.post('/intercity/shipments/:id/mark-lost'")
if ml_start >= 0:
    ml_end = s.find("\n", ml_start)
    # These V58 compatibility routes are one-line declarations; replace only the mark-lost declaration.
    if ml_end < 0: ml_end = len(s)
    old_ml=s[ml_start:ml_end]
    if 'claim_pending' not in old_ml:
        new_ml="""r.post('/intercity/shipments/:id/mark-lost', requireRoles('admin'), asyncHandler(async(req,res)=>{const b=z.object({reason:z.string().min(3).max(500)}).parse(req.body||{});const result=await tx(async c=>{const row=(await c.query(`SELECT s.*,o.delivery_mode,o.status AS order_status,g.id guarantee_id,g.status guarantee_status FROM shipments s JOIN orders o ON o.id=s.order_id LEFT JOIN intercity_guarantees g ON g.order_id=s.order_id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Expédition introuvable');if(row.delivery_mode!=='intercity')throw new HttpError(409,'Cette expédition n’est pas interville.');if(['delivered','cancelled','lost'].includes(row.status))throw new HttpError(409,'Expédition déjà finalisée.');const out=(await c.query(`UPDATE shipments SET status='lost',lost_at=coalesce(lost_at,now()),loss_reason=$2,loss_reported_by=$3,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,b.reason,req.user.sub])).rows[0];await c.query(`INSERT INTO shipment_events(shipment_id,status,note,created_by) VALUES($1,'lost',$2,$3)`,[row.id,`Perte interville : ${b.reason}`,req.user.sub]);if(row.guarantee_id&&row.guarantee_status==='held')await c.query(`UPDATE intercity_guarantees SET status='claim_pending',claim_pending_at=coalesce(claim_pending_at,now()),updated_at=now() WHERE id=$1`,[row.guarantee_id]);await c.query(`UPDATE orders SET status='disputed',updated_at=now() WHERE id=$1 AND status IN ('paid','preparing','shipping','delivered')`,[row.order_id]);return {shipment_id:row.id,status:'lost',guarantee_status:row.guarantee_id?(row.guarantee_status==='held'?'claim_pending':row.guarantee_status):'not_configured',order_status:'disputed'};});ok(res,result)}));"""
        s=s[:ml_start]+new_ml+s[ml_end:]
# Require partner guarantee before intercity partner pickup; start transit at physical pickup; do not create delivery proof until destination arrival.
pp_start=s.find("r.post('/intercity/shipments/:id/partner-pickup'")
if pp_start>=0:
    pp_end=s.find("\n",pp_start)
    old_pp=s[pp_start:pp_end]
    if 'INTERCITY_GUARANTEE_NOT_HELD' not in old_pp:
        new_pp="""r.post('/intercity/shipments/:id/partner-pickup', requireRoles('admin'), asyncHandler(async(req,res)=>{const result=await tx(async c=>{const row=(await c.query(`SELECT s.*,o.delivery_mode,o.id AS order_id,o.status AS order_status,o.delivery_transit_min_minutes,o.delivery_transit_max_minutes,g.status AS guarantee_status FROM shipments s JOIN orders o ON o.id=s.order_id LEFT JOIN intercity_guarantees g ON g.order_id=o.id WHERE s.id=$1 FOR UPDATE`,[req.params.id])).rows[0];if(!row)throw new HttpError(404,'Expédition introuvable');if(row.delivery_mode!=='intercity'||row.status!=='pending')throw new HttpError(409,'Prise en charge interville impossible dans cet état');if(row.guarantee_status!=='held')throw new HttpError(409,'La garantie partenaire de 10 % n’est pas confirmée comme financée.','INTERCITY_GUARANTEE_NOT_HELD');const out=(await c.query(`UPDATE shipments SET status='in_transit',partner_picked_up_at=coalesce(partner_picked_up_at,now()),pickup_at=coalesce(pickup_at,now()),updated_at=now() WHERE id=$1 RETURNING *`,[row.id])).rows[0];await c.query(`INSERT INTO shipment_events(shipment_id,status,note,created_by) VALUES($1,'in_transit','Colis pris en charge par le partenaire interville',$2)`,[row.id,req.user.sub]);await c.query(`UPDATE orders SET status='shipping',delivery_eta_min_at=now()+coalesce(delivery_transit_min_minutes,0)*interval '1 minute',delivery_eta_max_at=now()+coalesce(delivery_transit_max_minutes,0)*interval '1 minute',updated_at=now() WHERE id=$1 AND status='preparing'`,[row.order_id]);return out;});ok(res,result)}));"""
        s=s[:pp_start]+new_pp+s[pp_end:]
# Add buyer delivery proof creation at intercity arrival if absent.
pa_start=s.find("r.post('/intercity/shipments/:id/partner-arrive'")
if pa_start>=0:
    pa_end=s.find("\n",pa_start)
    old_pa=s[pa_start:pa_end]
    if 'createProofs' not in old_pa:
        new_pa=old_pa.replace("return out;", "const {createProofs}=await import('../services/deliveryProof.js');await createProofs(c,row.id);return out;")
        s=s[:pa_start]+new_pa+s[pa_end:]
p.write_text(s)

# Guarantee funding/release/claim confirmations are administrative settlement acknowledgements until a real partner API is connected.
compat_path=B/'src'/'routes'/'compatibility.js'; s=compat_path.read_text()
insert_before="\n// Delivery proof retrieval"
if "/intercity/guarantees/:id/confirm-funded" not in s:
    routes=(A/'intercity_guarantee_routes.txt').read_text()
    delivery_route=(A/'intercity_delivery_route.txt').read_text()
    idx=s.find(insert_before)
    if idx<0: raise SystemExit('intercity guarantee/delivery route insertion anchor absent')
    s=s[:idx]+routes+delivery_route+s[idx:]
compat_path.write_text(s)

# ---------- finance: intercity guarantee is never netted out of buyer shipping ----------
p=B/'src'/'services'/'finance.js'; s=p.read_text()
# V58's netShippingFee subtracts a guarantee that no longer belongs to shipping_fee.
s=re.sub(r"const netShippingFee=BigInt\(e\.shipping_fee\)-BigInt\(intercity\.intercity_guarantee_refunded_xof\|\|0\);\n\s*if\(netShippingFee<0n\).*?;", "const netShippingFee=BigInt(e.shipping_fee);", s, count=1)
# Preserve correct release amount formula.
s=s.replace("const releaseAmount=BigInt(e.amount)+netShippingFee;", "const releaseAmount=BigInt(e.amount)+netShippingFee;",1)
# Refund no longer uses legacy guarantee subtraction; the guarantee is outside escrow.
if 'const refundableShipping=shippingFee-guaranteeRefunded;' in s:
    s=s.replace("const guaranteeRefunded=BigInt(locked.intercity_guarantee_refunded_xof||0);\n  const refundableShipping=shippingFee-guaranteeRefunded;", "const refundableShipping=shippingFee;")
    s=s.replace("guaranteeRefunded<0n || guaranteeRefunded>shippingFee || ", "")
    s=s.replace(",guarantee_already_refunded:String(guaranteeRefunded)", "")
    s=s.replace("...(refundableShipping>0n ? [{account_id:shipping,amount:refundableShipping}] : [])", "...(refundableShipping>0n ? [{account_id:shipping,amount:refundableShipping}] : [])")
p.write_text(s)

# ---------- checkout UI: guarantee is partner-funded and not billed to buyer ----------
checkout=F/'src/screens/buyer/CheckoutScreen.tsx'
if checkout.exists():
    t=checkout.read_text()
    t=t.replace('garantie', 'garantie partenaire')
    t=t.replace('Total logistique', 'Transport interville')
    t=t.replace('garantie partenaire partenaire', 'garantie partenaire')
    checkout.write_text(t)

# ---------- orders: consistent mixed-vendor rejection already at quote ----------
p = B / 'src' / 'routes' / 'orders.js'
s = p.read_text()
anchor = "const firstProduct=(await pool.query('SELECT vendor_id FROM products WHERE id=$1',[body.items[0].product_id])).rows[0];\n  if(!firstProduct)throw new HttpError(409,'Produit indisponible');\n  const vendor=firstProduct.vendor_id;"
if anchor in s:
    replacement = """const firstProduct=(await pool.query('SELECT vendor_id FROM products WHERE id=$1',[body.items[0].product_id])).rows[0];
  if(!firstProduct)throw new HttpError(409,'Produit indisponible');
  const vendor=firstProduct.vendor_id;
  for(const i of body.items){const v=(await pool.query('SELECT vendor_id FROM products WHERE id=$1',[i.product_id])).rows[0];if(!v||v.vendor_id!==vendor)throw new HttpError(422,'Une commande LIVI doit concerner un seul vendeur','MULTI_VENDOR_ORDER_NOT_SUPPORTED');}"""
    s=s.replace(anchor,replacement,1)
p.write_text(s)

# ---------- orders escrow: guarantee never enters buyer escrow ----------
p = B / 'src' / 'routes' / 'orders.js'
s = p.read_text()
s = re.sub(r"escrow_transactions\(([^)]*?),intercity_guarantee_xof\) VALUES\(([^)]*?),logistics\.guaranteeXof\|\|null\)", r"escrow_transactions(\1) VALUES(\2)", s, count=1)
s = re.sub(r"escrow_transactions\(([^)]*?),intercity_guarantee_xof\) VALUES\(([^)]*?),CASE WHEN body\.delivery_mode='intercity' THEN logistics\.guaranteeXof ELSE 0 END\)", r"escrow_transactions(\1) VALUES(\2)", s, count=1)
p.write_text(s)

# ---------- escrow: bind payment method to the order/user ----------
p = B / 'src' / 'routes' / 'escrow.js'
s = p.read_text()
old = """  const orderId=req.body?.order_id;
  const result = await tx(async c => {"""
if old not in s:
    raise SystemExit('escrow payment/init anchor absent')
new = """  const orderId=req.body?.order_id;
  const paymentMethodId=req.body?.payment_method_id;
  if(!orderId || !paymentMethodId) throw new HttpError(422,'Commande et moyen de paiement requis.','PAYMENT_METHOD_REQUIRED');
  const result = await tx(async c => {
    const pm=(await c.query(`SELECT id,operator,phone,status FROM payment_methods WHERE id=$1 AND user_id=$2 FOR UPDATE`,[paymentMethodId,req.user.sub])).rows[0];
    if(!pm || pm.status!=='verified') throw new HttpError(422,'Moyen de paiement invalide ou non vérifié.','PAYMENT_METHOD_INVALID');"""
s=s.replace(old,new,1)
# Persist method when moving escrow to payment_pending.
s=s.replace("UPDATE escrow_transactions SET payment_reference=$1,status='payment_pending',updated_at=now()", "UPDATE escrow_transactions SET payment_reference=$1,payment_method_id=$3,status='payment_pending',updated_at=now()",1)
s=s.replace("[ref, e.id]);", "[ref, e.id, paymentMethodId]);",1)
s=s.replace("if (e.status === 'payment_pending' && e.payment_reference) {\n      return { reference: e.payment_reference, amount: e.amount, shipping_fee: e.shipping_fee, status: 'payment_pending', partner_instruction_status: 'pending' };\n    }", "if (e.status === 'payment_pending' && e.payment_reference) {\n      if(e.payment_method_id && String(e.payment_method_id)!==String(paymentMethodId)) throw new HttpError(409,'Ce paiement est déjà associé à un autre moyen de paiement.','PAYMENT_METHOD_MISMATCH');\n      return { reference: e.payment_reference, amount: e.amount, shipping_fee: e.shipping_fee, status: 'payment_pending', partner_instruction_status: 'pending' };\n    }",1)
# Common prep service import and use in dev confirm only; webhook below gets same.
if "../services/preparation.js" not in s:
    s=s.replace("import { assertEscrowTransition } from '../services/escrowLifecycle.js';", "import { assertEscrowTransition } from '../services/escrowLifecycle.js';\nimport { startPreparationClock } from '../services/preparation.js';")
# Exact dev payment confirm status update.
s=s.replace("await c.query(\"UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1\",[e.order_id]);return {reference,status:'funded',mode:'development'};", "await c.query(\"UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1\",[e.order_id]);await startPreparationClock(c,e.order_id);return {reference,status:'funded',mode:'development'};")
p.write_text(s)

# ---------- webhooks: same payment-success -> preparation service ----------
p = B / 'src' / 'routes' / 'webhooks.js'
s=p.read_text()
if "../services/preparation.js" not in s:
    s=s.replace("import { markPartnerInstruction } from '../services/partnerInstructions.js';", "import { markPartnerInstruction } from '../services/partnerInstructions.js';\nimport { startPreparationClock } from '../services/preparation.js';")
needle="await c.query(`UPDATE escrow_transactions SET status='funded',funded_at=now(),updated_at=now() WHERE id=$1`,[e.id]);\n    await c.query(`UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1 AND status='payment_pending'`,[e.order_id]);"
if needle in s:
    s=s.replace(needle,needle+"\n    await startPreparationClock(c,e.order_id);",1)
p.write_text(s)

# ---------- cancellation stock restoration: product OR variant ----------
p = B / 'src' / 'services' / 'orderCancellation.js'
s = p.read_text()
old = """  await c.query(`\n    UPDATE products p\n    SET stock=p.stock+oi.quantity, updated_at=now()\n    FROM order_items oi\n    WHERE oi.order_id=$1 AND oi.product_id=p.id\n  `,[orderId]);"""
new = """  await c.query(`\n    UPDATE products p\n       SET stock=p.stock+oi.quantity, updated_at=now()\n      FROM order_items oi\n     WHERE oi.order_id=$1 AND oi.product_id=p.id AND oi.product_variant_id IS NULL\n  `,[orderId]);\n  await c.query(`\n    UPDATE product_variants v\n       SET stock_qty=v.stock_qty+oi.quantity, updated_at=now()\n      FROM order_items oi\n     WHERE oi.order_id=$1 AND oi.product_variant_id=v.id\n  `,[orderId]);"""
if old in s: s=s.replace(old,new,1)
elif 'product_variants v' not in s:
    raise SystemExit('orderCancellation: stock restore anchor absent')
p.write_text(s)

# ---------- seller logistics screen: explicit shelf-life basis ----------
screen=A/'SellerProductLogisticsScreen.tsx'
text=screen.read_text()
text=text.replace("const [shelfReference, setShelfReference] = useState('');", "const [shelfReference, setShelfReference] = useState('');\n  const [shelfReferenceType, setShelfReferenceType] = useState('');")
text=text.replace("setShelfReference(found.shelf_life_reference_at ? String(found.shelf_life_reference_at) : '');", "setShelfReference(found.shelf_life_reference_at ? String(found.shelf_life_reference_at) : '');\n      setShelfReferenceType(found.shelf_life_reference_type ? String(found.shelf_life_reference_type) : '');")
text=text.replace("if (perishable && (!shelfHours || Number(shelfHours) <= 0 || !shelfReference)) {", "if (perishable && (!shelfHours || Number(shelfHours) <= 0 || !shelfReference || !shelfReferenceType)) {")
text=text.replace("Indiquez une durée de conservation et sa date/heure de référence.", "Indiquez la durée, le point de départ et le type de référence de conservation.")
text=text.replace("shelf_life_reference_at: perishable ? shelfReference.trim() : undefined,", "shelf_life_reference_at: perishable ? shelfReference.trim() : undefined,\n        shelf_life_reference_type: perishable ? shelfReferenceType : undefined,")
old_label="""<TextInput value={shelfReference} onChangeText={setShelfReference} placeholder=\"Début de la conservation (ISO 8601)\" placeholderTextColor={colors.textMuted} style={styles.input} />"""
new_label=old_label+"\n            <TextInput value={shelfReferenceType} onChangeText={setShelfReferenceType} placeholder=\"Type : harvest, production, packaging ou preparation\" placeholderTextColor={colors.textMuted} style={styles.input} />"
text=text.replace(old_label,new_label)
text=text.replace("LIVI compare la durée de conservation restante au délai de préparation annoncé + au transit maximal prévu.", "LIVI compare la durée de conservation restante au transit maximal et, lorsque le point de départ est antérieur à la préparation, au temps de préparation restant.")
screen_out=F/'src/screens/seller/SellerProductLogisticsScreen.tsx'
screen_out.parent.mkdir(parents=True,exist_ok=True); screen_out.write_text(text)

# ---------- buyer receipt UI: one-use proof + separate authenticated confirmation ----------
buyer_src=A/'BuyerQRValidationScreen_v59.tsx'
buyer_dst=F/'src/screens/buyer/BuyerQRValidationScreen.tsx'
buyer_dst.parent.mkdir(parents=True,exist_ok=True)
shutil.copy2(buyer_src,buyer_dst)

# ordersApi accepts an empty confirmation payload because the buyer's authenticated
# session, not the already-consumed delivery proof, authorizes this action.
orders_api=F/'src/features/orders/ordersApi.ts'
if orders_api.exists():
    t=orders_api.read_text()
    t=t.replace("confirmReceipt: (id: string, payload: { pin?: string; qr_token?: string }) =>", "confirmReceipt: (id: string, payload: { pin?: string; qr_token?: string } = {}) =>")
    orders_api.write_text(t)

# ---------- seller detail: pickup proof also visible while prepared ----------
seller_detail=ROOT/'frontend/livi/src/screens/seller/SellerOrderDetailsScreen.tsx'
if seller_detail.exists():
    t=seller_detail.read_text()
    t=t.replace("const canShowPickupProof =\n    status === 'shipping' ||", "const canShowPickupProof =\n    (status === 'preparing' && Boolean(order?.prepared_at)) ||\n    status === 'shipping' ||")
    seller_detail.write_text(t)

# ---------- static regression test shipped with V59 ----------
testdir=B/'tests'; testdir.mkdir(parents=True,exist_ok=True)
(testdir/'v59_coherence_static.test.js').write_text('import assert from \'node:assert/strict\';\nimport fs from \'node:fs\';\nimport path from \'node:path\';\nconst root=path.resolve(new URL(\'..\',import.meta.url).pathname);\nconst read=(...parts)=>fs.readFileSync(path.join(root,...parts),\'utf8\');\nconst delivery=read(\'src\',\'routes\',\'delivery.js\');\nassert.match(delivery,/status=\'delivered\'/);\nassert.match(delivery,/held_until_confirmation_or_auto_release/);\nconst deliveryFn=delivery.slice(delivery.indexOf(\'export async function verifyDeliveryProof\'),delivery.indexOf("r.post(\'/proof/resolve\'"));\nassert.doesNotMatch(deliveryFn,/releaseEscrowWithActiveCommission/);\nconst pickupFn=delivery.slice(delivery.indexOf(\'export async function verifyPickupProof\'),delivery.indexOf(\'export async function verifyDeliveryProof\'));\nassert.match(pickupFn,/delivery_mode/);\nassert.match(pickupFn,/INTERCITY_PICKUP_NOT_ALLOWED/);\nconst compat=read(\'src\',\'routes\',\'compatibility.js\');\nconst cr=compat.slice(compat.indexOf("r.post(\'/orders/:id/confirm-receipt\'"),compat.indexOf(\'// Delivery proof retrieval\'));\nassert.doesNotMatch(cr,/consumeProof|credential|qr_token|pin/);\nassert.match(compat,/\\/intercity\\/shipments\\/:id\\/partner-deliver/);\nconst timing=read(\'src\',\'services\',\'logisticsTiming.js\');\nassert.match(timing,/calculateIntercityGuaranteeXof/);\nassert.doesNotMatch(timing,/minimum_guarantee_xof/);\nconst finance=read(\'src\',\'services\',\'finance.js\');\nassert.doesNotMatch(finance,/intercity\\.intercity_guarantee_refunded_xof/);\nassert.doesNotMatch(finance,/partnerCode:intercityPartnerCode/);\nconst cancel=read(\'src\',\'services\',\'orderCancellation.js\');\nassert.match(cancel,/product_variants/);\nconst intercity=read(\'src\',\'routes\',\'intercity.js\');\nassert.match(intercity,/shelf_life_reference_type/);\nconsole.log(\'V59 static coherence checks: PASS\');')

# ---------- V59 postconditions: fail closed on partial or stale application ----------
delivery_text=(B/'src/routes/delivery.js').read_text()
compat_text=(B/'src/routes/compatibility.js').read_text()
finance_text=(B/'src/services/finance.js').read_text()
intercity_text=(B/'src/routes/intercity.js').read_text()
assert 'held_until_confirmation_or_auto_release' in delivery_text and 'releaseEscrowWithActiveCommission' not in delivery_text[delivery_text.find('export async function verifyDeliveryProof'):delivery_text.find("r.post('/proof/resolve'")]
cr_start=compat_text.find("r.post('/orders/:id/confirm-receipt'")
cr_end=compat_text.find('// Delivery proof retrieval',cr_start)
if cr_start<0 or cr_end<0: raise SystemExit('V59 postcondition: confirm-receipt missing')
cr_text=compat_text[cr_start:cr_end]
assert 'consumeProof' not in cr_text and not re.search(r'credential|qr_token|pin',cr_text)
assert 'INTERCITY_PICKUP_NOT_ALLOWED' in delivery_text
assert "/intercity/shipments/:id/partner-deliver" in compat_text
assert 'const netShippingFee=BigInt(e.shipping_fee);' in finance_text
assert 'intercity.intercity_guarantee_refunded_xof' not in finance_text
assert 'partnerCode:intercityPartnerCode' not in finance_text
assert 'shelf_life_reference_type' in intercity_text
print('V59 corrections prepared locally. Nothing was pushed to GitHub by this script.')
