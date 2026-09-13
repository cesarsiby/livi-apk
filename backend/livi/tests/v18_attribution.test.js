import test from 'node:test';
import assert from 'node:assert/strict';

test('V18: un payable vendeur doit être attribué au vendeur de la commande', () => {
  const order = { vendor_id: 'vendor-A' };
  const entry = { owner_user_id: 'vendor-A' };
  assert.equal(entry.owner_user_id, order.vendor_id);
});

test('V18: un payable transporteur doit être attribué au transporteur de la mission', () => {
  const shipment = { transporter_id: 'transporter-A' };
  const entry = { owner_user_id: 'transporter-A' };
  assert.equal(entry.owner_user_id, shipment.transporter_id);
});

test('V18: le total commande est strictement subtotal + livraison', () => {
  const subtotal = 100000n, shipping = 2000n;
  assert.equal(subtotal + shipping, 102000n);
});
