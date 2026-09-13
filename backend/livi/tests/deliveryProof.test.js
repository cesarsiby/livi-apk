import test from 'node:test';
import assert from 'node:assert/strict';
import { makeProofSecret, qrPayload } from '../src/services/deliveryProof.js';

test('preuve LIVI: secret aléatoire + PIN à 6 chiffres', () => {
  const a = makeProofSecret();
  const b = makeProofSecret();
  assert.notEqual(a.token, b.token);
  assert.match(a.pin, /^\d{6}$/);
  assert.equal(a.tokenHash.length, 64);
});

test('QR payload contient uniquement les informations nécessaires à la validation', () => {
  const s = makeProofSecret();
  const payload = JSON.parse(qrPayload({ proofId: '00000000-0000-0000-0000-000000000001', token: s.token }));
  assert.equal(payload.app, 'LIVI');
  assert.equal(payload.v, 1);
  assert.equal(payload.proof_id, '00000000-0000-0000-0000-000000000001');
  assert.equal(payload.token, s.token);
});
