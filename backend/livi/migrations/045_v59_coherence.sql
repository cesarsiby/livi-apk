BEGIN;

-- V59: separate intercity security guarantee from buyer transport payment.
-- The guarantee is a partner obligation; it is not part of orders.shipping_fee
-- and must never be added to the buyer's payable amount.
CREATE TABLE IF NOT EXISTS intercity_guarantees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  shipment_id uuid UNIQUE REFERENCES shipments(id) ON DELETE SET NULL,
  partner_id uuid NOT NULL REFERENCES partners(id),
  cargo_value_xof bigint NOT NULL CHECK (cargo_value_xof >= 0),
  guarantee_bps integer NOT NULL DEFAULT 1000 CHECK (guarantee_bps = 1000),
  guarantee_amount_xof bigint NOT NULL CHECK (guarantee_amount_xof >= 0),
  funding_mode varchar(20) NOT NULL DEFAULT 'partner' CHECK (funding_mode = 'partner'),
  status varchar(30) NOT NULL DEFAULT 'awaiting_funding' CHECK (status IN (
    'awaiting_funding','held','release_pending','released_to_partner',
    'claim_pending','paid_to_buyer'
  )),
  funding_reference varchar(160),
  release_reference varchar(160),
  claim_reference varchar(160),
  funded_at timestamptz,
  release_pending_at timestamptz,
  released_at timestamptz,
  claim_pending_at timestamptz,
  paid_to_buyer_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intercity_guarantees_partner_status_idx
  ON intercity_guarantees(partner_id,status,created_at);
CREATE INDEX IF NOT EXISTS intercity_guarantees_shipment_idx
  ON intercity_guarantees(shipment_id);

-- Explicit basis for a perishability clock. Existing rows remain nullable so
-- the migration does not invent a basis; incomplete perishable products are
-- rejected/hidden by the application until the seller supplies one.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shelf_life_reference_type varchar(20);
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS shelf_life_reference_type varchar(20);
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_shelf_life_reference_type_check;
ALTER TABLE products
  ADD CONSTRAINT products_shelf_life_reference_type_check
  CHECK (shelf_life_reference_type IS NULL OR shelf_life_reference_type IN ('harvest','production','packaging','preparation')) NOT VALID;
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_perishable_metadata_chk;
ALTER TABLE products
  ADD CONSTRAINT products_perishable_metadata_chk
  CHECK (is_perishable = false OR (shelf_life_hours IS NOT NULL AND shelf_life_hours > 0 AND shelf_life_reference_type IS NOT NULL AND (shelf_life_reference_type = 'preparation' OR shelf_life_reference_at IS NOT NULL))) NOT VALID;
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_shelf_life_reference_type_check;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_shelf_life_reference_type_check
  CHECK (shelf_life_reference_type IS NULL OR shelf_life_reference_type IN ('harvest','production','packaging','preparation')) NOT VALID;

-- Payment-method ownership is persisted on the escrow itself so the method
-- used by the buyer cannot silently change between init and provider callback.
ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES payment_methods(id);
CREATE INDEX IF NOT EXISTS escrow_payment_method_idx
  ON escrow_transactions(payment_method_id);

-- Legacy V58 minimum-guarantee field is obsolete. Keep the column for schema
-- compatibility, make new rows neutral, and let runtime calculations ignore it.
-- Existing values are deliberately preserved; this migration must not erase a
-- value that an operator may have configured independently.
ALTER TABLE intercity_pricing_rules
  ALTER COLUMN minimum_guarantee_xof SET DEFAULT 0;

COMMIT;
