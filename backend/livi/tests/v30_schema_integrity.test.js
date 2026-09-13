import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('V30 migration contains critical cross-row invariants', () => {
  const sql = fs.readFileSync(new URL('../migrations/027_v30_postgres_invariants.sql', import.meta.url), 'utf8');
  for (const marker of [
    'trg_order_amount_guard',
    'trg_order_item_vendor_guard',
    'trg_escrow_amount_guard',
    'trg_kyc_subject_role_guard',
    'trg_dispute_private_file_guard',
    'trg_shipment_transporter_identity_guard'
  ]) assert.match(sql, new RegExp(marker));
});
