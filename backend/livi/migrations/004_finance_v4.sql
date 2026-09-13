-- LIVI V4 finance hardening.
-- Liability convention: credits are negative, settlement reduces the liability with a positive entry.
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS provider varchar(50);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS provider_reference varchar(160);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS failure_reason text;
CREATE UNIQUE INDEX IF NOT EXISTS payout_provider_ref_uq ON payout_requests(provider,provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS payout_user_status_idx ON payout_requests(user_id,status,created_at);

CREATE TABLE IF NOT EXISTS platform_fee_rules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(100) UNIQUE NOT NULL,
 commission_bps integer NOT NULL DEFAULT 0 CHECK(commission_bps BETWEEN 0 AND 10000),
 active boolean NOT NULL DEFAULT false,
 effective_from timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_fee_rules(name,commission_bps,active) VALUES('default',0,true) ON CONFLICT(name) DO NOTHING;
CREATE INDEX IF NOT EXISTS fee_rules_active_idx ON platform_fee_rules(active,effective_from DESC);

ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS commission_bps integer NOT NULL DEFAULT 0 CHECK(commission_bps BETWEEN 0 AND 10000);
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS commission_amount bigint NOT NULL DEFAULT 0 CHECK(commission_amount>=0);
ALTER TABLE escrow_transactions ADD COLUMN IF NOT EXISTS vendor_net_amount bigint NOT NULL DEFAULT 0 CHECK(vendor_net_amount>=0);

CREATE TABLE IF NOT EXISTS financial_operations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 operation_key varchar(180) UNIQUE NOT NULL,
 order_id uuid REFERENCES orders(id),
 payout_id uuid REFERENCES payout_requests(id),
 type varchar(50) NOT NULL,
 status varchar(30) NOT NULL DEFAULT 'completed',
 amount bigint NOT NULL CHECK(amount>0),
 currency char(3) NOT NULL DEFAULT 'XOF',
 ledger_transaction_id uuid REFERENCES ledger_transactions(id),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS financial_operations_order_idx ON financial_operations(order_id,created_at);

UPDATE ledger_accounts SET name='Montants à payer aux vendeurs' WHERE code='livi_vendor_payable_xof';
UPDATE ledger_accounts SET name='Montants à payer aux transporteurs' WHERE code='livi_transporter_payable_xof';
