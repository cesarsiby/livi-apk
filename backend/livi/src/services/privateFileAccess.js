import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { assertSafeFileKey } from '../middleware/security.js';

function secret(){
  if(!env.FILE_ACCESS_SECRET || env.FILE_ACCESS_SECRET.length < 32){
    const e=new Error('FILE_ACCESS_SECRET non configuré'); e.status=503; e.code='FILE_STORAGE_NOT_CONFIGURED'; throw e;
  }
  return env.FILE_ACCESS_SECRET;
}

export function createFileAccessToken({documentId,userId,role=null,ttlSeconds=300}){
  const exp=Math.floor(Date.now()/1000)+Math.min(Math.max(Number(ttlSeconds)||300,30),600);
  const payload=Buffer.from(JSON.stringify({d:String(documentId),u:String(userId),r:role||null,e:exp})).toString('base64url');
  const sig=crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyFileAccessToken(token,{documentId,userId=null,allowedUserIds=[],allowAdmin=false}){
  try{
    const [payload,sig]=String(token||'').split('.');
    if(!payload || !sig) return false;
    const expected=crypto.createHmac('sha256',secret()).update(payload).digest('base64url');
    const a=Buffer.from(sig); const b=Buffer.from(expected);
    if(a.length!==b.length || !crypto.timingSafeEqual(a,b)) return false;
    const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
    const allowed=[...(allowedUserIds||[])].map(String); const userOk=userId!=null ? data.u===String(userId) : allowed.includes(String(data.u)); const adminOk=allowAdmin && data.r==='admin'; return data.d===String(documentId) && (userOk||adminOk) && Number(data.e)>Math.floor(Date.now()/1000);
  }catch{return false;}
}

export function resolvePrivateFile(fileKey){
  const key=assertSafeFileKey(fileKey);
  const root=path.resolve(env.UPLOAD_DIR);
  const full=path.resolve(root,key);
  if(full!==root && !full.startsWith(`${root}${path.sep}`)){
    const e=new Error('Chemin de fichier hors stockage privé'); e.status=422; e.code='INVALID_FILE_PATH'; throw e;
  }
  return full;
}

export async function statPrivateFile(fileKey){
  const full=resolvePrivateFile(fileKey);
  return fs.promises.stat(full);
}

export function streamPrivateFile(fileKey){
  return fs.createReadStream(resolvePrivateFile(fileKey));
}
