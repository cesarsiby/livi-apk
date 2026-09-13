import { HttpError } from '../utils/http.js';

function asBigInt(value, field='amount') {
  try { return BigInt(String(value)); } catch { throw new HttpError(422, `Montant ${field} invalide`, 'RECON_AMOUNT_INVALID'); }
}

function normalizeProviderRecord(r) {
  return {
    event_id: String(r.event_id ?? r.id ?? ''),
    reference: String(r.reference ?? r.payment_reference ?? r.transaction_reference ?? ''),
    amount: asBigInt(r.amount),
    currency: String(r.currency ?? 'XOF').toUpperCase(),
    type: String(r.type ?? r.event_type ?? 'payment.succeeded')
  };
}

/** Compare a provider settlement export with LIVI's processed payment events. */
export async function reconcilePartnerPayments(c, { provider, periodStart, periodEnd, records, createdBy=null, sourceReference=null }) {
  if (!provider || !periodStart || !periodEnd || !Array.isArray(records)) {
    throw new HttpError(400, 'Paramètres de réconciliation incomplets', 'RECON_INPUT_INVALID');
  }
  const normalized = records.map(normalizeProviderRecord);
  const seen = new Set();
  const items = [];

  for (const r of normalized) {
    if (!r.event_id || !r.reference) {
      items.push({ ...r, discrepancy_type: 'unknown_reference', details: { reason: 'missing_event_id_or_reference' } });
      continue;
    }
    const duplicate = seen.has(r.event_id);
    seen.add(r.event_id);
    const q = await c.query(`
      SELECT p.id,p.event_id,p.reference,p.amount,p.status,p.order_id,
             o.status AS order_status, o.currency
      FROM partner_payment_events p
      LEFT JOIN orders o ON o.id=p.order_id
      WHERE p.provider=$1 AND (p.event_id=$2 OR p.reference=$3)
      ORDER BY p.created_at DESC LIMIT 2`, [provider, r.event_id, r.reference]);
    const rows = q.rows;
    const exact = rows.find(x => x.event_id === r.event_id || x.reference === r.reference);
    if (duplicate || rows.filter(x => x.reference === r.reference).length > 1) {
      items.push({ ...r, discrepancy_type: 'duplicate', details: { provider_rows: rows.length, duplicate_export: duplicate } });
      continue;
    }
    if (!exact) {
      items.push({ ...r, discrepancy_type: 'missing_in_livi', details: { reason: 'provider_record_not_found' } });
      continue;
    }
    const expected = BigInt(String(exact.amount ?? 0));
    if (expected !== r.amount) {
      items.push({ ...r, order_id: exact.order_id, expected_amount: expected, discrepancy_type: 'amount_mismatch', details: { livi_status: exact.status } });
      continue;
    }
    if (exact.status !== 'processed') {
      items.push({ ...r, order_id: exact.order_id, expected_amount: expected, discrepancy_type: 'state_mismatch', details: { livi_status: exact.status } });
      continue;
    }
    items.push({ ...r, order_id: exact.order_id, expected_amount: expected, discrepancy_type: 'matched', details: { livi_status: exact.status } });
  }

  const providerRefs = new Set(normalized.map(r => r.reference));
  const missingAtPartner = await c.query(`
    SELECT p.event_id,p.reference,p.amount,p.order_id
    FROM partner_payment_events p
    WHERE p.provider=$1
      AND p.status='processed'
      AND p.event_type='payment.succeeded'
      AND p.created_at >= $2 AND p.created_at < $3
  `, [provider, periodStart, periodEnd]);
  for (const row of missingAtPartner.rows) {
    if (!providerRefs.has(String(row.reference))) {
      items.push({ event_id: row.event_id, reference: row.reference, amount: BigInt(String(row.amount)), currency:'XOF', order_id:row.order_id, expected_amount:BigInt(String(row.amount)), discrepancy_type:'missing_at_partner', details:{reason:'processed_in_livi_not_present_in_export'} });
    }
  }

  const totals = { records: normalized.length, matched:0, missing_in_livi:0, missing_at_partner:0, amount_mismatch:0, duplicate:0, unknown_reference:0, state_mismatch:0 };
  for (const i of items) totals[i.discrepancy_type] = (totals[i.discrepancy_type] ?? 0) + 1;

  const run = (await c.query(`INSERT INTO partner_reconciliation_runs(provider,period_start,period_end,source_reference,status,totals,created_by) VALUES($1,$2,$3,$4,'completed',$5,$6) RETURNING id`, [provider, periodStart, periodEnd, sourceReference, JSON.stringify(totals), createdBy])).rows[0];
  for (const i of items) {
    await c.query(`INSERT INTO partner_reconciliation_items(run_id,provider,external_event_id,payment_reference,order_id,expected_amount,provider_amount,currency,discrepancy_type,details) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [run.id, provider, i.event_id || null, i.reference || null, i.order_id || null, i.expected_amount == null ? null : i.expected_amount.toString(), i.amount == null ? null : i.amount.toString(), i.currency || 'XOF', i.discrepancy_type, i.details || {}]);
  }
  return { run_id: run.id, totals, items: items.map(i => ({...i, amount:i.amount?.toString(), expected_amount:i.expected_amount?.toString()})) };
}
