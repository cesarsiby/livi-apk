import pg from 'pg';
import crypto from 'node:crypto';

// V40 — real PostgreSQL regression test for the admin financial-correction
// workflow (mission section 10).
//
// AUDIT FINDING this proves: src/routes/admin.js used `req.user.id`
// throughout every financial-correction endpoint, but JWT access tokens
// only carry a `sub` claim (src/services/auth.js) — `req.user.id` was
// always `undefined`. src/services/financialCorrections.js#openCorrection()
// (and approve/reject/executeCustomerCompensation) pass that value
// straight into a parameterized INSERT with no `||null` fallback, and
// node-postgres rejects `undefined` bound parameters outright. Every one
// of these endpoints crashed with a 500 on every call — the entire
// correction workflow (anomalie -> dossier -> approbation -> exécution)
// was non-functional. Fixed by using req.user.sub, consistent with every
// other route in the codebase.
//
// This script demonstrates both sides: (1) the exact old failure mode,
// reproduced directly against openCorrection() with an undefined actor,
// so a future regression of this class is caught immediately and loudly;
// (2) the real, fixed workflow succeeding end-to-end — open, attempted
// self-approval rejected (separation of duties), approval by a different
// admin, execution, and the resulting compensating ledger entry.
//
// Requires a real, disposable PostgreSQL instance and an installed `pg`
// package. Has NOT been executed in the sandbox used to build this change
// — see docs/V40_ADMIN_API_AUDIT.md.

const { Client } = pg;
if (process.env.NODE_ENV === 'production') throw new Error('Never run this regression script against production');

const cfg = {
  connectionString: process.env.DATABASE_URL || `postgres://${process.env.PGUSER || 'livi'}:${process.env.PGPASSWORD || 'livi_test_only'}@${process.env.PGHOST || '127.0.0.1'}:${process.env.PGPORT || 5433}/${process.env.PGDATABASE || 'livi_test'}`
};

const client = new Client(cfg);
const uid = () => crypto.randomUUID();
const failures = [];
const assertTrue = (label, cond) => { if (!cond) failures.push(label); };

