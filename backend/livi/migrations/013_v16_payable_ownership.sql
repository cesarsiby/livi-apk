-- LIVI V16: attribution des payables par utilisateur.
-- Un compte comptable global ne suffit pas pour calculer le solde disponible
-- d'un vendeur/transporteur. Chaque écriture de payable doit donc porter son propriétaire.

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES users(id);

CREATE INDEX IF NOT EXISTS ledger_entries_owner_account_idx
  ON ledger_entries(owner_user_id, account_id, created_at)
  WHERE owner_user_id IS NOT NULL;

-- Backfill des anciennes écritures de payables quand l'ordre permet de retrouver
-- sans ambiguïté le vendeur et/ou le transporteur.
UPDATE ledger_entries le
SET owner_user_id = e.vendor_id
FROM ledger_transactions lt
JOIN escrow_transactions e ON e.order_id = NULLIF(lt.metadata->>'order_id','')::uuid
JOIN ledger_accounts la ON la.id = le.account_id
WHERE le.transaction_id = lt.id
  AND le.owner_user_id IS NULL
  AND la.code = 'livi_vendor_payable_xof';

UPDATE ledger_entries le
SET owner_user_id = s.transporter_id
FROM ledger_transactions lt
JOIN shipments s ON s.order_id = NULLIF(lt.metadata->>'order_id','')::uuid
JOIN ledger_accounts la ON la.id = le.account_id
WHERE le.transaction_id = lt.id
  AND le.owner_user_id IS NULL
  AND la.code = 'livi_transporter_payable_xof'
  AND s.transporter_id IS NOT NULL;

-- Les nouvelles écritures de payable doivent être attribuées.
CREATE OR REPLACE FUNCTION livi_payable_requires_owner()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE code text;
BEGIN
  SELECT a.code INTO code FROM ledger_accounts a WHERE a.id = NEW.account_id;
  IF code IN ('livi_vendor_payable_xof','livi_transporter_payable_xof')
     AND NEW.owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Payable ledger entry requires owner_user_id';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payable_owner_guard ON ledger_entries;
CREATE TRIGGER payable_owner_guard
BEFORE INSERT OR UPDATE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION livi_payable_requires_owner();

