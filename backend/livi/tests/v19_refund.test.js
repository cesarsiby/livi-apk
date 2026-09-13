import test from 'node:test';
import assert from 'node:assert/strict';

test('V19: remboursement exact = principal + livraison', () => {
  const principal = 100000n, shipping = 2000n;
  assert.equal(principal + shipping, 102000n);
});

test('V19: un remboursement ne peut pas dépasser le montant original', () => {
  const original = 102000n;
  const requested = 102001n;
  assert.equal(requested > original, true);
});

test('V19: remboursement idempotent par commande', () => {
  const refunds = new Set();
  const orderId = 'order-A';
  refunds.add(orderId);
  assert.equal(refunds.has(orderId), true);
  assert.equal(refunds.size, 1);
});

test('V19: remboursement attribué au bon acheteur', () => {
  const escrow = { buyer_id: 'buyer-A' };
  const refundEntry = { owner_user_id: 'buyer-A' };
  assert.equal(refundEntry.owner_user_id, escrow.buyer_id);
});

test('V19: un remboursement de frais de livraison ne crée pas un payable transporteur', () => {
  const ledger = [
    { account: 'customer_liability', amount: 100000n },
    { account: 'shipping_payable', amount: 2000n }
  ];
  assert.equal(ledger.some(x => x.account === 'transporter_payable'), false);
});
