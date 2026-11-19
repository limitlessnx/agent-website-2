/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const {org,fixture,available,count}=require('./helpers/flux-capacity-database.cjs');
const plans=load('lib/fluxknight-plans.ts'),agent='20000000-0000-4000-8000-000000000001';
async function harness(t,{failProvider=false,failPersistence=false,missingPrepared=false,settleUnavailable=false,unknownFinish=false,commitThenLoseResponse=false,balance=2}={}){
 const db=await fixture(t);await db.query('update flux_credit_wallets set balance=$1 where organization_id=$2',[balance,org]);
 const calls={provider:0,writes:[]};let pause=null,lostResponse=false;const cached=new Map();
 const admin={from(table){
  let values;const filters=[];
  const read=async()=>{
   if(table==='flux_credit_reservations')return (await db.query('select * from flux_credit_reservations where organization_id=$1 and idempotency_key=$2',[org,filters.find(([k])=>k==='idempotency_key')?.[1]])).rows[0]||null;
   if(table==='runtime_model_requests')return cached.get(filters.find(([k])=>k==='execution_id')?.[1])||null;
   if(table==='organization_subscriptions')return {id:'subscription',status:'active',metadata:{plan_code:'business'}};
   if(table==='runtime_executions')return filters.some(([k,v])=>k==='organization_id'&&v!==org)?null:{id:'execution',organization_id:org,agent_id:agent,status:'prepared'};
   if(table==='runtime_context_snapshots')return {id:'snapshot',compiled_prompt:'Synthetic',checksum:'stable'};
   if(table==='agent_provider_assignments')return {id:'assignment',limits:{}};
   throw Error('Unexpected read '+table);
  };
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},in:()=>q,order:()=>q,limit:()=>q,
   single:async()=>({data:await read(),error:null}),maybeSingle:async()=>({data:await read(),error:null}),
   update:v=>{values=v;return q;},insert:v=>{values=v;return q;},
   then(resolve,reject){calls.writes.push({table,values,filters});if(table==='runtime_model_requests')cached.set(filters.find(([k])=>k==='execution_id')?.[1],values);return Promise.resolve({data:table==='runtime_model_requests'?(missingPrepared?[]:[{id:'synthetic-request'}]):null,error:failPersistence&&table==='usage_ledger'?Error('synthetic storage failure'):null}).then(resolve,reject);}
  };return q;
 },rpc:async(name,a)=>{
  if(name==='sync_flux_credit_wallet_from_subscription')return {data:(await db.query('select * from flux_credit_wallets where organization_id=$1',[org])).rows[0],error:null};
  try{
   if(name==='get_flux_credit_availability')return {data:await available(db,a.p_organization_id),error:null};
   if(name==='reserve_flux_credit_capacity')return {data:(await db.query('select reserve_flux_credit_capacity($1,$2,$3,$4,$5,$6) as r',[a.p_organization_id,a.p_idempotency_key,a.p_fingerprint,a.p_action_key,a.p_credit_amount,a.p_source])).rows[0].r,error:null};
   if(name==='finish_flux_credit_capacity'){
    if(unknownFinish||settleUnavailable&&a.p_outcome==='settled')return {data:null,error:Error('synthetic settlement transport failure')};
    const result=(await db.query('select finish_flux_credit_capacity($1,$2,$3,$4,$5,$6,$7,$8) as r',[a.p_organization_id,a.p_reservation_id,a.p_outcome,a.p_reason,a.p_provider,a.p_provider_cost_cents,a.p_provider_usage,a.p_metadata])).rows[0].r;
    if(commitThenLoseResponse&&a.p_outcome==='settled'&&!lostResponse){lostResponse=true;return {data:null,error:Error('Synthetic lost commit response')};}
    return {data:result,error:null};
   }
   throw Error('Unexpected billing RPC '+name);
  }catch(error){return {data:null,error};}
 }};
 const credits=load('lib/flux-credits.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/fluxknight-plans':plans},'',{Error});
 const core=load('lib/flux-ai-metering-core.ts',{'@/lib/flux-credits':credits,'@/lib/fluxknight-plans':plans},'',{Error});
 const route=load('app/api/internal/runtime/provider/execute/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/runtime/auth':{assertRuntimeSecret:v=>{if(v!=='synthetic')throw Error('Unauthorized.');}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/ai-runtime/migration':{runPhase12StructuredAgent:async()=>{calls.provider++;if(pause)await pause;if(failProvider)throw Error('Synthetic provider failure');return {provider:'synthetic',modelKey:'synthetic',modelSource:'fixture',responseId:'synthetic-response',outputText:'Synthetic output',parsed:{},usage:{inputTokens:3,outputTokens:2,totalTokens:5}};}},
  '@/lib/flux-credits':credits,'@/lib/fluxknight-plans':plans,'@/lib/flux-ai-metering-core':core,
 },'',{Error});
 const request=(id='execution',extra={},secret='synthetic')=>({headers:new Headers({'x-runtime-secret':secret}),json:async()=>({organization_id:org,agent_id:agent,execution_id:id,purpose:'runtime',input:{message:'Synthetic'},...extra})});
 return {db,route,calls,request,pause:promise=>{pause=promise;}};
}
test('Web provider work reserves first, persists evidence and settles its fixed unit once',async t=>{
 const f=await harness(t);const result=await f.route.POST(f.request());assert.equal(result.status,200);assert.equal(f.calls.provider,1);
 assert.equal(await count(f.db),1);assert.deepEqual(await available(f.db),{balance:0,reserved:0,available:0});
 const replay=await f.route.POST(f.request());assert.equal(replay.status,200);assert.equal(replay.body.cached,true);assert.equal(replay.body.output_text,'Synthetic output');assert.equal(replay.body.usage.total_tokens,5);assert.equal(f.calls.provider,1);assert.equal(await count(f.db),1);
 const ledger=(await f.db.query('select metadata from flux_credit_ledger')).rows[0].metadata;assert.equal(ledger.provider_response_id,'synthetic-response');
});
test('concurrent duplicate and competing execution cannot dispatch against the same last credits',async t=>{
 const f=await harness(t);let resume;f.pause(new Promise(resolve=>{resume=resolve;}));
 const first=f.route.POST(f.request());
 for(let i=0;i<100&&f.calls.provider===0;i++)await new Promise(resolve=>setTimeout(resolve,5));
 assert.equal(f.calls.provider,1);
 const duplicate=await f.route.POST(f.request());assert.equal(duplicate.status,409);
 const competing=await f.route.POST(f.request('competing'));assert.equal(competing.status,409);assert.equal(f.calls.provider,1);
 resume();assert.equal((await first).status,200);assert.equal(await count(f.db),1);
});
test('same execution with changed input conflicts without releasing its original hold',async t=>{
 const f=await harness(t);let resume;f.pause(new Promise(resolve=>{resume=resolve;}));const first=f.route.POST(f.request());
 for(let i=0;i<100&&f.calls.provider===0;i++)await new Promise(resolve=>setTimeout(resolve,5));
 const changed=await f.route.POST(f.request('execution',{input:{message:'Changed'}}));assert.equal(changed.status,409);
 assert.equal((await available(f.db)).reserved,2);assert.equal(f.calls.provider,1);resume();await first;
});
test('provider failure releases capacity without recording usage and the same execution is never redispatched',async t=>{
 const f=await harness(t,{failProvider:true});const response=await f.route.POST(f.request());
 assert.equal(response.status,409);assert.equal(response.body.billingStatus,'released');assert.equal(response.body.providerCompleted,false);
 assert.equal(await count(f.db),0);assert.deepEqual(await available(f.db),{balance:2,reserved:0,available:2});
 await f.route.POST(f.request());assert.equal(f.calls.provider,1);
});
for(const option of ['failPersistence','settleUnavailable','unknownFinish'])test(option+' after provider completion retains capacity and truthful review state',async t=>{
 const f=await harness(t,{[option]:true});const result=await f.route.POST(f.request());
 assert.equal(result.status,409);assert.equal(result.body.providerCompleted,true);
 assert.equal(result.body.billingStatus,option==='unknownFinish'?'reconciliation_unavailable':'needs_attention');
 assert.equal(await count(f.db),0);assert.equal((await available(f.db)).reserved,2);
 await f.route.POST(f.request());assert.equal(f.calls.provider,1);
});
test('authorization and tenant-execution guards still precede reservation and dispatch',async t=>{
 const f=await harness(t);
 assert.equal((await f.route.POST(f.request('execution',{},'invalid'))).status,401);
 assert.equal((await f.route.POST(f.request('execution',{organization_id:'foreign'}))).status,404);
 assert.equal(f.calls.provider,0);assert.equal(await count(f.db),0);assert.equal((await available(f.db)).reserved,0);
});
test('email and voice keep their existing separate billing paths',async t=>{
 const f=await harness(t,{balance:100});
 assert.equal((await f.route.POST(f.request('email',{purpose:'email'}))).status,200);
 assert.equal((await f.route.POST(f.request('voice',{purpose:'voice'}))).status,200);
 assert.equal(f.calls.provider,2);assert.equal(await count(f.db),0);assert.equal((await available(f.db)).reserved,0);
});

