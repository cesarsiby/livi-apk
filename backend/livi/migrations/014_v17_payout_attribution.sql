-- LIVI V17: payout attribution and settlement integrity.

-- A payout settlement must debit the payable belonging to the same payout owner.
CREATE OR REPLACE FUNCTION livi_payout_settlement_owner_guard()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  payout_user uuid;
  acct_code text;
BEGIN
  IF NEW.type = 'payout_settlement' AND (NEW.metadata ? 'payout_id') THEN
    SELECT user_id INTO payout_user
    FROM payout_requests
    WHERE id = NULLIF(NEW.metadata->>'payout_id','')::uuid;

    IF payout_user IS NULL THEN
      RAISE EXCEPTION 'Payout settlement references unknown payout';
    END IF;

    SELECT a.code INTO acct_code
    FROM ledger_entries le
    JOIN ledger_accounts a ON a.id = le.account_id
    WHERE le.transaction_id = NEW.id
      AND a.code IN ('livi_vendor_payable_xof','livi_transporter_payable_xof')
      AND le.owner_user_id IS DISTINCT FROM payout_user
    LIMIT 1;

    IF acct_code IS NOT NULL THEN
      RAISE EXCEPTION 'Payout settlement payable owner mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payout_settlement_owner_guard ON ledger_transactions;
CREATE CONSTRAINT TRIGGER payout_settlement_owner_guard
AFTER INSERT OR UPDATE ON ledger_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION livi_payout_settlement_owner_guard();

