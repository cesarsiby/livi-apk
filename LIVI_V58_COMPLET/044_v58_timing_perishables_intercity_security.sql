-- LIVI V58 — timing métier, périssables, SLA logistique interville et garantie transport
-- Basée sur le modèle V57 (migration 043) ; additive et idempotente.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS preparation_time_hours integer;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_preparation_time_hours_chk;
ALTER TABLE products
  ADD CONSTRAINT products_preparation_time_hours_chk
  CHECK (preparation_time_hours IS NULL OR preparation_time_hours IN (1,2,3,4,12,24));
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_active_prep_chk;
ALTER TABLE products
  ADD CONSTRAINT products_active_prep_chk
  CHECK (status <> 'active' OR preparation_time_hours IS NOT NULL) NOT VALID;
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS shelf_life_reference_at timestamptz;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_perishable_metadata_chk;
ALTER TABLE products
  ADD CONSTRAINT products_perishable_metadata_chk
  CHECK (is_perishable = false OR (shelf_life_hours IS NOT NULL AND shelf_life_hours > 0 AND shelf_life_reference_at IS NOT NULL)) NOT VALID;
CREATE INDEX IF NOT EXISTS products_expiry_idx ON products(status,is_perishable,shelf_life_reference_at);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS preparation_time_hours integer,
  ADD COLUMN IF NOT EXISTS shelf_life_reference_at timestamptz,
  ADD COLUMN IF NOT EXISTS shelf_life_expires_at timestamptz;
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_preparation_time_hours_chk;
ALTER TABLE order_items
  ADD CONSTRAINT order_items_preparation_time_hours_chk
  CHECK (preparation_time_hours IS NULL OR preparation_time_hours IN (1,2,3,4,12,24));
CREATE INDEX IF NOT EXISTS order_items_expiry_idx ON order_items(shelf_life_expires_at);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS preparation_time_hours integer,
  ADD COLUMN IF NOT EXISTS preparation_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS preparation_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_transit_min_minutes integer,
  ADD COLUMN IF NOT EXISTS delivery_transit_max_minutes integer,
  ADD COLUMN IF NOT EXISTS delivery_eta_min_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_eta_max_at timestamptz,
  ADD COLUMN IF NOT EXISTS cargo_value_xof bigint,
  ADD COLUMN IF NOT EXISTS intercity_origin_location_id uuid,
  ADD COLUMN IF NOT EXISTS intercity_transport_cost_xof bigint,
  ADD COLUMN IF NOT EXISTS intercity_guarantee_xof bigint,
  ADD COLUMN IF NOT EXISTS intercity_guarantee_refunded_xof bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intercity_guarantee_refunded_at timestamptz;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_preparation_time_hours_chk;
ALTER TABLE orders
  ADD CONSTRAINT orders_preparation_time_hours_chk
  CHECK (preparation_time_hours IS NULL OR preparation_time_hours IN (1,2,3,4,12,24));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_delivery_transit_chk;
ALTER TABLE orders
  ADD CONSTRAINT orders_delivery_transit_chk
  CHECK ((delivery_transit_min_minutes IS NULL AND delivery_transit_max_minutes IS NULL)
      OR (delivery_transit_min_minutes IS NOT NULL AND delivery_transit_max_minutes IS NOT NULL
          AND delivery_transit_min_minutes >= 0 AND delivery_transit_max_minutes >= delivery_transit_min_minutes));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_intercity_amounts_chk;
ALTER TABLE orders
  ADD CONSTRAINT orders_intercity_amounts_chk
  CHECK (
    (cargo_value_xof IS NULL OR cargo_value_xof >= 0)
    AND (intercity_transport_cost_xof IS NULL OR intercity_transport_cost_xof >= 0)
    AND (intercity_guarantee_xof IS NULL OR intercity_guarantee_xof >= 0)
    AND intercity_guarantee_refunded_xof >= 0
    AND intercity_guarantee_refunded_xof <= COALESCE(intercity_guarantee_xof,0)
  );
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_intercity_origin_fk;
ALTER TABLE orders
  ADD CONSTRAINT orders_intercity_origin_fk FOREIGN KEY (intercity_origin_location_id) REFERENCES partner_locations(id);
CREATE INDEX IF NOT EXISTS orders_preparation_ready_idx ON orders(preparation_ready_at);
CREATE INDEX IF NOT EXISTS orders_delivery_eta_idx ON orders(delivery_eta_max_at);

