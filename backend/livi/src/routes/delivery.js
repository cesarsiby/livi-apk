import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok, HttpError } from '../utils/http.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { proofLimiter } from '../middleware/security.js';
import { assertOrderTransition } from '../services/orderLifecycle.js';
import { consumeProof } from '../services/deliveryProof.js';

const r = Router();
r.use(requireAuth);

export async function resolveProof(credential, { actorRole, actorId }) {
  const body = z.object({ credential: z.string().min(20).max(5000) }).parse({ credential });
  let parsed = null;
  try { parsed = JSON.parse(body.credential); } catch { throw new HttpError(422, 'QR LIVI invalide', 'QR_INVALID'); }
  if (parsed?.app !== 'LIVI' || !parsed?.proof_id || !parsed?.token) throw new HttpError(422, 'QR LIVI invalide', 'QR_INVALID');

  const row = (await pool.query(
    `SELECT sp.id,sp.shipment_id,sp.proof_type,sp.token_hash,sp.expires_at,sp.used_at,sp.revoked_at,
            s.status,o.id order_id,o.status order_status,o.buyer_id,o.vendor_id
       FROM shipment_proofs sp
       JOIN shipments s ON s.id=sp.shipment_id
       JOIN orders o ON o.id=s.order_id
      WHERE sp.id=$1`,
    [parsed.proof_id]
  )).rows[0];

  if (!row) throw new HttpError(404, 'Preuve introuvable', 'PROOF_NOT_FOUND');
  const a = Buffer.from(crypto.createHash('sha256').update(parsed.token).digest('hex'), 'hex');
  const b = Buffer.from(row.token_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new HttpError(422, 'QR LIVI invalide', 'QR_INVALID');
  if (row.used_at || row.revoked_at || new Date(row.expires_at) <= new Date()) {
    throw new HttpError(409, 'QR expiré ou déjà utilisé', 'PROOF_UNAVAILABLE');
  }

  if (actorRole === 'transporter') {
    const assigned = (await pool.query('SELECT transporter_id FROM shipments WHERE id=$1', [row.shipment_id])).rows[0];
    if (!assigned || assigned.transporter_id !== actorId) throw new HttpError(403, 'Mission non autorisée');
  }

  return {
    proof_id: row.id,
    shipment_id: row.shipment_id,
    proof_type: row.proof_type,
    order_id: row.order_id,
    order_status: row.order_status,
    shipment_status: row.status,
  };
}

export async function verifyPickupProof(
  shipmentId,
  { credential, latitude, longitude, actorRole, actorId, requestId, ip, userAgent }
) {
  const body = z.object({
    credential: z.string().min(4).max(5000),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).parse({ credential, latitude, longitude });

  return tx(async c => {
    const s = (await c.query(
      `SELECT s.*,o.status order_status,o.vendor_id
         FROM shipments s
         JOIN orders o ON o.id=s.order_id
        WHERE s.id=$1 FOR UPDATE`,
      [shipmentId]
    )).rows[0];

    if (!s) throw new HttpError(404, 'Livraison introuvable');
    if (actorRole === 'transporter' && s.transporter_id !== actorId) throw new HttpError(403, 'Mission non autorisée');
    if (s.status !== 'assigned') throw new HttpError(409, 'Le colis n’est pas prêt pour la remise', 'INVALID_PICKUP_STATE');

    await consumeProof(c, {
      shipmentId: s.id,
      proofType: 'seller_pickup',
      credential: body.credential,
      actorId,
      requestId,
      ip,
      userAgent,
    });

    // Physical pickup is the boundary between preparation and transport.
    // This is the moment at which the order may enter shipping/in-transit.
    await c.query(
      "UPDATE shipments SET status='in_transit',pickup_at=now(),pickup_proof_used_at=now() WHERE id=$1",
      [s.id]
    );
    await c.query(
      `INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [s.id, 'picked_up', body.latitude ?? null, body.longitude ?? null, 'Remise vendeur validée par preuve LIVI', actorId]
    );

    if (['paid', 'preparing'].includes(s.order_status)) {
      assertOrderTransition(s.order_status, 'shipping');
      await c.query("UPDATE orders SET status='shipping',updated_at=now() WHERE id=$1", [s.order_id]);
    }

    return { shipment_id: s.id, status: 'in_transit', proof: 'seller_pickup_verified' };
  });
}

export async function verifyDeliveryProof(
  shipmentId,
  { credential, latitude, longitude, actorRole, actorId, requestId, ip, userAgent }
) {
  const body = z.object({
    credential: z.string().min(4).max(5000),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }).parse({ credential, latitude, longitude });

  return tx(async c => {
    const s = (await c.query(
      `SELECT s.*,o.buyer_id,o.vendor_id,o.status AS order_status,o.id AS order_id
         FROM shipments s
         JOIN orders o ON o.id=s.order_id
        WHERE s.id=$1 FOR UPDATE`,
      [shipmentId]
    )).rows[0];

    if (!s) throw new HttpError(404, 'Livraison introuvable');
    if (actorRole === 'transporter' && s.transporter_id !== actorId) throw new HttpError(403, 'Mission non autorisée');
    if (!['in_transit', 'arrived'].includes(s.status)) throw new HttpError(409, 'Le colis n’est pas arrivé au stade de remise', 'INVALID_DELIVERY_STATE');

    if (s.status === 'in_transit') {
      await c.query("UPDATE shipments SET status='arrived',arrived_at=now() WHERE id=$1", [s.id]);
    }

    // The delivery proof is consumed exactly once by the transporter/partner.
    // It establishes the physical handoff; it does not complete the financial settlement.
    await consumeProof(c, {
      shipmentId: s.id,
      proofType: 'buyer_delivery',
      credential: body.credential,
      actorId,
      requestId,
      ip,
      userAgent,
    });

    await c.query(
      "UPDATE shipments SET status='delivered',delivered_at=now(),delivery_proof_used_at=now() WHERE id=$1",
      [s.id]
    );
    await c.query(
      `INSERT INTO shipment_events(shipment_id,status,latitude,longitude,note,created_by)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [s.id, 'delivered', body.latitude ?? null, body.longitude ?? null, 'Remise physique validée par preuve LIVI', actorId]
    );

    assertOrderTransition(s.order_status, 'delivered');
    await c.query(
      "UPDATE orders SET status='delivered',delivered_at=now(),updated_at=now() WHERE id=$1",
      [s.order_id]
    );

    return {
      shipment_id: s.id,
      order_id: s.order_id,
      status: 'delivered',
      delivery_proof_verified: true,
      escrow: 'held_pending_buyer_confirmation',
    };
  });
}

r.post('/proof/resolve', proofLimiter, requireRoles('transporter', 'admin'), asyncHandler(async (req, res) => {
  ok(res, await resolveProof(req.body?.credential, { actorRole: req.user.role, actorId: req.user.sub }));
}));

r.post('/:id/pickup-proof/verify', proofLimiter, requireRoles('transporter', 'admin'), asyncHandler(async (req, res) => {
  ok(res, await verifyPickupProof(req.params.id, {
    credential: req.body?.credential,
    latitude: req.body?.latitude,
    longitude: req.body?.longitude,
    actorRole: req.user.role,
    actorId: req.user.sub,
    requestId: res.locals.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }));
}));

r.post('/:id/delivery-proof/verify', proofLimiter, requireRoles('transporter', 'admin'), asyncHandler(async (req, res) => {
  ok(res, await verifyDeliveryProof(req.params.id, {
    credential: req.body?.credential,
    latitude: req.body?.latitude,
    longitude: req.body?.longitude,
    actorRole: req.user.role,
    actorId: req.user.sub,
    requestId: res.locals.requestId,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }));
}));

export default r;
