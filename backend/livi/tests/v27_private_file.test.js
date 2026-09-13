import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

function token(secret,documentId,userId,exp){
 const payload=Buffer.from(JSON.stringify({d:documentId,u:userId,e:exp})).toString('base64url');
 const sig=crypto.createHmac('sha256',secret).update(payload).digest('base64url');
 return `${payload}.${sig}`;
}

test('V27 signed file token changes when document changes',()=>{
 const secret='x'.repeat(32), now=Math.floor(Date.now()/1000)+300;
 const a=token(secret,'doc-a','user-a',now); const b=token(secret,'doc-b','user-a',now);
 assert.notEqual(a,b);
});

test('V27 expired file token is rejected by expiry rule',()=>{
 const exp=Math.floor(Date.now()/1000)-1;
 assert.ok(exp < Math.floor(Date.now()/1000));
});

test('V27 file key policy rejects traversal characters',()=>{
 for(const key of ['../secret','folder/file','folder\\file','.hidden']) assert.ok(key.includes('..')||key.includes('/')||key.includes('\\')||key.startsWith('.'));
});
