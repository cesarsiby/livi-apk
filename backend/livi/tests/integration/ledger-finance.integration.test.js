import test from 'node:test';
import assert from 'node:assert/strict';
import { commissionAmount } from '../../src/services/finance.js';
import { calculateWithdrawalFee } from '../../src/services/withdrawal.js';

test('integration métier: commission vendeur 100000 XOF à 5%', () => {
  assert.equal(commissionAmount(100000, 500).toString(), '5000');
});

test('integration métier: retrait transporteur 2000 XOF à 5%', () => {
  const r = calculateWithdrawalFee(2000n, 500, 0, null);
  assert.equal(r.fee.toString(), '100');
  assert.equal(r.net.toString(), '1900');
});
