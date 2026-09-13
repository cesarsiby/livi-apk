import test from 'node:test';
import assert from 'node:assert/strict';
import { cancellationMode } from '../src/services/orderCancellationRules.js';
import { assertOrderTransition } from '../src/services/orderLifecycle.js';

test('V20: pending_payment peut être annulée sans paiement',()=>{
  assert.equal(cancellationMode('pending_payment'),'cancel_without_payment');
});
test('V20: paid/preparing passent par remboursement',()=>{
  assert.equal(cancellationMode('paid'),'cancel_and_refund');
  assert.equal(cancellationMode('preparing'),'cancel_and_refund');
});
test('V20: payment_pending ne peut pas être annulée localement',()=>{
  assert.equal(cancellationMode('payment_pending'),'not_allowed');
});
test('V20: shipping/delivered/completed ne sont pas annulables',()=>{
  for (const s of ['shipping','delivered','completed','refunded','cancelled']) assert.equal(cancellationMode(s),'not_allowed');
});
test('V20: payment_pending -> cancelled est interdit',()=>{
  assert.throws(()=>assertOrderTransition('payment_pending','cancelled'));
});
test('V20: dispute reste possible après paiement jusqu’à livraison',()=>{
  for (const s of ['paid','preparing','shipping','delivered']) assert.doesNotThrow(()=>assertOrderTransition(s,'disputed'));
});
