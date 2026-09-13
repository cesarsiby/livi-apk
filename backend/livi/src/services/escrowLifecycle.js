import { HttpError } from '../utils/http.js';

// V-AUDIT (section 23 — escrow transitions). Unlike orders
// (orderLifecycle.js's assertOrderTransition), escrow_transactions had no
// single source of truth for which status transitions are valid — six
// different files each enforced their own ad-hoc guard inline (a JS status
// check before an UPDATE, or an atomic `WHERE status='x'` on the UPDATE
// itself). Read every one of them before writing this table; each was
// individually correct, but there was nowhere a future change could check
// "is this transition even supposed to be possible" against.
//
// Verified transition sites (for traceability — not all six are wired to
// call assertEscrowTransition() in this pass; see this session's report
// for which are and why):
//   awaiting_payment -> payment_pending   routes/escrow.js (payment/init)
//   awaiting_payment -> cancelled         services/orderCancellation.js (pre-payment cancel)
//   payment_pending  -> funded            routes/webhooks.js, routes/escrow.js (dev payment/confirm)
//   payment_pending  -> cancelled         routes/webhooks.js (payment.failed/cancelled/expired)
//   funded           -> released          services/finance.js (releaseEscrow)
//   funded           -> disputed          routes/disputes.js (open dispute)
//   funded           -> refunded          services/orderCancellation.js, routes/finance.js (admin refund)
//   disputed         -> released          services/finance.js (releaseEscrow — dispute resolved in vendor's favor)
//   disputed         -> refunded          routes/disputes.js (dispute resolved in buyer's favor)
// Terminal (no outgoing transition anywhere in the codebase): released,
// refunded, cancelled.
const transitions = {
  awaiting_payment: new Set(['payment_pending', 'cancelled']),
  payment_pending: new Set(['funded', 'cancelled']),
  funded: new Set(['released', 'disputed', 'refunded']),
  disputed: new Set(['released', 'refunded']),
  released: new Set(),
  refunded: new Set(),
  cancelled: new Set(),
};

export function assertEscrowTransition(from, to) {
  if (from === to) return; // re-applying the same terminal state is tolerated (see orderCancellation.js's re-cancel case), not a transition
  if (!transitions[from]?.has(to)) {
    throw new HttpError(409, `Transition escrow ${from} -> ${to} interdite`, 'INVALID_ESCROW_TRANSITION');
  }
}

export { transitions };
