// ============================================================================
// DEPRECATED as of V38 — kept only for audit-trail / history, no longer run
// by npm scripts or scripts/run-postgres-suite.js.
//
// This script hand-builds the "expected" ledger state itself (see the
// `ledger()` calls below, e.g. `owner_user_id:transporter` supplied
// directly by the test) instead of calling the real application code
// (src/services/finance.js#releaseEscrow, src/services/wallet.js,
// src/services/withdrawal.js#calculateWithdrawalFee). A synthetic scenario
// that writes its own "correct" answer cannot catch a bug in the code that
// is supposed to compute that answer — and indeed it did not: V37 found
// that releaseEscrow() posted every transporter shipping-fee credit with
// owner_user_id=NULL (escrow_transactions has no transporter_id column),
// which this script's hand-written `owner_user_id:transporter` line could
// never have revealed.
//
// Replaced by scripts/v38_end_to_end_financial_scenario.js, which performs
// the same scenario but calls the real release/payout functions. See
// docs/V38_END_TO_END_FINANCIAL_TEST.md for the full explanation.
// ============================================================================
import pg from 'pg';
import crypto from 'node:crypto';

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL ||
    `postgres://${process.env.PGUSER || 'postgres'}:${process.env.PGPASSWORD || 'postgres'}@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'livi_test'}`
});

const xof = n => BigInt(n);
const uid = () => crypto.randomUUID();

async function q(sql, params=[]) {
  return (await client.query(sql, params)).rows;
}

async function ledger(reference, entries) {
  const sum = entries.reduce((a,e)=>a+BigInt(e.amount),0n);
  if (sum !== 0n) throw new Error(`Unbalanced test ledger: ${sum}`);
  const tx = (await q(
    `INSERT INTO ledger_transactions(reference,type,metadata)
     VALUES($1,'v13_test',$2) RETURNING id`,
    [reference, {scenario:'v13'}]
  ))[0];
  for (const e of entries) {
    await q(
      `INSERT INTO ledger_entries(transaction_id,account_id,amount,currency,owner_user_id)
       VALUES($1,$2,$3,'XOF',$4)`,
      [tx.id,e.account,String(e.amount),e.owner_user_id||null]
    );
  }
  return tx.id;
}

