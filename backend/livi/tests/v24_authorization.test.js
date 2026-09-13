import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOwner, assertParty } from '../src/utils/authorization.js';

test('V24 ownership allows only exact owner', () => {
  assert.doesNotThrow(() => assertOwner('u1','u1','commande'));
  assert.throws(() => assertOwner('u1','u2','commande'), /non autorisée/);
});

test('V24 role allowlist rejects unknown roles', () => {
  for (const role of ['client','vendor','transporter','admin']) assert.doesNotThrow(() => assertParty(role));
  assert.throws(() => assertParty('unknown'), /non autorisée/);
});
