import { pool } from '../config/db.js';
import { redactSensitive } from '../utils/redaction.js';

export async function audit({actorUserId=null,action,entityType,entityId=null,requestId=null,ip=null,userAgent=null,before=null,after=null},client=pool){
  const safeBefore=before===null?null:redactSensitive(before);
  const safeAfter=after===null?null:redactSensitive(after);
  const safeAgent=typeof userAgent==='string'?userAgent.slice(0,1000):null;
  await client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,request_id,ip_address,user_agent,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[actorUserId,action,entityType,entityId,requestId,ip,safeAgent,safeBefore,safeAfter]);
}
