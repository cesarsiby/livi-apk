-- V21: partner payment webhook integrity, quarantine and replay protection
ALTER TABLE partner_payment_events
  ADD COLUMN IF NOT EXISTS status varchar(30) NOT NULL DEFAULT 'received'
    CHECK(status IN ('received','processed','duplicate','quarantined','rejected')),
  ADD COLUMN IF NOT EXISTS processing_error text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id),
  ADD COLUMN IF NOT EXISTS escrow_id uuid REFERENCES escrow_transactions(id),
  ADD COLUMN IF NOT EXISTS event_type varchar(80),
  ADD COLUMN IF NOT EXISTS amount bigint,
  ADD COLUMN IF NOT EXISTS reference varchar(120),
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS partner_events_order_idx ON partner_payment_events(order_id, created_at);
CREATE INDEX IF NOT EXISTS partner_events_status_idx ON partner_payment_events(status, created_at);

-- One provider event can only have one final processing outcome.
CREATE UNIQUE INDEX IF NOT EXISTS partner_event_final_uq
ON partner_payment_events(provider,event_id);

-- A payment reference can only be funded once by the ledger.
CREATE UNIQUE INDEX IF NOT EXISTS partner_payment_reference_ledger_uq
ON ledger_transactions((metadata->>'payment_reference'))
WHERE type='partner_payment' AND metadata ? 'payment_reference';
