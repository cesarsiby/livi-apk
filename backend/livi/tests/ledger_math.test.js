import test from 'node:test';
import assert from 'node:assert/strict';

test('XOF ledger integer arithmetic remains exact for large values',()=>{
  const entries=[1000000000000n,-250000000000n,-750000000000n];
  assert.equal(entries.reduce((a,b)=>a+b,0n),0n);
});

test('imbalanced ledger is detectable',()=>{
  const entries=[1000n,-999n];
  assert.notEqual(entries.reduce((a,b)=>a+b,0n),0n);
});
