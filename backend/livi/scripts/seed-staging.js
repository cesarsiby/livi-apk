import pg from 'pg';
import crypto from 'node:crypto';

// V45 — staging seed data: "données de test réalistes mais non sensibles".
//
// Populates a fresh staging database with a small, clearly-fake dataset
// spanning the order lifecycle (an order still awaiting payment, one
// funded and in preparation, one delivered/completed with a released
// escrow crediting both a vendor and a transporter, and one cancelled
// with stock correctly restored) — enough for a QA person or a frontend
// developer to click around a staging environment and see something other
// than an empty database, without ever touching real user data.
//
// Every name, phone number, and address below is obviously synthetic
// (prefixed "Staging", using the +223-00-xxxxxx reserved-looking pattern,
// fictional street names). Nothing here is a real person, a real phone
// number, or a real financial instrument. Refuses to run if NODE_ENV is
// production or if the target database name doesn't look like a test/
// staging database, as a safety net against accidentally seeding a real
// environment.
//
// Requires a real, disposable/staging PostgreSQL instance and an
// installed `pg` package. Has NOT been executed in the sandbox used to
// build this change — see docs/V45_STAGING_ENVIRONMENT.md.

const { Client } = pg;

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to run scripts/seed-staging.js with NODE_ENV=production');
}

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_staging'}`
};

if (!/staging|test|dev/i.test(cfg.connectionString)) {
  throw new Error(
    `Refusing to seed a database whose connection string does not look like staging/test/dev: ${cfg.connectionString.replace(/:[^:@]+@/, ':***@')}. ` +
    `Set DATABASE_URL to an explicitly-named staging database to proceed.`
  );
}

const client = new Client(cfg);
const uid = () => crypto.randomUUID();
const shortId = () => uid().replace(/-/g, '').slice(0, 8);

