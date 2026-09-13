import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { safeCompareHex, assertSafeFileKey } from '../src/middleware/security.js';

test('safeCompareHex rejects different lengths and accepts equal digests',()=>{
 const a=crypto.createHash('sha256').update('x').digest('hex');
 assert.equal(safeCompareHex(a,a),true);
 assert.equal(safeCompareHex(a,a.slice(0,-2)),false);
});

test('KYC file keys reject traversal and path separators',()=>{
 assert.throws(()=>assertSafeFileKey('../secret'));
 assert.throws(()=>assertSafeFileKey('folder/file.pdf'));
 assert.equal(assertSafeFileKey('kyc_ABC123456789'), 'kyc_ABC123456789');
});
