import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEscrowTransition, transitions } from '../src/services/escrowLifecycle.js';

test('every valid transition documented is actually allowed', () => {
  for (const [from, tos] of Object.entries(transitions)) {
    for (const to of tos) {
      assert.doesNotThrow(() => assertEscrowTransition(from, to), `${from} -> ${to} should be allowed`);
    }
  }
});

test('re-applying the same status is tolerated, not treated as a transition', () => {
  for (const status of Object.keys(transitions)) {
    assert.doesNotThrow(() => assertEscrowTransition(status, status));
  }
});

test('terminal states (released, refunded, cancelled) have no outgoing transition', () => {
  for (const terminal of ['released', 'refunded', 'cancelled']) {
    for (const to of ['awaiting_payment', 'payment_pending', 'funded', 'disputed', 'released', 'refunded', 'cancelled']) {
      if (to === terminal) continue;
      assert.throws(() => assertEscrowTransition(terminal, to), /Transition escrow/, `${terminal} -> ${to} must be rejected`);
    }
  }
});

test('skipping straight to released/refunded without funding first is rejected', () => {
  assert.throws(() => assertEscrowTransition('awaiting_payment', 'released'));
  assert.throws(() => assertEscrowTransition('awaiting_payment', 'refunded'));
  assert.throws(() => assertEscrowTransition('payment_pending', 'released'));
  assert.throws(() => assertEscrowTransition('payment_pending', 'disputed'));
});

test('going "backwards" (funded -> payment_pending, released -> funded) is rejected', () => {
  assert.throws(() => assertEscrowTransition('funded', 'payment_pending'));
  assert.throws(() => assertEscrowTransition('released', 'funded'));
  assert.throws(() => assertEscrowTransition('disputed', 'funded'));
});

test('rejection carries a 409 + machine-readable code, matching how routes/escrow.js uses it', () => {
  try {
    assertEscrowTransition('released', 'awaiting_payment');
    assert.fail('expected assertEscrowTransition to throw');
  } catch (e) {
    assert.equal(e.status, 409);
    assert.equal(e.code, 'INVALID_ESCROW_TRANSITION');
  }
});
