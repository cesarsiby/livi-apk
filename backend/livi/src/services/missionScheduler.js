import { pool, tx } from '../config/db.js';
import { expireOfferAndReassign } from './missionDispatch.js';

// V54: sweeps shipments whose 5-minute offer window has passed without a
// response and reassigns them to the next nearest transporter — the
// backend-enforced side of "S'il ne répond pas avant la fin des 5 minutes
// -> la mission est automatiquement considérée comme refusée/non acceptée
// et passe au transporteur suivant." One shipment at a time, its own
// transaction, so one failure doesn't block the rest of the sweep.
export async function sweepExpiredMissionOffers() {
  const { rows } = await pool.query(
    "SELECT id FROM shipments WHERE offered_to IS NOT NULL AND offer_expires_at IS NOT NULL AND offer_expires_at<=now() AND transporter_id IS NULL"
  );
  for (const { id } of rows) {
    try {
      await tx((c) => expireOfferAndReassign(c, id));
    } catch (err) {
      console.error('mission_offer_sweep_failed', { shipment_id: id, error: err.message });
    }
  }
  return { swept: rows.length };
}
