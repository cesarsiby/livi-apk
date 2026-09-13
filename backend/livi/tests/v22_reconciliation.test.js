import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcilePartnerPayments } from '../src/services/partnerReconciliation.js';

function fakeClient(rowsByQuery){
  const calls=[];
  return {calls, async query(sql,params){
    calls.push({sql,params});
    if(sql.includes('FROM partner_payment_events')) return {rows: rowsByQuery.events || []};
    if(sql.includes('INSERT INTO partner_reconciliation_runs')) return {rows:[{id:'run-1'}]};
    if(sql.includes('INSERT INTO partner_reconciliation_items')) return {rows:[]};
    return {rows:[]};
  }};
}

test('V22 matched provider record', async()=>{
 const c=fakeClient({events:[{event_id:'E1',reference:'R1',amount:'102000',status:'processed',order_id:'O1',order_status:'paid',currency:'XOF'}]});
 const r=await reconcilePartnerPayments(c,{provider:'mock',periodStart:'2026-01-01',periodEnd:'2026-02-01',records:[{event_id:'E1',reference:'R1',amount:'102000',currency:'XOF'}]});
 assert.equal(r.totals.matched,1); assert.equal(r.items[0].discrepancy_type,'matched');
});

test('V22 amount mismatch is detected', async()=>{
 const c=fakeClient({events:[{event_id:'E1',reference:'R1',amount:'102000',status:'processed',order_id:'O1',currency:'XOF'}]});
 const r=await reconcilePartnerPayments(c,{provider:'mock',periodStart:'2026-01-01',periodEnd:'2026-02-01',records:[{event_id:'E1',reference:'R1',amount:'101000',currency:'XOF'}]});
 assert.equal(r.totals.amount_mismatch,1); assert.equal(r.items[0].discrepancy_type,'amount_mismatch');
});

test('V22 provider record missing in LIVI is detected', async()=>{
 const c=fakeClient({events:[]});
 const r=await reconcilePartnerPayments(c,{provider:'mock',periodStart:'2026-01-01',periodEnd:'2026-02-01',records:[{event_id:'E2',reference:'R2',amount:'5000',currency:'XOF'}]});
 assert.equal(r.totals.missing_in_livi,1); assert.equal(r.items[0].discrepancy_type,'missing_in_livi');
});
