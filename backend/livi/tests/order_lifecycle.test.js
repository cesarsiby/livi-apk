import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOrderTransition, canBuyerConfirm } from '../src/services/orderLifecycle.js';

test('order lifecycle allows paid -> preparing -> shipping -> delivered -> completed', ()=>{
  assert.doesNotThrow(()=>assertOrderTransition('paid','preparing'));
  assert.doesNotThrow(()=>assertOrderTransition('preparing','shipping'));
  assert.doesNotThrow(()=>assertOrderTransition('shipping','delivered'));
  assert.doesNotThrow(()=>assertOrderTransition('delivered','completed'));
});
test('order lifecycle rejects direct paid -> completed', ()=>{
  assert.throws(()=>assertOrderTransition('paid','completed'));
});
test('only delivered orders can be buyer-confirmed', ()=>{
  assert.equal(canBuyerConfirm('delivered'),true);
  assert.equal(canBuyerConfirm('shipping'),false);
});
