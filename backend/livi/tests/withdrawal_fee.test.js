import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateWithdrawalFee} from '../src/services/withdrawal.js';

test('commission transporteur sur retrait',()=>{
 const r=calculateWithdrawalFee(2000,500,0,null); // 5%
 assert.equal(r.fee,100n);
 assert.equal(r.net,1900n);
});

test('minimum de commission',()=>{
 const r=calculateWithdrawalFee(1000,100,100, null);
 assert.equal(r.fee,100n);
 assert.equal(r.net,900n);
});
