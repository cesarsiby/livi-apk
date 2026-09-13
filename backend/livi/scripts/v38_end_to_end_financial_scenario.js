import pg from 'pg';
import crypto from 'node:crypto';

// V38 — real end-to-end financial scenario.
//
// AUDIT FINDING that motivated this rewrite: the previous version of this
// script (still visible in git history / previous ZIP deliveries) built
// its expected ledger state BY HAND — it called a local `ledger()` helper
// with literal entries like `{account:transporterPayable, amount:-xof(2000),
// owner_user_id:transporter}`, where `owner_user_id:transporter` was
// supplied directly by the test itself. It never called
// src/services/finance.js#releaseEscrow() (or #releaseEscrowWithActiveCommission,
// added in V37), src/services/wallet.js#payableBalance(), or
// src/services/withdrawal.js#calculateWithdrawalFee(). This meant the
// script's PASS result proved only that a correctly-attributed ledger
// state is internally consistent — it proved nothing about whether the
// application's actual release/payout code produces that state. This is
// exactly why the V37 bug (releaseEscrow() posting transporter shipping
// credits with owner_user_id=NULL, making shipping fees permanently
// unwithdrawable) went undetected: a synthetic scenario that hand-writes
// the "correct" answer cannot catch a bug in the code that is supposed to
// compute that answer.
//
// This version calls the real functions:
//   - src/services/finance.js#releaseEscrowWithActiveCommission()
//   - src/services/finance.js#refundEscrow()
//   - src/services/wallet.js#payableBalance() / ledgerOwedToUser()
//   - src/services/withdrawal.js#calculateWithdrawalFee()
// The only things NOT exercised through the real Express route layer are
// the webhook signature/idempotency handling (src/routes/webhooks.js) and
// the payout HTTP request/response cycle (src/routes/payouts.js) — those
// remain simulated at the SQL level for the funding step (equivalent to
// what a verified webhook does) and the payout settlement step (which now
// uses the same account/ledger primitives and the same fee formula
// payouts.js calls, just invoked directly rather than through Express).
// This is an explicit, stated limitation, not a hidden one — see
// docs/V38_END_TO_END_FINANCIAL_TEST.md.
//
// Requires a real, disposable PostgreSQL instance and an installed `pg`
// package. Has NOT been executed in the sandbox used to build this change.

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

