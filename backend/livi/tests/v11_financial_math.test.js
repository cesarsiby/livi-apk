import test from 'node:test';
import assert from 'node:assert/strict';

const commissionAmount=(amount,bps)=>BigInt(amount)*BigInt(bps)/10000n;
const withdrawal=(amount,bps,min,max)=>{
 const fee0=commissionAmount(amount,bps);
 const fee=min!=null && fee0<min?BigInt(min):fee0;
 const capped=max!=null && fee>BigInt(max)?BigInt(max):fee;
 return {fee:capped,net:BigInt(amount)-capped};
};

test('V11: commission 100000 XOF à 5%',()=>assert.equal(commissionAmount(100000n,500n),5000n));
test('V11: retrait livreur 2000 XOF à 5%',()=>assert.deepEqual(withdrawal(2000n,500,0,null),{fee:100n,net:1900n}));
test('V11: commission plafonnée au montant',()=>assert.equal(commissionAmount(99n,10000n),99n));
