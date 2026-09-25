import { HttpError } from '../utils/http.js';

export async function startPreparationClock(c, orderId) {
  const row = (await c.query(`
    SELECT id,status,preparation_time_hours,preparation_started_at,preparation_ready_at
    FROM orders WHERE id=$1 FOR UPDATE
  `,[orderId])).rows[0];
  if (!row) throw new HttpError(404,'Commande introuvable','ORDER_NOT_FOUND');
  if (!['paid','preparing'].includes(row.status)) {
    if (row.preparation_started_at) return row;
    throw new HttpError(409,`La préparation ne peut pas démarrer depuis l’état ${row.status}.`,'PREPARATION_START_NOT_ALLOWED');
  }
  if (!row.preparation_time_hours) throw new HttpError(409,'Délai de préparation absent sur la commande.','PREPARATION_TIME_REQUIRED');
  return (await c.query(`
    UPDATE orders
       SET preparation_started_at=coalesce(preparation_started_at,now()),
           preparation_ready_at=coalesce(preparation_ready_at,now() + ($2::int * interval '1 hour')),
           updated_at=now()
     WHERE id=$1
     RETURNING id,status,preparation_time_hours,preparation_started_at,preparation_ready_at
  `,[orderId,row.preparation_time_hours])).rows[0];
}
