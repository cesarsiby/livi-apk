import { pool, tx } from '../config/db.js';
import { releaseEscrowWithActiveCommission } from './finance.js';
import { enqueueNotification } from './notifications.js';

export async function autoReleaseEligibleEscrows({limit=50}={}) {
  const candidates = (await pool.query(`
    SELECT e.id,e.order_id,e.buyer_id,e.vendor_id,e.amount,e.shipping_fee,e.status,
           o.status AS order_status,coalesce(o.delivery_confirmed_at,o.delivered_at) AS delivered_at
    FROM escrow_transactions e
    JOIN orders o ON o.id=e.order_id
    WHERE e.status='funded'
      AND o.status='delivered'
      AND coalesce(o.delivery_confirmed_at,o.delivered_at) <= now() - interval '72 hours'
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.order_id=e.order_id AND d.status='open')
    ORDER BY coalesce(o.delivery_confirmed_at,o.delivered_at)
    LIMIT $1`,[limit])).rows;

  const results=[];
  for(const candidate of candidates){
    try {
      const result=await tx(async c=>{
        const e=(await c.query('SELECT * FROM escrow_transactions WHERE id=$1 FOR UPDATE',[candidate.id])).rows[0];
        const o=(await c.query('SELECT id,buyer_id,vendor_id,status,delivery_confirmed_at,delivered_at FROM orders WHERE id=$1 FOR UPDATE',[candidate.order_id])).rows[0];
        if(!e || !o || e.status!=='funded' || o.status!=='delivered') return {skipped:true};
        if((o.delivery_confirmed_at||o.delivered_at)===null || new Date(o.delivery_confirmed_at||o.delivered_at).getTime()>Date.now()-72*3600*1000) return {skipped:true};
        const open=(await c.query("SELECT 1 FROM disputes WHERE order_id=$1 AND status='open' LIMIT 1",[o.id])).rowCount;
        if(open) return {skipped:true};
        const released=await releaseEscrowWithActiveCommission(c,e,{metadata:{auto_release:true,reason:'72h_timeout'}});
        await c.query("UPDATE orders SET status='completed',updated_at=now() WHERE id=$1 AND status='delivered'",[o.id]);
        await enqueueNotification(c,{userId:o.buyer_id,type:'escrow_auto_released',title:'Commande finalisée',body:'Les fonds ont été libérés automatiquement après 72h.',data:{order_id:o.id}});
        await enqueueNotification(c,{userId:o.vendor_id,type:'escrow_auto_released',title:'Paiement libéré',body:'Le paiement de la commande a été libéré après 72h.',data:{order_id:o.id}});
        return {released:true,order_id:o.id,commission_bps:released.commissionBps};
      });
      if(result.released) results.push(result);
    } catch(error) {
      results.push({order_id:candidate.order_id,failed:true,error:error?.code||error?.message||'AUTO_RELEASE_FAILED'});
    }
  }
  return results;
}
