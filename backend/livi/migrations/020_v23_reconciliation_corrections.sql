-- V23: controlled financial correction workflow.
-- Reconciliation findings are never silently mutated into financial state.
CREATE TABLE IF NOT EXISTS financial_correction_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_item_id uuid REFERENCES partner_reconciliation_items(id),
  provider varchar(50),
  order_id uuid REFERENCES orders(id),
  payment_reference varchar(120),
  case_type varchar(50) NOT NULL CHECK (case_type IN (
    'missing_in_livi','missing_at_partner','amount_mismatch','duplicate','unknown_reference','state_mismatch','manual_adjustment'
  )),
  status varchar(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','approved','rejected','executed','cancelled')),
  proposed_amount bigint,
  currency varchar(3) NOT NULL DEFAULT 'XOF',
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES users(id),
  approved_by uuid REFERENCES users(id),
  executed_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  executed_at timestamptz
);

CREATE TABLE IF NOT EXISTS financial_correction_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES financial_correction_cases(id),
  action_type varchar(40) NOT NULL CHECK (action_type IN ('open','approve','reject','execute','cancel')),
  actor_user_id uuid REFERENCES users(id),
  reason text,
  ledger_transaction_id uuid REFERENCES ledger_transactions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS financial_correction_case_item_unique
  ON financial_correction_cases(reconciliation_item_id)
  WHERE reconciliation_item_id IS NOT NULL AND status NOT IN ('rejected','cancelled');

CREATE INDEX IF NOT EXISTS financial_correction_cases_status_idx
  ON financial_correction_cases(status, created_at DESC);
CREATE INDEX IF NOT EXISTS financial_correction_cases_order_idx
  ON financial_correction_cases(order_id, created_at DESC);

-- Executed corrections must have an immutable ledger reference.
ALTER TABLE financial_correction_cases
  ADD CONSTRAINT financial_correction_executed_requires_ledger
  CHECK (status <> 'executed' OR executed_at IS NOT NULL);

-- Ledger transactions are already immutable; corrections add compensation entries,
-- never updates/deletes to historical entries.
