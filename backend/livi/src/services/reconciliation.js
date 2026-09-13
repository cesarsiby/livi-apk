import { HttpError } from '../utils/http.js';

/** Read-only reconciliation checks. */
export async function reconcileLedger(c) {
  const { rows } = await c.query(`
    SELECT lt.id, lt.reference, lt.type,
           COALESCE(SUM(le.amount),0)::text AS net
    FROM ledger_transactions lt
    LEFT JOIN ledger_entries le ON le.transaction_id=lt.id
    GROUP BY lt.id, lt.reference, lt.type
    HAVING COALESCE(SUM(le.amount),0) <> 0
    ORDER BY lt.created_at DESC
  `);
  return rows;
}

export async function reconcileEscrows(c) {
  const { rows } = await c.query(`
    SELECT e.id, e.order_id, e.status,
           e.amount::text, e.shipping_fee::text,
           o.status AS order_status
    FROM escrow_transactions e
    JOIN orders o ON o.id=e.order_id
    WHERE e.buyer_id IS DISTINCT FROM o.buyer_id
       OR e.vendor_id IS DISTINCT FROM o.vendor_id
       OR (e.status='released' AND o.status <> 'completed')
       OR (e.status='funded' AND o.status IN ('completed','refunded','cancelled'))
  `);
  return rows;
}

export async function reconcileFinancialAttribution(c) {
  const mismatches = [];
  const payable = await c.query(`
    SELECT lt.id, lt.reference, a.code, le.owner_user_id,
           CASE WHEN a.code='livi_vendor_payable_xof' THEN e.vendor_id
                WHEN a.code='livi_transporter_payable_xof' THEN s.transporter_id END AS expected_owner
    FROM ledger_entries le
    JOIN ledger_transactions lt ON lt.id=le.transaction_id
    JOIN ledger_accounts a ON a.id=le.account_id
    LEFT JOIN escrow_transactions e ON e.order_id = NULLIF(lt.metadata->>'order_id','')::uuid
    LEFT JOIN shipments s ON s.order_id = NULLIF(lt.metadata->>'order_id','')::uuid
    WHERE a.code IN ('livi_vendor_payable_xof','livi_transporter_payable_xof')
      AND le.owner_user_id IS DISTINCT FROM
        CASE WHEN a.code='livi_vendor_payable_xof' THEN e.vendor_id
             WHEN a.code='livi_transporter_payable_xof' THEN s.transporter_id END
  `);
  mismatches.push(...payable.rows);

  const payout = await c.query(`
    SELECT p.id, p.reference, p.user_id, le.owner_user_id
    FROM payout_requests p
    JOIN ledger_transactions lt ON lt.metadata->>'payout_id'=p.id::text
    JOIN ledger_entries le ON le.transaction_id=lt.id
    JOIN ledger_accounts a ON a.id=le.account_id
    WHERE lt.type='payout_settlement'
      AND a.code IN ('livi_vendor_payable_xof','livi_transporter_payable_xof')
      AND le.owner_user_id IS DISTINCT FROM p.user_id
  `);
  mismatches.push(...payout.rows);
  return mismatches;
}

export async function assertFinancialIntegrity(c) {
  const [ledger, escrows, attribution] = await Promise.all([
    reconcileLedger(c), reconcileEscrows(c), reconcileFinancialAttribution(c)
  ]);
  if (ledger.length || escrows.length || attribution.length) {
    throw new HttpError(500, 'Incohérence financière détectée', 'FINANCIAL_INTEGRITY_ERROR');
  }
  return { ledger_unbalanced: 0, escrow_inconsistencies: 0, attribution_inconsistencies: 0 };
}
