ALTER TABLE shipments ADD COLUMN IF NOT EXISTS pickup_code_hash char(64);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS delivery_code_hash char(64);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS category varchar(40);
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE ledger_accounts ADD CONSTRAINT ledger_accounts_code_currency_unique UNIQUE(code,currency);

INSERT INTO ledger_accounts(code,name,type,currency) VALUES
('livi_shipping_payable_xof','Frais de livraison à payer','liability','XOF'),
('livi_refund_payable_xof','Remboursements clients à exécuter','liability','XOF')
ON CONFLICT(code) DO NOTHING;

CREATE INDEX IF NOT EXISTS shipments_transporter_status_idx ON shipments(transporter_id,status,created_at);
CREATE INDEX IF NOT EXISTS shipment_events_ship_created_idx ON shipment_events(shipment_id,created_at);
CREATE INDEX IF NOT EXISTS disputes_order_idx ON disputes(order_id,created_at);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON notifications(user_id,read_at,created_at);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS wallets_updated_at ON wallets;
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS escrow_updated_at ON escrow_transactions;
CREATE TRIGGER escrow_updated_at BEFORE UPDATE ON escrow_transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_negative_wallet() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.available_amount < 0 OR NEW.locked_amount < 0 THEN RAISE EXCEPTION 'Wallet balance cannot be negative'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS wallets_nonnegative ON wallets;
CREATE TRIGGER wallets_nonnegative BEFORE INSERT OR UPDATE ON wallets FOR EACH ROW EXECUTE FUNCTION prevent_negative_wallet();
