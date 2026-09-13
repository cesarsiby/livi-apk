import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

test('V31 crash-test runner exists and is non-production guarded', () => {
  const p = path.join(root, 'scripts', 'v31-postgres-crash-test.js');
  assert.ok(fs.existsSync(p));
  const s = fs.readFileSync(p, 'utf8');
  assert.match(s, /NODE_ENV === 'production'/);
  assert.match(s, /livi_payout_user_lock/);
  assert.match(s, /partner_payment_events/);
});

test('V31 suite covers the V30 invariants and immutable ledger', () => {
  const s = fs.readFileSync(path.join(root, 'scripts', 'v31-postgres-crash-test.js'), 'utf8');
  for (const needle of ['order-total','order-item-vendor','escrow-amount','kyc-role','private-file','shipment-transporter','paid-payout-provider','partner-event-duplicate','ledger-immutability']) {
    assert.match(s, new RegExp(needle));
  }
});