ALTER TABLE intercity_routes
  ADD COLUMN IF NOT EXISTS minimum_transport_fee_xof bigint NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS fuel_cost_xof bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS operating_charges_xof bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_service_fee_xof bigint NOT NULL DEFAULT 0;
ALTER TABLE intercity_routes DROP CONSTRAINT IF EXISTS intercity_routes_min_transport_fee_chk;
ALTER TABLE intercity_routes DROP CONSTRAINT IF EXISTS intercity_routes_cost_breakdown_chk;
ALTER TABLE intercity_routes
  ADD CONSTRAINT intercity_routes_cost_breakdown_chk
  CHECK (minimum_transport_fee_xof >= 1000
     AND fuel_cost_xof >= 0
     AND operating_charges_xof >= 0
     AND partner_service_fee_xof >= 0);

CREATE TABLE IF NOT EXISTS intercity_pricing_rules(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL UNIQUE,
  guarantee_bps integer NOT NULL DEFAULT 1000 CHECK (guarantee_bps = 1000),
  minimum_guarantee_xof bigint NOT NULL DEFAULT 1000 CHECK (minimum_guarantee_xof >= 1000),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE intercity_pricing_rules DROP CONSTRAINT IF EXISTS intercity_pricing_rules_rate_chk;
ALTER TABLE intercity_pricing_rules
  ADD CONSTRAINT intercity_pricing_rules_rate_chk CHECK (guarantee_bps = 1000);
INSERT INTO intercity_pricing_rules(name,guarantee_bps,minimum_guarantee_xof,active)
VALUES ('default-10pct',1000,1000,true)
ON CONFLICT(name) DO NOTHING;

CREATE TABLE IF NOT EXISTS urban_delivery_time_rules(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL UNIQUE,
  min_distance_km numeric(8,2) NOT NULL DEFAULT 0 CHECK (min_distance_km >= 0),
  max_distance_km numeric(8,2) CHECK (max_distance_km IS NULL OR max_distance_km >= min_distance_km),
  transit_min_minutes integer NOT NULL CHECK (transit_min_minutes >= 0),
  transit_max_minutes integer NOT NULL CHECK (transit_max_minutes >= transit_min_minutes),
  active boolean NOT NULL DEFAULT true,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS urban_delivery_time_rules_lookup_idx
  ON urban_delivery_time_rules(active,effective_from,min_distance_km,max_distance_km);

ALTER TABLE escrow_transactions
  ADD COLUMN IF NOT EXISTS intercity_guarantee_xof bigint,
  ADD COLUMN IF NOT EXISTS intercity_guarantee_refunded_xof bigint NOT NULL DEFAULT 0;
ALTER TABLE escrow_transactions DROP CONSTRAINT IF EXISTS escrow_intercity_guarantee_chk;
ALTER TABLE escrow_transactions
  ADD CONSTRAINT escrow_intercity_guarantee_chk
  CHECK ((intercity_guarantee_xof IS NULL OR intercity_guarantee_xof >= 0)
     AND intercity_guarantee_refunded_xof >= 0
     AND intercity_guarantee_refunded_xof <= COALESCE(intercity_guarantee_xof,0));

ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS partner_picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS lost_at timestamptz,
  ADD COLUMN IF NOT EXISTS loss_reason text,
  ADD COLUMN IF NOT EXISTS loss_reported_by uuid REFERENCES users(id);
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_status_check;
ALTER TABLE shipments
  ADD CONSTRAINT shipments_status_check CHECK (status IN ('pending','assigned','rejected','picked_up','in_transit','arrived','delivered','cancelled','lost'));
CREATE INDEX IF NOT EXISTS shipments_partner_status_idx ON shipments(partner_id,status,created_at);

ALTER TABLE settlements ADD COLUMN IF NOT EXISTS beneficiary_partner_id uuid REFERENCES partners(id);
ALTER TABLE settlements DROP CONSTRAINT IF EXISTS settlements_beneficiary_type_check;
ALTER TABLE settlements
  ADD CONSTRAINT settlements_beneficiary_type_check CHECK (beneficiary_type IN ('vendor','transporter','buyer','livi','partner'));
CREATE INDEX IF NOT EXISTS settlements_partner_idx ON settlements(beneficiary_partner_id,status,created_at);

INSERT INTO ledger_accounts(code,name,type,currency) VALUES
('livi_intercity_partner_payable_xof','Frais interville à payer aux partenaires logistiques','liability','XOF')
ON CONFLICT(code) DO NOTHING;
