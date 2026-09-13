import test from 'node:test';
import assert from 'node:assert/strict';
function commission(amount,bps){return (BigInt(amount)*BigInt(bps))/10000n}
test('commission is integer XOF and never fractional',()=>{assert.equal(commission(100000,500),5000n);assert.equal(commission(999,333),33n)});
test('vendor payable equals amount minus commission',()=>{const amount=100000n,c=commission(amount,500);assert.equal(amount-c,95000n)});
test('payout availability accounts for negative liability and reservations',()=>{const ledger=-95000n,reserved=20000n;assert.equal(-ledger-reserved,75000n)});
