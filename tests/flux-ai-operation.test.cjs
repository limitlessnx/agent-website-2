/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),load=require('./helpers/load-typescript.cjs');
const base=require('./helpers/flux-recovery-database.cjs');
const plans=load('lib/fluxknight-plans.ts');
const migration=()=>fs.readFileSync('supabase/migrations/'+fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_flux_credit_channel_operations.sql')),'utf8');
async function fixture(t,{failSettlement=false}={}){
 const db=await base.fixture(t);await db.exec(migration());let calls=0;
 const admin={from(table){const filters={};const q={select:()=>q,eq:(k,v)=>{filters[k]=v;return q;},in:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:table==='organization_subscriptions'?null:(await db.query('select * from flux_credit_reservations where organization_id=$1 and idempotency_key=$2',[filters.organization_id,filters.idempotency_key])).rows[0]||null,error:null})};return q;},rpc:async(name,a)=>{
 try{
  if(name==='ensure_flux_credit_wallet')return {data:(await db.query('select * from flux_credit_wallets where organization_id=$1',[a.target_organization_id])).rows[0],error:null};
  if(name==='get_flux_credit_availability')return {data:await base.available(db,a.p_organization_id),error:null};
  if(name==='reserve_flux_credit_capacity')return {data:(await db.query('select reserve_flux_credit_capacity($1,$2,$3,$4,$5,$6) as r',[a.p_organization_id,a.p_idempotency_key,a.p_fingerprint,a.p_action_key,a.p_credit_amount,a.p_source])).rows[0].r,error:null};
  if(name==='finish_flux_credit_capacity'){
   if(failSettlement&&a.p_outcome==='settled')return {data:null,error:Error('Synthetic settlement unavailable')};
   return {data:(await db.query('select finish_flux_credit_capacity($1,$2,$3,$4,$5,$6,$7,$8) as r',[a.p_organization_id,a.p_reservation_id,a.p_outcome,a.p_reason,a.p_provider,a.p_provider_cost_cents,a.p_provider_usage,a.p_metadata])).rows[0].r,error:null};
  }
  throw Error('Unexpected RPC '+name);
 }catch(error){return {data:null,error};}
 }};
 const credits=load('lib/flux-credits.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/fluxknight-plans':plans},'',{Error});
 const op=load('lib/flux-ai-operation.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/flux-credits':credits,'@/lib/fluxknight-plans':plans},'',{Error});
 const input={organizationId:base.org,feature:'core_ai_support',action:'web_ai',source:'phase12_internal_agent',operationId:'execution-one',context:{agent_id:'synthetic-agent',step:1},request:{agentId:'synthetic',message:'Synthetic'},failure:'ai'};
 const run=async()=>{calls++;return {reply:'Synthetic reply'};};const describe=value=>({accepted:true,provider:'synthetic',usage:{totalTokens:5},cache:value});
 return {db,op,input,run,describe,calls:()=>calls};
}
test('reserves before provider work, settles once and serves a cached retry after exhaustion',async t=>{const f=await fixture(t);await f.db.query('update flux_credit_wallets set balance=2 where organization_id=$1',[base.org]);await f.op.withFluxAiOperation(f.input,async()=>{assert.equal((await base.available(f.db)).reserved,2);return f.run();},f.describe);assert.equal(await base.count(f.db),1);const ledger=(await f.db.query('select metadata from flux_credit_ledger')).rows[0];assert.equal(ledger.metadata.agent_id,'synthetic-agent');assert.equal((await f.op.withFluxAiOperation(f.input,f.run,f.describe)).reply,'Synthetic reply');assert.equal(f.calls(),1);});
test('concurrent same operation dispatches at most once and input conflicts never release its hold',async t=>{const f=await fixture(t);let release;const wait=new Promise(r=>release=r);const first=f.op.withFluxAiOperation(f.input,async()=>{await f.run();await wait;return {reply:'ok'};},f.describe);for(let i=0;i<100&&f.calls()===0;i++)await new Promise(r=>setTimeout(r,5));await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe));await assert.rejects(f.op.withFluxAiOperation({...f.input,request:{message:'Changed'}},f.run,f.describe));assert.equal(f.calls(),1);assert.equal((await base.available(f.db)).reserved,2);release();await first;});
test('failed model work releases capacity without consumption and terminal retry cannot redispatch',async t=>{const f=await fixture(t);await assert.rejects(f.op.withFluxAiOperation(f.input,async()=>{await f.run();throw Error('Synthetic provider failure');},f.describe));assert.equal((await base.available(f.db)).reserved,0);assert.equal(await base.count(f.db),0);await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe));assert.equal(f.calls(),1);});
test('unknown delivery retains capacity; definite rejection releases it',async t=>{const f=await fixture(t);await assert.rejects(f.op.withFluxAiOperation({...f.input,failure:'delivery'},async()=>{throw Error('Synthetic lost response');},f.describe));assert.equal((await base.available(f.db)).reserved,2);await assert.rejects(f.op.withFluxAiOperation({...f.input,operationId:'another',failure:'delivery'},async()=>{throw Object.assign(Error('Synthetic rejected'),{status:400});},f.describe));assert.equal((await base.available(f.db)).reserved,2);assert.equal(await base.count(f.db),0);});
test('completed but unsettled operation is reviewable and recovers through the same audited RPC',async t=>{const f=await fixture(t,{failSettlement:true});await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe),e=>e.doNotRedispatch&&e.providerCompleted);const r=(await f.db.query('select * from flux_credit_reservations')).rows[0];assert.equal(r.status,'needs_attention');assert.equal(await base.count(f.db),0);assert.equal((await base.reconcile(f.db,r)).outcome,'settled');assert.equal((await base.reconcile(f.db,r)).outcome,'already_settled');assert.equal(await base.count(f.db),1);assert.equal((await f.db.query('select metadata from flux_credit_ledger')).rows[0].metadata.operation_context.agent_id,'synthetic-agent');});
test('modified completion proof cannot authorize recovery',async t=>{const f=await fixture(t,{failSettlement:true});await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe));await f.db.exec("update flux_credit_reservations set metadata=jsonb_set(metadata,'{operation_completion_sha256}','\"wrong\"')");const r=(await f.db.query('select * from flux_credit_reservations')).rows[0];assert.equal((await base.reconcile(f.db,r)).outcome,'blocked');assert.equal(await base.count(f.db),0);});
test('billing period totals use half-open wallet bounds, not month or truncated history',async t=>{const f=await fixture(t);await f.db.exec("update flux_credit_wallets set current_period_start='2026-10-20',current_period_end='2026-11-20'");for(const [at,delta,type,org] of [['2026-10-21',-2,'usage',base.org],['2026-11-01',-4,'usage',base.org],['2026-10-19',-9,'usage',base.org],['2026-11-20',-9,'usage',base.org],['2026-11-02',100,'top_up',base.org],['2026-11-03',-9,'usage',base.other]])await f.db.query('insert into flux_credit_ledger(organization_id,wallet_organization_id,transaction_type,action_key,credit_delta,balance_after,provider_cost_cents,customer_value_cents,created_at) values($1,$1,$2,\'web_ai\',$3,100,1,2,$4)',[org,type,delta,at]);const result=(await f.db.query('select get_flux_credit_period_usage($1) as r',[base.org])).rows[0].r;assert.equal(result.usedCredits,6);assert.equal(result.usageEvents,2);assert.equal(result.providerCostCents,2);});
for(const field of ['organization_id','reservation_id','fingerprint','source','action','credits','provider_completed'])test('recovery rejects a completion proof bound to the wrong '+field,async t=>{
 const f=await fixture(t,{failSettlement:true});await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe));
 const r=(await f.db.query('select * from flux_credit_reservations')).rows[0];
 const proof=JSON.parse(r.metadata.operation_completion_json);proof[field]=field==='credits'?999:field==='provider_completed'?false:'foreign';const raw=JSON.stringify(proof);
 await f.db.query('update flux_credit_reservations set metadata=metadata || $1::jsonb where id=$2',[JSON.stringify({operation_completion_json:raw,operation_completion_sha256:require('node:crypto').createHash('sha256').update(raw).digest('hex')}),r.id]);
 assert.equal((await base.reconcile(f.db,r)).outcome,'blocked');assert.equal(await base.count(f.db),0);
});
test('channel recovery preserves tenant scope and audit failure rolls back settlement',async t=>{
 const f=await fixture(t,{failSettlement:true});await assert.rejects(f.op.withFluxAiOperation(f.input,f.run,f.describe));const r=(await f.db.query('select * from flux_credit_reservations')).rows[0];
 await assert.rejects(base.reconcile(f.db,r,{organization:base.other}),/inside organization/);
 await f.db.exec("create function reject_operation_audit() returns trigger language plpgsql as $$begin raise exception 'Synthetic audit unavailable';end$$;create trigger reject_operation_audit before insert on audit_logs for each row execute function reject_operation_audit();");
 await assert.rejects(base.reconcile(f.db,r),/Synthetic audit unavailable/);assert.equal(await base.count(f.db),0);assert.equal((await base.available(f.db)).reserved,2);
});
test('period totals include more than 5000 rows without sampling',async t=>{
 const f=await fixture(t);await f.db.query("insert into flux_credit_ledger(organization_id,wallet_organization_id,transaction_type,action_key,credit_delta,balance_after,provider_cost_cents,customer_value_cents) select $1,$1,'usage','web_ai',-2,100,1,2 from generate_series(1,5011)",[base.org]);
 let result=(await f.db.query('select get_flux_credit_period_usage($1) as r',[base.org])).rows[0].r;assert.equal(result.usedCredits,10022);assert.equal(result.usageEvents,5011);

});
test('financial RPCs remain service-only and reconciliation replacement rejects schema drift',async t=>{
 const f=await fixture(t);await f.db.exec('set role authenticated');await assert.rejects(f.db.query('select get_flux_credit_period_usage($1)',[base.org]),/permission denied/);await f.db.exec('reset role');
 await assert.rejects(f.db.exec(migration()),/drifted/);await f.db.exec('rollback');
});
