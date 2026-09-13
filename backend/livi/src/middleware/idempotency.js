import crypto from 'node:crypto';
import { pool } from '../config/db.js';
import { HttpError } from '../utils/http.js';

export function idempotency(req,res,next){
  if (!['POST','PUT','PATCH','DELETE'].includes(req.method)) return next();
  const key=req.get('Idempotency-Key');
  if(!key) return next();
  if(key.length<8||key.length>200) throw new HttpError(400,'Idempotency-Key invalide','INVALID_IDEMPOTENCY_KEY');
  req.idempotencyKey=key;
  req.idempotencyHash=crypto.createHash('sha256').update(JSON.stringify(req.body||{})).digest('hex');
  next();
}
export async function replayIdempotency(req,res){
  if(!req.idempotencyKey) return null;
  const r=await pool.query('SELECT request_hash,response_status,response_body,expires_at FROM idempotency_keys WHERE user_id=$1 AND key=$2',[req.user?.sub||null,req.idempotencyKey]);
  const row=r.rows[0];
  if(!row) return false;
  if(row.expires_at<=new Date()){await pool.query('DELETE FROM idempotency_keys WHERE user_id=$1 AND key=$2',[req.user?.sub||null,req.idempotencyKey]);return false;}
  if(row.request_hash!==req.idempotencyHash) throw new HttpError(409,'Cette Idempotency-Key a déjà été utilisée avec une autre requête','IDEMPOTENCY_CONFLICT');
  res.status(row.response_status).json(row.response_body); return true;
}
export async function saveIdempotency(req,status,body){
  if(!req.idempotencyKey) return;
  await pool.query(`INSERT INTO idempotency_keys(user_id,key,request_hash,response_status,response_body,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '24 hours') ON CONFLICT(user_id,key) DO NOTHING`,[req.user?.sub||null,req.idempotencyKey,req.idempotencyHash,status,body]);
}
