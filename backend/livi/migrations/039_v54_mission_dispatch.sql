-- V54 (suite) — attribution des missions transporteur : proposition
-- séquentielle par proximité, minuterie de 5 minutes, réattribution
-- automatique au refus ou à l'expiration. Remplace le modèle de pool ouvert
-- (premier arrivé, premier servi) introduit précédemment par une vraie
-- attribution priorisée, exactement comme demandé.

-- 1) Position "au repos" du transporteur — n'existait nulle part. Seul
-- POST /transporter/location existait, et il n'écrivait quelque chose que
-- si le transporteur avait déjà une mission active (shipment_events) : un
-- transporteur disponible mais sans mission n'avait jamais sa position
-- enregistrée, rendant tout calcul de proximité impossible avant ce
-- correctif.
ALTER TABLE transporters ADD COLUMN IF NOT EXISTS current_latitude numeric(9,6);
ALTER TABLE transporters ADD COLUMN IF NOT EXISTS current_longitude numeric(9,6);
ALTER TABLE transporters ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- 2) L'offre en cours sur un shipment : à qui elle est proposée en ce
-- moment, et quand elle expire. NULL/NULL = pas d'offre active (pool encore
-- non attribué en attente de dispatch, ou totalement épuisé faute de
-- transporteur disponible).
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS offered_to uuid REFERENCES users(id);
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS offer_expires_at timestamptz;

-- 3) Historique des offres : qui a été sollicité, dans quel ordre, avec
-- quelle issue. Nécessaire pour ne jamais reproposer une mission à un
-- transporteur qui l'a déjà refusée ou laissée expirer, et pour l'audit.
CREATE TABLE IF NOT EXISTS shipment_offers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  transporter_id uuid NOT NULL REFERENCES users(id),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','refused','expired','cancelled')),
  distance_km numeric(6,2),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(shipment_id,transporter_id)
);
CREATE INDEX IF NOT EXISTS shipment_offers_shipment_idx ON shipment_offers(shipment_id);
CREATE INDEX IF NOT EXISTS shipment_offers_pending_idx ON shipment_offers(transporter_id) WHERE status='pending';
