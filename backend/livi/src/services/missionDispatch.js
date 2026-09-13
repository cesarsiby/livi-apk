import { HttpError } from '../utils/http.js';
import { enqueueNotification } from './notifications.js';
import { haversineKm } from './orderPricing.js';

const OFFER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes, per spec ("il dispose de 5 minutes")

// V54 (RAPPORT — "ATTRIBUTION DES MISSIONS TRANSPORTEUR"): finds the
// nearest eligible online transporter who (a) hasn't already been offered
// this shipment (no row in shipment_offers for the pair — refused/expired
// offers are never retried) and (b) doesn't already have a mission in
// progress ("un transporteur ne peut jamais accepter deux missions
// simultanément"). Transporters without a known location aren't excluded —
// they're just ranked after anyone with a known distance, so the system
// keeps working even before every transporter has shared a location ping.
async function findNextCandidate(c, shipmentId, vendorId) {
  const vendor = (await c.query('SELECT latitude,longitude FROM vendors WHERE id=$1', [vendorId])).rows[0];

  const { rows } = await c.query(
    `SELECT t.id, t.current_latitude, t.current_longitude
     FROM transporters t
     WHERE t.availability='online'
       AND NOT EXISTS (SELECT 1 FROM shipment_offers so WHERE so.shipment_id=$1 AND so.transporter_id=t.id)
       AND NOT EXISTS (
         SELECT 1 FROM shipments s
         WHERE s.transporter_id=t.id AND s.status IN ('assigned','picked_up','in_transit','arrived')
       )`,
    [shipmentId]
  );
  if (!rows.length) return null;

  const withDistance = rows.map((t) => {
    let distanceKm = null;
    if (vendor?.latitude != null && vendor?.longitude != null && t.current_latitude != null && t.current_longitude != null) {
      distanceKm = haversineKm(Number(vendor.latitude), Number(vendor.longitude), Number(t.current_latitude), Number(t.current_longitude));
    }
    return { transporterId: t.id, distanceKm };
  });
  withDistance.sort((a, b) => {
    if (a.distanceKm == null && b.distanceKm == null) return 0;
    if (a.distanceKm == null) return 1;
    if (b.distanceKm == null) return -1;
    return a.distanceKm - b.distanceKm;
  });
  return withDistance[0];
}

// Proposes the shipment to the next candidate, or clears the offer (leaves
// the shipment unassigned, `offered_to`/`offer_expires_at` both NULL) and
// notifies the vendor if nobody is eligible — an honest "no one available"
// state rather than pretending a transporter was found.
export async function dispatchNextOffer(c, shipmentId) {
  const shipment = (await c.query('SELECT s.*, o.vendor_id, o.id AS order_id FROM shipments s JOIN orders o ON o.id=s.order_id WHERE s.id=$1 FOR UPDATE', [shipmentId])).rows[0];
  if (!shipment) throw new HttpError(404, 'Mission introuvable');
  if (shipment.transporter_id) return { assigned: true }; // already claimed, nothing to dispatch

  const candidate = await findNextCandidate(c, shipmentId, shipment.vendor_id);
  if (!candidate) {
    await c.query('UPDATE shipments SET offered_to=NULL, offer_expires_at=NULL WHERE id=$1', [shipmentId]);
    await enqueueNotification(c, {
      userId: shipment.vendor_id,
      type: 'mission_no_transporter',
      title: 'Aucun transporteur disponible',
      body: "Aucun transporteur n'est disponible pour le moment. Nous continuons à chercher.",
      data: { order_id: shipment.order_id },
    });
    return { assigned: false, offered: false };
  }

  const expiresAt = new Date(Date.now() + OFFER_WINDOW_MS);
  await c.query('UPDATE shipments SET offered_to=$1, offer_expires_at=$2 WHERE id=$3', [candidate.transporterId, expiresAt, shipmentId]);
  await c.query(
    'INSERT INTO shipment_offers(shipment_id,transporter_id,distance_km,offered_at) VALUES($1,$2,$3,now())',
    [shipmentId, candidate.transporterId, candidate.distanceKm]
  );
  await enqueueNotification(c, {
    userId: candidate.transporterId,
    type: 'mission_offer',
    title: 'Nouvelle mission disponible',
    body: 'Vous avez 5 minutes pour accepter cette mission.',
    data: { shipment_id: shipmentId, order_id: shipment.order_id, expires_at: expiresAt.toISOString() },
  });
  return { assigned: false, offered: true, transporterId: candidate.transporterId, expiresAt };
}

// Called by the scheduled sweep (see missionScheduler.js) for every shipment
// whose current offer has expired without a response.
export async function expireOfferAndReassign(c, shipmentId) {
  const shipment = (await c.query('SELECT * FROM shipments WHERE id=$1 FOR UPDATE', [shipmentId])).rows[0];
  if (!shipment || shipment.transporter_id || !shipment.offered_to) return { skipped: true };
  if (shipment.offer_expires_at && new Date(shipment.offer_expires_at).getTime() > Date.now()) return { skipped: true };

  await c.query(
    "UPDATE shipment_offers SET status='expired', responded_at=now() WHERE shipment_id=$1 AND transporter_id=$2 AND status='pending'",
    [shipmentId, shipment.offered_to]
  );
  return dispatchNextOffer(c, shipmentId);
}
