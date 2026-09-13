import { HttpError } from '../utils/http.js';

const transitions = {
  pending_payment: new Set(['payment_pending','cancelled']),
  payment_pending: new Set(['paid']),
  paid: new Set(['preparing','cancelled','disputed']),
  preparing: new Set(['shipping','cancelled','disputed']),
  shipping: new Set(['delivered','disputed']),
  delivered: new Set(['completed','disputed']),
  disputed: new Set(['completed','refunded']),
  completed: new Set(),
  cancelled: new Set(),
  refunded: new Set()
};

export function assertOrderTransition(from,to){
  if(from===to) return;
  if(!transitions[from]?.has(to)) throw new HttpError(409,`Transition de commande ${from} -> ${to} interdite`,'INVALID_ORDER_TRANSITION');
}
export function canBuyerConfirm(status){ return status==='delivered'; }
export function canRelease(status){ return status==='completed'; }
export { transitions };