async function main() {
  await client.connect();
  await client.query('BEGIN');

  const { openCorrection, approveCorrection, rejectCorrection, executeCustomerCompensation } =
    await import('../src/services/financialCorrections.js');

  try {
    // --- Part 1: reproduce the exact old bug directly against the real
    // service function, proving what req.user.id (undefined) did. ---
    let oldBugReproduced = false;
    try {
      await openCorrection(client, {
        caseType: 'manual_adjustment',
        reason: 'V40 regression: simulating req.user.id (undefined)',
        createdBy: undefined // <- exactly what `req.user.id` evaluated to
      });
    } catch (e) {
      // node-postgres throws a plain Error (not a pg error code) for
      // undefined bound parameters — message contains "undefined".
      oldBugReproduced = /undefined/i.test(e.message);
    }
    assertTrue('old bug reproduced: openCorrection(..., {createdBy: undefined}) throws', oldBugReproduced);

    // --- Part 2: the real, fixed workflow, exactly as the corrected
    // admin.js now drives it (req.user.sub for every actor). ---
    const adminA = uid(), adminB = uid(), buyer = uid(), address = uid(), order = uid();
    await client.query(
      `INSERT INTO users(id,phone,name,role,status,phone_verified) VALUES
       ($1,$2,'V40 Admin A','admin','active',true),
       ($3,$4,'V40 Admin B','admin','active',true),
       ($5,$6,'V40 Buyer','client','active',true)`,
      [adminA,`+223720${adminA.slice(0,6)}`,adminB,`+223721${adminB.slice(0,6)}`,buyer,`+223722${buyer.slice(0,6)}`]
    );
    await client.query(
      `INSERT INTO user_addresses(id,user_id,recipient_name,phone,address_line,city,country)
       VALUES($1,$2,'V40 Buyer','+223722000000','Test address','Bamako','ML')`,
      [address,buyer]
    );
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id)
       VALUES($1,$2,$2,'paid',15000,0,15000,'XOF',$3)`,
      [order,buyer,address]
    );

    // Open — exactly as the fixed POST /admin/reconciliation/corrections does.
    const opened = await openCorrection(client, {
      orderId: order,
      caseType: 'missing_in_livi',
      proposedAmount: 15000,
      reason: 'V40 regression: partner shows a settled payment LIVI never recorded',
      createdBy: adminA
    });
    assertTrue('case opened with correct created_by', opened.created_by === adminA);
    assertTrue('case status is open', opened.status === 'open');

    // Self-approval must be rejected (separation of duties, mission section 10).
    let selfApprovalRejected = false;
    try {
      await approveCorrection(client, { caseId: opened.id, actorId: adminA, reason: 'trying to self-approve' });
    } catch (e) {
      selfApprovalRejected = e.code === 'CORRECTION_SEPARATION_OF_DUTIES';
    }
    assertTrue('creator cannot approve their own correction', selfApprovalRejected);

    // A different admin approves.
    const approved = await approveCorrection(client, { caseId: opened.id, actorId: adminB, reason: 'confirmed against partner statement' });
    assertTrue('case approved by a different admin', approved.status === 'approved' && approved.approved_by === adminB);

    // Execute the compensation.
    const executed = await executeCustomerCompensation(client, { caseId: opened.id, actorId: adminB });
    assertTrue('case executed', executed.status === 'executed' && executed.executed_by === adminB);

    const action = (await client.query(
      `SELECT action_type, actor_user_id FROM financial_correction_actions WHERE case_id=$1 ORDER BY created_at`,
      [opened.id]
    )).rows;
    assertTrue('all four action rows recorded with a real actor (open/approve/execute — reject not exercised in this path)',
      action.every(a => !!a.actor_user_id));
    assertTrue('action sequence is open -> approve -> execute',
      JSON.stringify(action.map(a=>a.action_type)) === JSON.stringify(['open','approve','execute']));

    const ledgerTotal = (await client.query(
      `SELECT coalesce(sum(le.amount),0)::bigint total
       FROM ledger_entries le JOIN ledger_transactions lt ON lt.id=le.transaction_id
       WHERE lt.type='partner_reconciliation_compensation' AND lt.metadata->>'case_id'=$1`,
      [opened.id]
    )).rows[0];
    assertTrue('compensation ledger transaction is balanced', String(ledgerTotal.total) === '0');

    // --- Part 3: reject path on a second case. ---
    const order2 = uid();
    await client.query(
      `INSERT INTO orders(id,buyer_id,vendor_id,status,subtotal_amount,shipping_fee,total_amount,currency,delivery_address_id)
       VALUES($1,$2,$2,'paid',5000,0,5000,'XOF',$3)`,
      [order2,buyer,address]
    );
    const opened2 = await openCorrection(client, {
      orderId: order2, caseType: 'unknown_reference',
      reason: 'V40 regression: reject path', createdBy: adminA
    });
    const rejected = await rejectCorrection(client, { caseId: opened2.id, actorId: adminB, reason: 'not a valid claim' });
    assertTrue('case rejected', rejected.status === 'rejected');

    // --- Part 4: DB-level guard (migration 031) rejects a NULL actor
    // directly, independent of application code. ---
    let dbGuardRejected = false;
    try {
      await client.query(
        `INSERT INTO financial_correction_cases(case_type,reason,created_by) VALUES('manual_adjustment','V40 direct NULL actor test',NULL)`
      );
    } catch (e) {
      dbGuardRejected = /null value in column "created_by"/i.test(e.message) || e.code === '23502';
    }
    assertTrue('migration 031 NOT NULL guard rejects a directly-inserted NULL created_by', dbGuardRejected);

    if (failures.length) {
      throw new Error('V40_ADMIN_CORRECTION_WORKFLOW_FAILED: ' + failures.join('; '));
    }

    console.log(JSON.stringify({
      suite: 'V40-admin-correction-workflow',
      status: 'PASS',
      old_bug_reproduced_and_confirmed: true,
      fixed_workflow: { opened: opened.id, approved_by: adminB, executed: true, rejected_case: rejected.id },
      db_guard_confirmed: true
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