async function main() {
  await client.connect();
  await client.query('BEGIN');

  try {
    const admin = uid(), vendorA = uid(), vendorB = uid(), transporterA = uid();
    const buyerA = uid(), buyerB = uid(), buyerC = uid();

    const users = [
      [admin, `+22300${shortId().slice(0,6)}`, 'Staging Admin', 'admin'],
      [vendorA, `+22370${shortId().slice(0,6)}`, 'Staging Boutique Bamako', 'vendor'],
      [vendorB, `+22371${shortId().slice(0,6)}`, 'Staging Marché Sikasso', 'vendor'],
      [transporterA, `+22372${shortId().slice(0,6)}`, 'Staging Coursier Moussa', 'transporter'],
      [buyerA, `+22373${shortId().slice(0,6)}`, 'Staging Acheteur Aïcha', 'client'],
      [buyerB, `+22374${shortId().slice(0,6)}`, 'Staging Acheteur Ibrahim', 'client'],
      [buyerC, `+22375${shortId().slice(0,6)}`, 'Staging Acheteur Fatoumata', 'client']
    ];
    for (const [id, phone, name, role] of users) {
      await client.query(
        `INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES($1,$2,$3,$4,'active',true)
         ON CONFLICT (phone) DO NOTHING`,
        [id, phone, name, role]
      );
    }

    const addressA = uid(), addressB = uid(), addressC = uid();
    const addresses = [
      [addressA, buyerA, 'Domicile', 'Staging Acheteur Aïcha', 'Rue 42, Quartier Hippodrome', 'Bamako'],
      [addressB, buyerB, 'Bureau', 'Staging Acheteur Ibrahim', 'Avenue de la Paix, Zone Industrielle', 'Bamako'],
      [addressC, buyerC, 'Domicile', 'Staging Acheteur Fatoumata', 'Rue 118, Quartier Missira', 'Sikasso']
    ];
    for (const [id, userId, label, recipient, line, city] of addresses) {
      await client.query(
        `INSERT INTO user_addresses(id,user_id,label,recipient_name,phone,address_line,city,is_default)
         VALUES($1,$2,$3,$4,'+22300000000',$5,$6,true) ON CONFLICT (id) DO NOTHING`,
        [id, userId, label, recipient, line, city]
      );
    }

    const products = [
      [uid(), vendorA, 'Staging — Pagne Bogolan 6 yards', 15000, 12],
      [uid(), vendorA, 'Staging — Sandales cuir artisanales', 8000, 20],
      [uid(), vendorA, 'Staging — Sac à main tissé', 12000, 7],
      [uid(), vendorB, 'Staging — Sac de riz local 25kg', 22000, 30],
      [uid(), vendorB, 'Staging — Huile de karité 1L', 4500, 40],
      [uid(), vendorB, 'Staging — Épices assorties (lot)', 3000, 50]
    ];
    for (const [id, vendorId, name, price, stock] of products) {
      await client.query(
        `INSERT INTO products(id,vendor_id,name,slug,price_xof,stock,status)
         VALUES($1,$2,$3,$4,$5,$6,'active') ON CONFLICT (id) DO NOTHING`,
        [id, vendorId, name, `staging-${id}`, price, stock]
      );
    }
    const [pagne, sandales, sac, riz, karite, epices] = products;

    // --- Order 1: pending payment (never funded) ---
    const order1 = uid();
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id)
       VALUES($1,$2,$3,'pending_payment',$4,1500,$5,'XOF',$6) ON CONFLICT (id) DO NOTHING`,
      [order1, buyerA, vendorA, pagne[3], Number(pagne[3]) + 1500, addressA]
    );
    await client.query(
      `INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,$3,$3)
       ON CONFLICT DO NOTHING`,
      [order1, pagne[0], pagne[3]]
    );

    // --- Order 2: paid, escrow funded, preparing (mid-flow) ---
    const order2 = uid(), escrow2 = uid();
    const order2Total = Number(sandales[3]) * 2 + 1500;
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id,paid_at)
       VALUES($1,$2,$3,'preparing',$4,1500,$5,'XOF',$6,now()) ON CONFLICT (id) DO NOTHING`,
      [order2, buyerB, vendorA, Number(sandales[3]) * 2, order2Total, addressB]
    );
    await client.query(
      `INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,2,$3,$3*2)
       ON CONFLICT DO NOTHING`,
      [order2, sandales[0], sandales[3]]
    );
    await client.query(
      `INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at)
       VALUES($1,$2,$3,$4,$5,1500,'funded',now()) ON CONFLICT (id) DO NOTHING`,
      [escrow2, order2, buyerB, vendorA, Number(sandales[3]) * 2]
    );

    // --- Order 3: delivered + completed, escrow released to vendor and
    // transporter — the fullest realistic end state.
    const order3 = uid(), escrow3 = uid(), shipment3 = uid();
    const order3Total = Number(riz[3]) + 2000;
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id,paid_at,delivered_at)
       VALUES($1,$2,$3,'completed',$4,2000,$5,'XOF',$6,now()-interval '2 days',now()-interval '1 day') ON CONFLICT (id) DO NOTHING`,
      [order3, buyerC, vendorB, riz[3], order3Total, addressC]
    );
    await client.query(
      `INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,$3,$3)
       ON CONFLICT DO NOTHING`,
      [order3, riz[0], riz[3]]
    );
    await client.query(
      `INSERT INTO shipments(id,order_id,transporter_id,status,tracking_code,pickup_at,delivered_at)
       VALUES($1,$2,$3,'delivered',$4,now()-interval '1 day 6 hours',now()-interval '1 day') ON CONFLICT (id) DO NOTHING`,
      [shipment3, order3, transporterA, `STG-${shortId().toUpperCase()}`]
    );
    await client.query(
      `INSERT INTO escrow_transactions(id,order_id,buyer_id,vendor_id,amount,shipping_fee,status,funded_at,released_at,commission_bps,commission_amount,vendor_net_amount)
       VALUES($1,$2,$3,$4,$5,2000,'released',now()-interval '2 days',now()-interval '1 day',500,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [escrow3, order3, buyerC, vendorB, riz[3], Math.round(Number(riz[3]) * 0.05), Number(riz[3]) - Math.round(Number(riz[3]) * 0.05)]
    );
    // Real, attributed ledger postings for order 3 (mirrors what
    // releaseEscrowWithActiveCommission() actually produces in production
    // — written directly here since this is a one-shot data fixture, not
    // an HTTP/service-layer integration test).
    const { accountId, postBalanced, ACCOUNT, newReference } = await import('../src/services/market.js');
    const commission = Math.round(Number(riz[3]) * 0.05);
    const vendorNet = Number(riz[3]) - commission;
    await postBalanced(client, {
      reference: newReference('STAGING-PAY'), type: 'dev_partner_payment', metadata: { order_id: order3 },
      entries: [
        { account_id: await accountId(client, ACCOUNT.clearing), amount: order3Total },
        { account_id: await accountId(client, ACCOUNT.customer), amount: -Number(riz[3]) },
        { account_id: await accountId(client, ACCOUNT.shipping), amount: -2000 }
      ]
    });
    await postBalanced(client, {
      reference: newReference('STAGING-REL'), type: 'escrow_release', metadata: { order_id: order3 },
      entries: [
        { account_id: await accountId(client, ACCOUNT.customer), amount: Number(riz[3]), owner_user_id: buyerC },
        { account_id: await accountId(client, ACCOUNT.vendor), amount: -vendorNet, owner_user_id: vendorB },
        { account_id: await accountId(client, ACCOUNT.fee), amount: -commission }
      ]
    });
    await postBalanced(client, {
      reference: newReference('STAGING-SHIP'), type: 'shipping_release', metadata: { order_id: order3 },
      entries: [
        { account_id: await accountId(client, ACCOUNT.shipping), amount: 2000 },
        { account_id: await accountId(client, ACCOUNT.transporter), amount: -2000, owner_user_id: transporterA }
      ]
    });

    // --- Order 4: cancelled before shipment, stock correctly restored ---
    const order4 = uid();
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id,cancelled_at,cancelled_reason,stock_restored_at)
       VALUES($1,$2,$3,'cancelled',$4,0,$4,'XOF',$5,now()-interval '3 hours','Staging: acheteur a changé d''avis',now()-interval '3 hours')
       ON CONFLICT (id) DO NOTHING`,
      [order4, buyerA, vendorB, karite[3], addressA]
    );
    await client.query(
      `INSERT INTO order_items(order_id,product_id,quantity,unit_price,total_price) VALUES($1,$2,1,$3,$3)
       ON CONFLICT DO NOTHING`,
      [order4, karite[0], karite[3]]
    );

    await client.query('COMMIT');

    console.log(JSON.stringify({
      suite: 'V45-seed-staging',
      status: 'SEEDED',
      users: users.length,
      products: products.length,
      orders: { pending_payment: order1, preparing_funded: order2, completed_released: order3, cancelled: order4 }
    }, null, 2));
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
