const PRE_PAYMENT = new Set(['pending_payment']);
const REFUNDABLE = new Set(['paid','preparing']);

export function cancellationMode(status) {
  if (PRE_PAYMENT.has(status)) return 'cancel_without_payment';
  if (REFUNDABLE.has(status)) return 'cancel_and_refund';
  return 'not_allowed';
}