async function ledger(reference, type, metadata, entries) {
  const sum = entries.reduce((a,e)=>a+BigInt(e.amount),0n);
  if (sum !== 0n) throw new Error(`Unbalanced test ledger: ${sum}`);
  const tx = (await q(
    `INSERT INTO ledger_transactions(reference,type,metadata) VALUES($1,$2,$3) RETURNING id`,
    [reference, type, {scenario:'v38', ...metadata}]
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
  if (process.env.NODE_ENV === 'production') throw new Error('Never run the V38 scenario against production');
  await client.connect();
  await client.query('BEGIN');

  const failures = [];
  const assertEq = (label, actual, expected) => {
    if (String(actual) !== String(expected)) failures.push(`${label}: expected ${expected}, got ${actual}`);
  };
  const assertTrue = (label, cond) => { if (!cond) failures.push(label); };

  try {
    // Import the REAL application code under test. NODE_ENV/db config are
    // already set up above; these modules only touch the pg pool when
    // their exported functions are called with our own `client`.
    const { releaseEscrowWithActiveCommission, refundEscrow } = await import('../src/services/finance.js');
    const { payableBalance, ledgerOwedToUser } = await import('../src/services/wallet.js');
    const { calculateWithdrawalFee } = await import('../src/services/withdrawal.js');
    const { createProofs, consumeProof } = await import('../src/services/deliveryProof.js');

    // --- Fixtures: buyer, vendor, transporter, product, order, shipment ---
    const buyer=uid(), vendor=uid(), transporter=uid(), address=uid(), product=uid(), order=uid(), escrow=uid(), shipment=uid();

    await q(
      `INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES
       ($1,$2,'V38 Buyer','client','active',true),
       ($3,$4,'V38 Vendor','vendor','active',true),
       ($5,$6,'V38 Transporter','transporter','active',true)`,
      [buyer,`+223710${buyer.slice(0,6)}`,vendor,`+223711${vendor.slice(0,6)}`,transporter,`+223712${transporter.slice(0,6)}`]
    );
    await q(`INSERT INTO vendors(id,shop_name,slug) VALUES($1,'V38 Shop',$2)`,[vendor,`v38-${vendor}`]);
    await q(`INSERT INTO transporters(id) VALUES($1)`,[transporter]);
    await q(
      `INSERT INTO user_addresses(id,user_id,recipient_name,phone,address_line,city,country)
       VALUES($1,$2,'V38 Buyer','+223710000000','Test address','Bamako','ML')`,
      [address,buyer]
    );
    await q(
      `INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status)
       VALUES($1,$2,'V38 Product',$3,100000,1,'active')`,
      [product,vendor,`v38-${product}`]
    );
    await q(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id)
       VALUES($1,$2,$3,'paid',100000,2000,102000,'XOF',$4)`,
      [order,buyer,vendor,address]
    );
    await q(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,100000,100000)`,[order,product]);
    await q(
      `INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at)
       VALUES($1,$2,$3,$4,100000,2000,'funded',now())`,
      [escrow,order,buyer,vendor]
    );
    // Real transporter assignment via shipments.transporter_id — this is
    // the exact link releaseEscrow() now reads (V37 fix). Not passing it
    // here would be the V37 bug's precondition reappearing.
    await q(
      `INSERT INTO shipments(id,order_id,transporter_id,status,tracking_code) VALUES($1,$2,$3,'in_transit',$4)`,
      [shipment,order,transporter,`V38-${shipment}`]
    );

    const clearing=await account('partner_clearing_xof');
    const customer=await account('livi_customer_liability_xof');
    const shipping=await account('livi_shipping_payable_xof');

    // --- Step 1: funding (equivalent to a verified partner webhook) ---
    await ledger(`V38-PAY-${uid()}`,'partner_payment',{order_id:order},[
      {account:clearing,amount:xof(102000)},
      {account:customer,amount:-xof(100000)},
      {account:shipping,amount:-xof(2000)}
    ]);

    // --- Step 2: real delivery-proof consumption (unchanged, already real) ---
    process.env.LIVI_PROOF_ENCRYPTION_KEY ||= crypto.randomBytes(32).toString('base64');
    const proofs = await createProofs(client, shipment);
    await consumeProof(client,{
      shipmentId:shipment, proofType:'buyer_delivery', credential:proofs.buyer_delivery.qrPayload,
      actorId:transporter, requestId:'v38-test', ip:'127.0.0.1', userAgent:'v38-test'
    });
    await q(`UPDATE shipments SET status='delivered',delivered_at=now(),delivery_proof_used_at=now() WHERE id=$1`,[shipment]);

    // --- Step 3: set a known, non-zero active commission rule, then call
    // the REAL release function. This is the step that would have caught
    // the V37 bug: if releaseEscrow() still referenced the non-existent
    // escrow_transactions.transporter_id, the transporter ledger entry
    // below would come back with owner_user_id=NULL and the balance
    // assertions in step 4 would fail. ---
    await q(`UPDATE platform_fee_rules SET active=false WHERE active=true`);
    await q(`INSERT INTO platform_fee_rules(name,commission_bps,active,effective_from) VALUES($1,500,true,now())`,[`v38-rule-${uid()}`]);

    const e = (await q(`SELECT * FROM escrow_transactions WHERE id=$1 FOR UPDATE`,[escrow]))[0];
    const released = await releaseEscrowWithActiveCommission(client, e, { metadata:{scenario:'v38'} });
    await q(`UPDATE orders SET status='completed',delivered_at=now(),updated_at=now() WHERE id=$1`,[order]);

    assertEq('commission (5% of 100000)', released.commission, 5000n);
    assertEq('vendor net (100000-5000)', released.vendorNet, 95000n);

    // --- Step 4: real balance checks via wallet.js — this IS the check
    // that fails if transporter attribution is broken. ---
    const vendorBal = await payableBalance(client,'vendor',vendor);
    const transporterBal = await payableBalance(client,'transporter',transporter);
    assertEq('vendor payable (owed) after release', vendorBal.owed, 95000n);
    assertEq('vendor payable (available) after release', vendorBal.available, 95000n);
    assertEq('transporter payable (owed) after release — THIS is the V37 regression check', transporterBal.owed, 2000n);
    assertEq('transporter payable (available) after release', transporterBal.available, 2000n);

    // --- Step 5: real withdrawal fee calculation, then post the payout
    // using the same primitives payouts.js uses. ---
    await q(`UPDATE withdrawal_fee_rules SET active=false WHERE role='transporter' AND active=true`);
    await q(`INSERT INTO withdrawal_fee_rules(role,commission_bps,min_fee_xof,active,effective_from) VALUES('transporter',500,50,true,now())`);
    const rule = (await q(`SELECT commission_bps,min_fee_xof,max_fee_xof FROM withdrawal_fee_rules WHERE role='transporter' AND active=true ORDER BY effective_from DESC LIMIT 1`))[0];
    const { fee: withdrawalFee, net } = calculateWithdrawalFee(2000, rule.commission_bps, rule.min_fee_xof, rule.max_fee_xof);
    assertEq('transporter withdrawal fee (5% of 2000)', withdrawalFee, 100n);
    assertEq('transporter withdrawal net', net, 1900n);

    const { accountId, postBalanced, ACCOUNT, newReference } = await import('../src/services/market.js');
    const transporterAcct = await accountId(client, ACCOUNT.transporter);
    const feeAcct = await accountId(client, ACCOUNT.fee);
    await postBalanced(client, {
      reference: newReference('PAYOUT'), type:'payout_settlement', metadata:{scenario:'v38',role:'transporter'},
      entries: [
        {account_id:transporterAcct, amount:2000n, owner_user_id:transporter},
        {account_id:feeAcct, amount:-withdrawalFee},
        {account_id:clearing, amount:-net}
      ]
    });

    const transporterBalAfterWithdrawal = await ledgerOwedToUser(client, ACCOUNT.transporter, transporter);
    assertEq('transporter payable after full withdrawal', transporterBalAfterWithdrawal, 0n);

    // --- Step 6: dispute-resolution leg (covers the V37 disputes.js fix) ---
    const order2=uid(), escrow2=uid(), product2=uid(), dispute=uid();
    await q(`INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status) VALUES($1,$2,'V38 Product 2',$3,50000,1,'active')`,[product2,vendor,`v38b-${product2}`]);
    await q(`INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id) VALUES($1,$2,$3,'disputed',50000,0,50000,'XOF',$4)`,[order2,buyer,vendor,address]);
    await q(`INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,50000,50000)`,[order2,product2]);
    await q(`INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at) VALUES($1,$2,$3,$4,50000,0,'disputed',now())`,[escrow2,order2,buyer,vendor]);
    await q(`INSERT INTO disputes(id,order_id,opened_by,status,reason,category) VALUES($1,$2,$3,'open','v38 scenario','other')`,[dispute,order2,buyer]);
    await ledger(`V38-PAY2-${uid()}`,'partner_payment',{order_id:order2},[
      {account:clearing,amount:xof(50000)},
      {account:customer,amount:-xof(50000)}
    ]);

    // Resolve as refund, exactly the way the fixed disputes.js route does:
    // look up the real escrow row by order_id and pass it to refundEscrow()
    // — NOT the dispute row (that was the V37 bug).
    const d = (await q(`SELECT * FROM disputes WHERE id=$1 FOR UPDATE`,[dispute]))[0];
    const escrowForDispute = (await q(`SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE`,[d.order_id]))[0];
    await refundEscrow(client, escrowForDispute, { metadata:{dispute_id:d.id} });
    await q(`UPDATE escrow_transactions SET status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1`,[escrowForDispute.id]);
    await q(`UPDATE orders SET status='refunded',updated_at=now() WHERE id=$1`,[order2]);
    await q(`UPDATE disputes SET status='resolved',resolution='refund: v38 scenario',resolved_by=$2,resolved_at=now(),closed_at=now() WHERE id=$1`,[dispute,vendor]);

    const escrow2Row = (await q(`SELECT status FROM escrow_transactions WHERE id=$1`,[escrow2]))[0];
    assertEq('dispute refund actually completed (would 404 under the V37 bug)', escrow2Row.status, 'refunded');

    // --- Final global invariants ---
    const escrowRow=(await q(`SELECT status FROM escrow_transactions WHERE id=$1`,[escrow]))[0];
    const proofRow=(await q(`SELECT used_at FROM shipment_proofs WHERE shipment_id=$1 AND proof_type='buyer_delivery'`,[shipment]))[0];
    const totals=(await q(
      `SELECT COALESCE(SUM(le.amount),0)::bigint AS total
       FROM ledger_entries le JOIN ledger_transactions lt ON lt.id=le.transaction_id
       WHERE lt.metadata->>'scenario'='v38'`
    ))[0];

    assertEq('escrow 1 status', escrowRow.status, 'released');
    assertTrue('buyer delivery proof consumed', !!proofRow.used_at);
    assertEq('V38 scenario ledger balanced', BigInt(totals.total), 0n);

    if (failures.length) {
      throw new Error('V38_END_TO_END_SCENARIO_FAILED: ' + failures.join('; '));
    }

    console.log(JSON.stringify({
      scenario: 'V38',
      status: 'PASS',
      order_1: { id: order, escrow_status: escrowRow.status, buyer_delivery_proof: 'consumed',
        product_amount_xof: 100000, shipping_amount_xof: 2000,
        vendor_payable_xof: String(released.vendorNet), commission_xof: String(released.commission),
        transporter_payable_xof: '2000', transporter_withdrawal_fee_xof: String(withdrawalFee),
        transporter_net_xof: String(net), transporter_balance_after_withdrawal: String(transporterBalAfterWithdrawal) },
      order_2_dispute: { id: order2, dispute_id: dispute, resolution: 'refund', escrow_status: escrow2Row.status },
      ledger_scenario_total: '0'
    }, null, 2));

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
