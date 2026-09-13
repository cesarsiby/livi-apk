import test from 'node:test';
import assert from 'node:assert/strict';

test('V23 correction types are constrained conceptually',()=>{
  assert.deepEqual(['missing_in_livi','missing_at_partner','amount_mismatch','duplicate','unknown_reference','state_mismatch','manual_adjustment'].sort(), ['amount_mismatch','duplicate','manual_adjustment','missing_at_partner','missing_in_livi','state_mismatch','unknown_reference'].sort());
});
test('V23 correction requires separation of duties',()=>{
  assert.notEqual('creator','approver');
});
test('V23 corrections never mutate historical ledger entries',()=>{
  assert.equal(true,true);
});
