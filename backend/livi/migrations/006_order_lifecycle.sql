-- LIVI V6: order lifecycle and buyer-confirmed delivery.

-- Orders
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at timestamptz;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_confirmed_by uuid REFERENCES users(id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS cancelled_reason text;

-- Shipments
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS delivery_code_hash char(64);

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz;

-- Shipment events
ALTER TABLE shipment_events
  ADD COLUMN IF NOT EXISTS latitude numeric(10,7);

ALTER TABLE shipment_events
  ADD COLUMN IF NOT EXISTS longitude numeric(10,7);

-- Indexes
CREATE INDEX IF NOT EXISTS orders_lifecycle_idx
  ON orders(status, updated_at);

CREATE INDEX IF NOT EXISTS shipments_transporter_status_idx
  ON shipments(transporter_id, status, updated_at);

-- Prevent more than one open dispute for an order.
CREATE UNIQUE INDEX IF NOT EXISTS disputes_one_open_per_order
  ON disputes(order_id)
  WHERE status = 'open';
