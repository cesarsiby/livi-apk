import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive } from '../src/utils/redaction.js';

test('V26 redacts authentication and proof secrets recursively',()=>{
  const input={password:'x',nested:{pin:'123456',qr_payload:'secret',file_key:'private/key'},ok:'visible'};
  const out=redactSensitive(input);
  assert.equal(out.password,'[REDACTED]');
  assert.equal(out.nested.pin,'[REDACTED]');
  assert.equal(out.nested.qr_payload,'[REDACTED]');
  assert.equal(out.nested.file_key,'[REDACTED]');
  assert.equal(out.ok,'visible');
});

test('V26 truncates oversized strings in logs',()=>{
  const out=redactSensitive({message:'x'.repeat(5000)});
  assert.equal(out.message.length,4012);
  assert.match(out.message,/TRUNCATED/);
});
