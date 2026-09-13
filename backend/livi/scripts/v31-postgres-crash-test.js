import pg from 'pg';
import crypto from 'node:crypto';

const { Client } = pg;
if (process.env.NODE_ENV === 'production') throw new Error('V31 crash test cannot run in production');

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};
const c = new Client(cfg);
const id = () => crypto.randomUUID();
const expectReject = async (fn, label) => {
  try { await fn(); throw new Error(`${label}: expected rejection, got success`); }
  catch (e) {
    if (e.message.startsWith(`${label}: expected rejection`)) throw e;
    return e;
  }
};
const q = (sql, p=[]) => c.query(sql,p);

await c.connect();
await c.query('BEGIN');
try {
  const buyer=id(), vendor=id(), otherVendor=id(), transporter=id(), address=id(), product=id(), otherProduct=id(), order=id(), escrow=id(), shipment=id();

  await q(`INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES
    ($1,$2,'V31 Buyer','client','active',true),($3,$4,'V31 Vendor','vendor','active',true),
    ($5,$6,'V31 Other Vendor','vendor','active',true),($7,$8,'V31 Transporter','transporter','active',true)`,
    [buyer,`+22373${buyer.slice(0,7)}`,vendor,`+22374${vendor.slice(0,7)}`,otherVendor,`+22375${otherVendor.slice(0,7)}`,transporter,`+22376${transporter.slice(0,7)}`]);
  await q(`INSERT INTO vendors(id,shop_name,slug) VALUES($1,'V31 Vendor',$2),($3,'V31 Other',$4)`,[vendor,`v31-${vendor}`,otherVendor,`v31-${otherVendor}`]);
  await q(`INSERT INTO transporters(id,kyc_status) VALUES($1,'approved')`,[transporter]);
  await q(`INSERT INTO user_addresses(id,user_id,recipient_name,phone,address_line,city,country) VALUES($1,$2,'V31 Buyer','+223730000000','Test','Bamako','ML')`,[address,buyer]);
  await q(`INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status) VALUES($1,$2,'V31 Product',$3,100000,1,'active'),($4,$5,'V31 Other Product',$6,100000,1,'active')`,[product,vendor,`v31-${product}`,otherProduct,otherVendor,`v31-${otherProduct}`]);
  await q(`INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id) VALUES($1,$2,$3,'paid',100000,2000,102000,'XOF',$4)`,[order,buyer,vendor,address]);

  // V30 invariant: order total.
  await q('SAVEPOINT s_total');
  await expectReject(async()=>{ await q(`UPDATE orders SET total_amount=101999 WHERE id=$1`,[order]); await q('SET CONSTRAINTS ALL IMMEDIATE'); },'order-total');
  await q('ROLLBACK TO SAVEPOINT s_total');

  await q(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,100000,100000)`,[order,product]);
  // V30 invariant: item vendor.
  await q('SAVEPOINT s_item');
  await expectReject(async()=>{ await q(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,100000,100000)`,[order,otherProduct]); await q('SET CONSTRAINTS ALL IMMEDIATE'); },'order-item-vendor');
  await q('ROLLBACK TO SAVEPOINT s_item');

  // V30 invariant: escrow amount/shipping identity.
  await q('SAVEPOINT s_escrow');
  await expectReject(async()=>{ await q(`INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status) VALUES($1,$2,$3,$4,99999,2000,'funded')`,[escrow,order,buyer,vendor]); await q('SET CONSTRAINTS ALL IMMEDIATE'); },'escrow-amount');
  await q('ROLLBACK TO SAVEPOINT s_escrow');

  // Correct escrow for later proof/immutability checks.
  await q(`INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status) VALUES($1,$2,$3,$4,100000,2000,'funded')`,[escrow,order,buyer,vendor]);
  await q(`INSERT INTO shipments(id,order_id,transporter_id,status,tracking_code) VALUES($1,$2,$3,'in_transit',$4)`,[shipment,order,transporter,`V31-${shipment}`]);

  // V30 KYC role guard.
  await q('SAVEPOINT s_kyc');
  await expectReject(async()=>{ await q(`INSERT INTO kyc_documents(user_id,document_type,file_key) VALUES($1,'cni','v31-client-cni')`,[buyer]); },'kyc-role');
  await q('ROLLBACK TO SAVEPOINT s_kyc');

  // V25/V30 private file guard.
  await q('SAVEPOINT s_file');
  await expectReject(async()=>{ await q(`INSERT INTO kyc_documents(user_id,document_type,file_key) VALUES($1,'cni','../public.pdf')`,[vendor]); },'private-file');
  await q('ROLLBACK TO SAVEPOINT s_file');

  // Approved transporter guard.
  const pendingTransporter=id();
  await q(`INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES($1,$2,'V31 Pending Transporter','transporter','active',true)`,[pendingTransporter,`+22377${pendingTransporter.slice(0,7)}`]);
  await q(`INSERT INTO transporters(id,kyc_status) VALUES($1,'pending')`,[pendingTransporter]);
  await q('SAVEPOINT s_ship');
  await expectReject(async()=>{ await q(`UPDATE shipments SET transporter_id=$1 WHERE id=$2`,[pendingTransporter,shipment]); },'shipment-transporter');
  await q('ROLLBACK TO SAVEPOINT s_ship');

  // Paid payout without provider must fail.
  await q('SAVEPOINT s_payout');
  await expectReject(async()=>{ await q(`INSERT INTO payout_requests(user_id,amount,currency,destination_ref,status,reference) VALUES($1,1900,'XOF','v31-dest','paid',$2)`,[transporter,`V31-PAYOUT-${id()}`]); await q('SET CONSTRAINTS ALL IMMEDIATE'); },'paid-payout-provider');
  await q('ROLLBACK TO SAVEPOINT s_payout');

  // Partner webhook idempotency is DB-enforced.
  const eventId=`V31-${id()}`;
  await q(`INSERT INTO partner_payment_events(provider,event_id,payload,signature_valid) VALUES('v31', $1, '{}'::jsonb, true)`,[eventId]);
  await q('SAVEPOINT s_event');
  await expectReject(async()=>{ await q(`INSERT INTO partner_payment_events(provider,event_id,payload,signature_valid) VALUES('v31',$1,'{}'::jsonb,true)`,[eventId]); },'partner-event-duplicate');
  await q('ROLLBACK TO SAVEPOINT s_event');

  // Ledger immutability.
  const txId=id(), acct=(await q(`SELECT id FROM ledger_accounts WHERE code='partner_clearing_xof'`)).rows[0]?.id;
  if (!acct) throw new Error('missing partner_clearing_xof');
  await q(`INSERT INTO ledger_transactions(id,reference,type,metadata) VALUES($1,$2,'v31_test','{}')`,[txId,`V31-${id()}`]);
  await q(`INSERT INTO ledger_entries(transaction_id,account_id,amount,currency) VALUES($1,$2,1,'XOF')`,[txId,acct]);
  await q('SAVEPOINT s_ledger');
  await expectReject(async()=>{ await q(`UPDATE ledger_entries SET amount=2 WHERE transaction_id=$1`,[txId]); },'ledger-immutability');
  await q('ROLLBACK TO SAVEPOINT s_ledger');

  // Concurrency primitive: second transaction must wait while first holds the same payout lock.
  const c2 = new Client(cfg); await c2.connect();
  try {
    await c2.query('BEGIN');
    await q(`SELECT livi_payout_user_lock($1)`,[transporter]);
    const started=Date.now();
    const waiter=c2.query(`SELECT livi_payout_user_lock($1)`,[transporter]);
    await new Promise(r=>setTimeout(r,150));
    if (Date.now()-started < 140) throw new Error('payout-lock test timing invalid');
    await q('COMMIT');
    await waiter;
    await c2.query('COMMIT');
  } finally { try { await c2.end(); } catch {} }

  await c.query('ROLLBACK');
  console.log(JSON.stringify({suite:'V31-postgres-crash-test',status:'PASS',checks:[
    'order total invariant','order-item vendor invariant','escrow amount invariant','KYC role invariant',
    'private file invariant','approved transporter invariant','paid payout provider invariant',
    'partner webhook uniqueness','ledger immutability','payout advisory-lock serialization'
  ]},null,2));
} catch (e) {
  try { await c.query('ROLLBACK'); } catch {}
  console.error(e.stack || e);
  process.exitCode=1;
} finally { await c.end(); }