async function account(code) {
  const r = await q(`SELECT id FROM ledger_accounts WHERE code=$1 AND currency='XOF'`,[code]);
  if (!r[0]) throw new Error(`Missing ledger account ${code}`);
  return r[0].id;
}

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Never run V13 scenario against production');
  await client.connect();
  await client.query('BEGIN');

  try {
    const buyer=uid(), vendor=uid(), transporter=uid(), address=uid(), product=uid(), order=uid(), escrow=uid(), shipment=uid();

    await q(
      `INSERT INTO users(id,phone,name,role,status,phone_verified)
       VALUES
       ($1,$2,'V13 Buyer','client','active',true),
       ($3,$4,'V13 Vendor','vendor','active',true),
       ($5,$6,'V13 Transporter','transporter','active',true)`,
      [buyer,`+223700${buyer.slice(0,6)}`,vendor,`+223701${vendor.slice(0,6)}`,transporter,`+223702${transporter.slice(0,6)}`]
    );
    await q(`INSERT INTO vendors(id,shop_name,slug) VALUES($1,'V13 Shop',$2)`,[vendor,`v13-${vendor}`]);
    await q(`INSERT INTO transporters(id) VALUES($1)`,[transporter]);
    await q(
      `INSERT INTO user_addresses(id,user_id,recipient_name,phone,address_line,city,country)
       VALUES($1,$2,'V13 Buyer','+223700000000','Test address','Bamako','ML')`,
      [address,buyer]
    );
    await q(
      `INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status)
       VALUES($1,$2,'V13 Product',$3,100000,1,'active')`,
      [product,vendor,`v13-${product}`]
    );
    await q(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id)
       VALUES($1,$2,$3,'paid',100000,2000,102000,'XOF',$4)`,
      [order,buyer,vendor,address]
    );
    await q(
      `INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price)
       VALUES($1,$2,1,100000,100000)`,
      [order,product]
    );
    await q(
      `INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at)
       VALUES($1,$2,$3,$4,100000,2000,'funded',now())`,
      [escrow,order,buyer,vendor]
    );
    await q(
      `INSERT INTO shipments(id,order_id,transporter_id,status,tracking_code)
       VALUES($1,$2,$3,'in_transit',$4)`,
      [shipment,order,transporter,`V13-${shipment}`]
    );

    const clearing=await account('partner_clearing_xof');
    const customer=await account('livi_customer_liability_xof');
    const shipping=await account('livi_shipping_payable_xof');
    const vendorPayable=await account('livi_vendor_payable_xof');
    const transporterPayable=await account('livi_transporter_payable_xof');
    const fee=await account('livi_fee_revenue_xof');

    await ledger(`V13-PAY-${uid()}`,[
      {account:clearing,amount:xof(102000)},
      {account:customer,amount:-xof(100000)},
      {account:shipping,amount:-xof(2000)}
    ]);

    // Guard test: release before buyer proof must fail.
    await q(`SAVEPOINT before_bad_release`);
    await q(`UPDATE escrow_transactions SET status='released',released_at=now() WHERE id=$1`,[escrow]);
    let guardWorked=false;
    try {
      await q(`SET CONSTRAINTS escrow_release_delivery_guard IMMEDIATE`);
    } catch {
      guardWorked=true;
      await q(`ROLLBACK TO SAVEPOINT before_bad_release`);
    }
    if (!guardWorked) throw new Error('V13 guard failed: escrow released without delivery proof');

    // Create and consume the actual buyer proof.
    process.env.LIVI_PROOF_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('base64');
    const { createProofs, consumeProof } = await import('../src/services/deliveryProof.js');
    const proofs = await createProofs(client, shipment);
    await consumeProof(client,{
      shipmentId:shipment,
      proofType:'buyer_delivery',
      credential:proofs.buyer_delivery.qrPayload,
      actorId:transporter,
      requestId:'v13-test',
      ip:'127.0.0.1',
      userAgent:'v13-test'
    });
    await q(
      `UPDATE shipments SET status='delivered',delivered_at=now(),delivery_proof_used_at=now() WHERE id=$1`,
      [shipment]
    );

    const vendorCommission=5000;
    await ledger(`V13-RELEASE-${uid()}`,[
      {account:customer,amount:xof(100000)},
      {account:vendorPayable,amount:-xof(95000),owner_user_id:vendor},
      {account:fee,amount:-xof(vendorCommission)}
    ]);
    await ledger(`V13-SHIPPING-${uid()}`,[
      {account:shipping,amount:xof(2000)},
      {account:transporterPayable,amount:-xof(2000),owner_user_id:transporter}
    ]);
    await q(`UPDATE escrow_transactions SET status='released',released_at=now() WHERE id=$1`,[escrow]);
    await q(`UPDATE orders SET status='completed',delivered_at=now(),updated_at=now() WHERE id=$1`,[order]);

    // Transporter withdrawal: 2,000 gross, 5% fee = 100, 1,900 net.
    const withdrawalFee=100, net=1900;
    await ledger(`V13-PAYOUT-${uid()}`,[
      {account:transporterPayable,amount:xof(2000),owner_user_id:transporter},
      {account:fee,amount:-xof(withdrawalFee)},
      {account:clearing,amount:-xof(net)}
    ]);

    const escrowRow=(await q(`SELECT status FROM escrow_transactions WHERE id=$1`,[escrow]))[0];
    const proofRow=(await q(`SELECT used_at FROM shipment_proofs WHERE shipment_id=$1 AND proof_type='buyer_delivery'`,[shipment]))[0];
    const totals=(await q(
      `SELECT COALESCE(SUM(le.amount),0)::bigint AS total
       FROM ledger_entries le
       JOIN ledger_transactions lt ON lt.id=le.transaction_id
       WHERE lt.metadata->>'scenario'='v13'`
    ))[0];

    if (escrowRow.status!=='released') throw new Error('Escrow not released');
    if (!proofRow.used_at) throw new Error('Buyer proof not consumed');
    if (BigInt(totals.total)!==0n) throw new Error(`Scenario ledger not balanced: ${totals.total}`);

    console.log(JSON.stringify({
      scenario:'V13',
      order_id:order,
      escrow_status:escrowRow.status,
      buyer_delivery_proof:'consumed',
      product_amount_xof:100000,
      shipping_amount_xof:2000,
      vendor_payable_xof:95000,
      transporter_payable_xof:2000,
      transporter_withdrawal_fee_xof:100,
      transporter_net_xof:1900,
      ledger_scenario_total:0
    },null,2));

    await client.query('ROLLBACK');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
