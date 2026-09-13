import { Router } from 'express';
import { z } from 'zod';
import { pool, tx } from '../config/db.js';
import { asyncHandler, ok, HttpError } from '../utils/http.js';
import { requireAuth } from '../middleware/auth.js';

const r = Router();
r.use(requireAuth);

// V54 (RAPPORT — "SYSTÈME DE NOTATION"): didn't exist at all for
// Acheteur<->Transporteur or Vendeur<->Transporteur (only Acheteur->Produit
// existed, via `reviews`, kept as-is — it's a different, product-centric
// concept). One generic endpoint covers all three pairs by checking the
// caller's and the target's actual relationship to a real, delivered order,
// exactly mirroring how `reviews` already prevents arbitrary ratings.
const createSchema = z.object({
  order_id: z.string().uuid(),
  rated_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

r.post('/', asyncHandler(async (req, res) => {
  const b = createSchema.parse(req.body);
  const result = await tx(async (c) => {
    const o = (await c.query('SELECT id,buyer_id,vendor_id,status FROM orders WHERE id=$1', [b.order_id])).rows[0];
    if (!o) throw new HttpError(404, 'Commande introuvable');
    if (!['delivered', 'completed'].includes(o.status)) throw new HttpError(409, 'La commande doit être livrée avant de noter', 'RATING_NOT_ALLOWED');

    const shipment = (await c.query('SELECT transporter_id FROM shipments WHERE order_id=$1', [b.order_id])).rows[0];
    const transporterId = shipment?.transporter_id ?? null;

    const roleOf = (userId) => {
      if (userId === o.buyer_id) return 'client';
      if (userId === o.vendor_id) return 'vendor';
      if (transporterId && userId === transporterId) return 'transporter';
      return null;
    };
    const raterRole = roleOf(req.user.sub);
    const ratedRole = roleOf(b.rated_id);
    if (!raterRole) throw new HttpError(403, "Vous n'êtes pas partie à cette commande");
    if (!ratedRole) throw new HttpError(422, 'Destinataire de la notation invalide pour cette commande');
    if (raterRole === ratedRole) throw new HttpError(422, 'Notation invalide');
    if (req.user.sub === b.rated_id) throw new HttpError(422, 'Impossible de se noter soi-même');

    const row = (await c.query(
      'INSERT INTO ratings(order_id,rater_id,rated_id,rated_role,rating,comment) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (order_id,rater_id,rated_id) DO NOTHING RETURNING *',
      [b.order_id, req.user.sub, b.rated_id, ratedRole, b.rating, b.comment || null]
    )).rows[0];
    if (!row) throw new HttpError(409, 'Vous avez déjà noté cette personne pour cette commande', 'RATING_ALREADY_EXISTS');
    return row;
  });
  ok(res, result, 201);
}));

// Reputation for a profile: average, count, and recent comments. No
// auth-scoping beyond requireAuth — a rating average is meant to be visible
// to whoever is deciding whether to transact with that person, exactly like
// product `reviews` are already publicly readable.
r.get('/:userId', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT rating, comment, created_at, rater_id FROM ratings WHERE rated_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.params.userId]
  );
  const agg = (await pool.query(
    `SELECT count(*)::int AS count, coalesce(avg(rating),0)::float AS average FROM ratings WHERE rated_id=$1`,
    [req.params.userId]
  )).rows[0];
  ok(res, { average: Number(agg.average.toFixed(2)), count: agg.count, recent: rows });
}));

export default r;
