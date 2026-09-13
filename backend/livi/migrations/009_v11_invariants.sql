-- LIVI V11: invariants and financial reconciliation

UPDATE ledger_accounts
SET name='Payables vendeurs LIVI'
WHERE code='livi_vendor_payable_xof';

UPDATE ledger_accounts
SET name='Payables transporteurs LIVI'
WHERE code='livi_transporter_payable_xof';

CREATE INDEX IF NOT EXISTS shipment_proofs_active_idx
ON shipment_proofs(shipment_id, proof_type, expires_at)
WHERE used_at IS NULL AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_transactions_type_idx
ON ledger_transactions(type, created_at);

