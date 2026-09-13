export async function ensurePartner(c,{operationKey,idempotencyKey,type,amount,currency='XOF',orderId=null,payoutId=null,payload={},partnerCode='payment'}){
  const existing=(await c.query('SELECT * FROM partner_instructions WHERE operation_key=$1 FOR UPDATE',[operationKey])).rows[0];
  if(existing) return existing;
  const partner=(await c.query("SELECT id FROM partners WHERE code=$1 AND status='active' LIMIT 1",[partnerCode])).rows[0] || null;
  return (await c.query(`INSERT INTO partner_instructions(partner_id,operation_key,order_id,payout_id,type,amount,currency,status, payload,idempotency_key)
    VALUES($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9) RETURNING *`,[partner?.id||null,operationKey,orderId,payoutId,type,String(amount),currency,payload,idempotencyKey])).rows[0];
}

export async function markPartnerInstruction(c,{idempotencyKey,status,providerReference=null,response=null,error=null}){
  return (await c.query(`UPDATE partner_instructions SET status=$2,provider_reference=coalesce($3,provider_reference),response=coalesce($4,response),last_error=$5,attempts=attempts+1,updated_at=now() WHERE idempotency_key=$1 RETURNING *`,[idempotencyKey,status,providerReference,response,error])).rows[0]||null;
}