test('a lost settlement response does not cause a second debit or a false release',async t=>{
 const f=await harness(t,{commitThenLoseResponse:true});const result=await f.route.POST(f.request());
 assert.equal(result.status,409);assert.equal(result.body.providerCompleted,true);assert.equal(result.body.billingStatus,'settled');
 assert.equal(await count(f.db),1);await f.route.POST(f.request());assert.equal(f.calls.provider,1);assert.equal(await count(f.db),1);
});
test('unavailable failure reconciliation retains the hold and never invents a release',async t=>{
 const f=await harness(t,{failProvider:true,unknownFinish:true});const result=await f.route.POST(f.request());
 assert.equal(result.body.billingStatus,'reconciliation_unavailable');assert.equal(result.body.providerCompleted,false);
 assert.equal((await available(f.db)).reserved,2);assert.equal(await count(f.db),0);
});

test('reordered JSON keys reuse the same in-progress execution without releasing or dispatching it',async t=>{
 const f=await harness(t);let resume;f.pause(new Promise(resolve=>{resume=resolve;}));
 const first=f.route.POST(f.request('execution',{input:{a:1,b:2}}));
 for(let i=0;i<100&&f.calls.provider===0;i++)await new Promise(resolve=>setTimeout(resolve,5));
 const duplicate=await f.route.POST(f.request('execution',{input:{b:2,a:1}}));
 assert.equal(duplicate.body.duplicate,true);assert.equal(f.calls.provider,1);assert.equal((await available(f.db)).reserved,2);
 resume();await first;
});
test('a settled response remains readable after wallet suspension without new consumption',async t=>{
 const f=await harness(t);await f.route.POST(f.request());
 await f.db.query("update flux_credit_wallets set status='suspended' where organization_id=$1",[org]);
 const replay=await f.route.POST(f.request());assert.equal(replay.status,200);assert.equal(replay.body.cached,true);
 assert.equal(f.calls.provider,1);assert.equal(await count(f.db),1);
});

test('a missing prepared result row retains capacity for review instead of settling without replay evidence',async t=>{
 const f=await harness(t,{missingPrepared:true});const response=await f.route.POST(f.request());
 assert.equal(response.status,409);assert.equal(response.body.billingStatus,'needs_attention');
 assert.equal(response.body.providerCompleted,true);assert.equal(await count(f.db),0);assert.equal((await available(f.db)).reserved,2);
 await f.route.POST(f.request());assert.equal(f.calls.provider,1);
});
