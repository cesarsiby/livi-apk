-- LIVI V5: commissions de retrait vendeur/transporteur.
-- Les montants sont en XOF. Le montant demandé est le brut prélevé sur le payable;
-- la commission est comptabilisée en revenu LIVI et le net est envoyé au partenaire.
CREATE TABLE IF NOT EXISTS withdrawal_fee_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role varchar(20) NOT NULL CHECK(role IN ('vendor','transporter')),
  commission_bps integer NOT NULL DEFAULT 0 CHECK(commission_bps BETWEEN 0 AND 10000),
  min_fee_xof bigint NOT NULL DEFAULT 0 CHECK(min_fee_xof >= 0),
  max_fee_xof bigint CHECK(max_fee_xof IS NULL OR max_fee_xof >= min_fee_xof),
  active boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS withdrawal_fee_rule_idx ON withdrawal_fee_rules(role,active,effective_from DESC);

INSERT INTO withdrawal_fee_rules(role,commission_bps,active)
SELECT 'vendor',0,true WHERE NOT EXISTS (SELECT 1 FROM withdrawal_fee_rules WHERE role='vendor');
INSERT INTO withdrawal_fee_rules(role,commission_bps,active)
SELECT 'transporter',0,true WHERE NOT EXISTS (SELECT 1 FROM withdrawal_fee_rules WHERE role='transporter');

ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS fee_bps integer NOT NULL DEFAULT 0 CHECK(fee_bps BETWEEN 0 AND 10000);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS fee_amount bigint NOT NULL DEFAULT 0 CHECK(fee_amount >= 0);
ALTER TABLE payout_requests ADD COLUMN IF NOT EXISTS net_amount bigint NOT NULL DEFAULT 0 CHECK(net_amount > 0);

-- Garantit qu'un payout historique reste cohérent.
UPDATE payout_requests SET net_amount=amount WHERE net_amount=0;
