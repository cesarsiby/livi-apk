-- V22: partner payment reconciliation snapshots and immutable result records
CREATE TABLE IF NOT EXISTS partner_reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(50) NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  source_reference varchar(160),
  status varchar(20) NOT NULL DEFAULT 'completed'
    CHECK(status IN ('completed','failed')),
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(period_end > period_start)
);

CREATE TABLE IF NOT EXISTS partner_reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES partner_reconciliation_runs(id) ON DELETE CASCADE,
  provider varchar(50) NOT NULL,
  external_event_id varchar(160),
  payment_reference varchar(120),
  order_id uuid REFERENCES orders(id),
  expected_amount bigint,
  provider_amount bigint,
  currency varchar(3),
  discrepancy_type varchar(40) NOT NULL
    CHECK(discrepancy_type IN ('matched','missing_in_livi','missing_at_partner','amount_mismatch','duplicate','unknown_reference','state_mismatch')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_reconciliation_runs_provider_period_idx
  ON partner_reconciliation_runs(provider, period_start, period_end);
CREATE INDEX IF NOT EXISTS partner_reconciliation_items_run_idx
  ON partner_reconciliation_items(run_id, discrepancy_type);
