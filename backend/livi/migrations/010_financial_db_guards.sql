-- LIVI V12: database-level financial integrity guards.
-- These are deferred so a balanced ledger transaction may be built over several INSERTs
-- and is validated only at COMMIT.

CREATE OR REPLACE FUNCTION livi_assert_ledger_transaction_balanced()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total bigint;
  entry_count integer;
  tx_id uuid;
BEGIN
  tx_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.transaction_id ELSE NEW.transaction_id END;
  SELECT COUNT(*), COALESCE(SUM(amount), 0)::bigint
    INTO entry_count, total
  FROM ledger_entries
  WHERE transaction_id = tx_id;

  IF entry_count = 0 THEN
    RAISE EXCEPTION 'Ledger transaction % has no entries', tx_id;
  END IF;

  IF total <> 0 THEN
    RAISE EXCEPTION 'Ledger transaction % is unbalanced: %', tx_id, total;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_transaction_balance_guard ON ledger_transactions;
CREATE CONSTRAINT TRIGGER ledger_transaction_balance_guard
AFTER INSERT ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_assert_ledger_transaction_balanced();

DROP TRIGGER IF EXISTS ledger_entry_balance_guard ON ledger_entries;
CREATE CONSTRAINT TRIGGER ledger_entry_balance_guard
AFTER INSERT OR UPDATE OR DELETE ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_assert_ledger_transaction_balanced();

CREATE OR REPLACE FUNCTION livi_assert_ledger_entry_currency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE account_currency char(3);
BEGIN
  SELECT currency INTO account_currency FROM ledger_accounts WHERE id = NEW.account_id;
  IF account_currency IS NULL THEN
    RAISE EXCEPTION 'Ledger account % does not exist', NEW.account_id;
  END IF;
  IF NEW.currency <> account_currency THEN
    RAISE EXCEPTION 'Ledger entry currency % does not match account currency %', NEW.currency, account_currency;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entry_currency_guard ON ledger_entries;
CREATE TRIGGER ledger_entry_currency_guard
BEFORE INSERT OR UPDATE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION livi_assert_ledger_entry_currency();

CREATE INDEX IF NOT EXISTS financial_operations_type_status_idx
ON financial_operations(type,status,created_at DESC);

