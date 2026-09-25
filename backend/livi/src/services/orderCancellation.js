import { HttpError } from '../utils/http.js';
import { refundEscrow } from './finance.js';
import { cancellationMode } from './orderCancellationRules.js';

export { cancellationMode };

export async function cancelOrder(c, { orderId, actorId, actorRole, reason }) {
  const order = (await c.query(`SELECT * FROM orders WHERE id=$1 FOR UPDATE`, [orderId])).rows[0];
  if (!order) throw new HttpError(404, 'Commande introuvable', 'ORDER_NOT_FOUND');

  const owns = order.buyer_id === actorId || order.vendor_id === actorId;
  if (actorRole !== 'admin' && !owns) throw new HttpError(403, 'Commande non autorisée', 'ORDER_FORBIDDEN');

  if (order.status === 'payment_pending') {
    throw new HttpError(409, 'Paiement en cours chez le partenaire; annulation locale interdite', 'PAYMENT_PENDING');
  }

  if (!['pending_payment', 'paid', 'preparing'].includes(order.status)) {
    throw new HttpError(409, 'Cette commande ne peut plus être annulée à ce stade; utilisez un litige si nécessaire', 'CANCELLATION_NOT_ALLOWED');
  }

  if (actorRole === 'buyer' || actorRole === 'client') {
    // Buyer can cancel before pickup. For paid/preparing, refund is automatic.
  } else if (actorRole === 'vendor') {
    // Vendor can cancel before shipment/pickup.
  } else if (actorRole !== 'admin') {
    throw new HttpError(403, 'Rôle non autorisé', 'ROLE_FORBIDDEN');
  }

  const escrow = (await c.query(`SELECT * FROM escrow_transactions WHERE order_id=$1 FOR UPDATE`, [orderId])).rows[0];

  if (order.status === 'pending_payment') {
    if (!escrow || !['awaiting_payment', 'cancelled'].includes(escrow.status)) {
      throw new HttpError(409, 'État escrow incompatible avec l’annulation', 'ESCROW_STATE_MISMATCH');
    }
    await restoreStockOnce(c, orderId);
    if (escrow.status === 'awaiting_payment') {
      await c.query(`UPDATE escrow_transactions SET status='cancelled',updated_at=now() WHERE id=$1`, [escrow.id]);
    }
    await c.query(
      `UPDATE orders SET status='cancelled',cancelled_at=now(),cancelled_reason=$2,updated_at=now() WHERE id=$1`,
      [orderId, reason]
    );
    return { order_id: orderId, status: 'cancelled', financial_action: 'none', stock_restored: true };
  }

  if (!escrow || escrow.status !== 'funded') {
    throw new HttpError(409, 'Commande payée sans escrow financé; réconciliation nécessaire', 'ESCROW_NOT_FUNDED');
  }

  await refundEscrow(c, escrow, { metadata: { cancellation: true, cancelled_by: actorId } });
  await c.query(`UPDATE escrow_transactions SET status='refunded',refunded_at=now(),updated_at=now() WHERE id=$1`, [escrow.id]);
  await restoreStockOnce(c, orderId);
  await c.query(
    `UPDATE orders SET status='refunded',cancelled_at=now(),cancelled_reason=$2,updated_at=now() WHERE id=$1`,
    [orderId, reason]
  );
  return { order_id: orderId, status: 'refunded', financial_action: 'full_refund', stock_restored: true };
}

async function restoreStockOnce(c, orderId) {
  const row = (await c.query(`SELECT stock_restored_at FROM orders WHERE id=$1 FOR UPDATE`, [orderId])).rows[0];
  if (!row) throw new HttpError(404, 'Commande introuvable', 'ORDER_NOT_FOUND');
  if (row.stock_restored_at) return false;

  // Variant-aware restoration. A line with product_variant_id must restore
  // product_variants.stock_qty; only unvariantized lines restore products.stock.
  await c.query(`
    UPDATE product_variants pv
       SET stock_qty=pv.stock_qty+oi.quantity, updated_at=now()
      FROM order_items oi
     WHERE oi.order_id=$1
       AND oi.product_variant_id=pv.id
  `, [orderId]);

  await c.query(`
    UPDATE products p
       SET stock=p.stock+oi.quantity, updated_at=now()
      FROM order_items oi
     WHERE oi.order_id=$1
       AND oi.product_variant_id IS NULL
       AND oi.product_id=p.id
  `, [orderId]);

  await c.query(`UPDATE orders SET stock_restored_at=now() WHERE id=$1`, [orderId]);
  return true;
}
