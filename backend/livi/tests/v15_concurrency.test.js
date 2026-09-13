import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWithdrawalFee } from '../src/services/withdrawal.js';

test('V15 withdrawal reservation never permits fee >= gross', () => {
  assert.throws(() => calculateWithdrawalFee(100n, 10000), /commission/);
});

test('V15 withdrawal fee remains integer XOF', () => {
  const r = calculateWithdrawalFee(1999n, 500);
  assert.equal(r.fee, 99n);
  assert.equal(r.net, 1900n);
  assert.equal(r.fee + r.net, 1999n);
});
