/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const {org,fixture,available,count}=require('./helpers/flux-capacity-database.cjs');
const emailDecision=load('lib/runtime/email-decision.ts');
const emailInput={event_type:'campaign.sequence_due',recipient:{email:'synthetic@example.test',offer:'Synthetic offer'},sequence_step:1};
const plans=load('lib/fluxknight-plans.ts'),agent='20000000-0000-4000-8000-000000000001';
async function harness(t,{failProvider=false,failPersistence=false,missingPrepared=false,settleUnavailable=false,unknownFinish=false,commitThenLoseResponse=false,balance=2,followUp=false,bindingDenied=false,historicalPartial=false}={}){
 const db=await fixture(t);await db.query("update flux_credit_wallets set balance=$1, plan_code='business_plus' where organization_id=$2",[balance,org]);
 let signalProvider;
 const providerStarted=new Promise(resolve=>{signalProvider=resolve;});
 const calls={provider:0,writes:[]};let pause=null,lostResponse=false;const cached=new Map();
 const admin={from(table){
  let values;const filters=[];
  const read=async()=>{
   if(table==='flux_credit_reservations')return (await db.query('select * from flux_credit_reservations where organization_id=$1 and idempotency_key=$2',[org,filters.find(([k])=>k==='idempotency_key')?.[1]])).rows[0]||null;
   if(table==='agent_workflow_assignments')return bindingDenied?null:{id:'workflow-binding'};
   if(table==='runtime_progress_events')return calls.writes.find(row=>row.table===table)||null;
   if(table==='flux_credit_ledger')return null;
   if(table==='conversation_messages')return historicalPartial?{id:'historical-message'}:null;
   if(table==='runtime_model_requests')return cached.get(filters.find(([k])=>k==='execution_id')?.[1])||null;
   if(table==='organization_subscriptions')return {id:'subscription',status:'active',metadata:{plan_code:'business_plus'}};
   if(table==='runtime_executions'){
    if(filters.some(([k,v])=>k==='organization_id'&&v!==org))return null;
    const id=filters.find(([k])=>k==='id')?.[1];
    const input=id==='email'?{workflow_key:'outbound_email_crm_v5',channel:'email',event_type:emailInput.event_type,sequence_step:followUp?2:1,email:emailInput.recipient.email}:id==='voice'?{workflow_key:'voice_receptionist_v6',channel:'voice'}:{};
    return {id,organization_id:org,agent_id:agent,status:'running',input};
   }
   if(table==='runtime_context_snapshots')return {id:'snapshot',compiled_prompt:'Synthetic',checksum:'stable'};
   if(table==='agent_provider_assignments')return {id:'assignment',limits:{}};
   throw Error('Unexpected read '+table);
  };
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},in:()=>q,neq:()=>q,contains:()=>q,order:()=>q,limit:()=>q,
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
  '@/lib/ai-runtime/migration':{runPhase12StructuredAgent:async input=>{calls.provider++;calls.providerInput=input;signalProvider();if(pause)await pause;if(failProvider)throw Error('Synthetic provider failure');return {provider:'synthetic',modelKey:'synthetic',modelSource:'fixture',responseId:'synthetic-response',outputText:'Synthetic output',parsed:{},usage:{inputTokens:3,outputTokens:2,totalTokens:5}};}},
  '@/lib/flux-credits':credits,'@/lib/fluxknight-plans':plans,'@/lib/flux-ai-metering-core':core,'@/lib/runtime/email-decision':emailDecision,
 },'',{Error});
 const request=(id='execution',extra={},secret='synthetic')=>({headers:new Headers({'x-runtime-secret':secret}),json:async()=>({organization_id:org,agent_id:agent,execution_id:id,purpose:'runtime',input:{message:'Synthetic'},...extra})});
 return {db,route,calls,request,providerStarted,pause:promise=>{pause=promise;}};
}
test('Web provider work reserves first, persists evidence and settles its fixed unit once',async t=>{
 const f=await harness(t);const result=await f.route.POST(f.request());assert.equal(result.status,200);assert.equal(f.calls.provider,1);
 assert.equal(await count(f.db),1);assert.deepEqual(await available(f.db),{balance:0,reserved:0,available:0});
 const replay=await f.route.POST(f.request());assert.equal(replay.status,200);assert.equal(replay.body.cached,true);assert.equal(replay.body.output_text,'Synthetic output');assert.equal(replay.body.usage.total_tokens,5);assert.equal(f.calls.provider,1);assert.equal(await count(f.db),1);
 const ledger=(await f.db.query('select metadata from flux_credit_ledger')).rows[0].metadata;assert.equal(ledger.provider_response_id,'synthetic-response');
 const reservation=(await f.db.query('select * from flux_credit_reservations')).rows[0];
 for(const table of ['runtime_model_requests','usage_ledger','runtime_progress_events']){
  const value=f.calls.writes.find(row=>row.table===table).values;
  const proof=value.response_payload||value.metadata||value.payload;
  assert.equal(proof.credit_reservation_id,reservation.id);assert.equal(proof.credit_request_fingerprint,reservation.request_fingerprint);
 }
 assert.equal(f.calls.writes.find(row=>row.table==='runtime_model_requests').values.response_payload.credit_provider_cost_cents,1);assert.equal(f.calls.writes.find(row=>row.table==='runtime_model_requests').values.response_payload.credit_usage_quantity,5);
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
test('actual email envelopes hold the scoped email charge and replay without redispatch',async t=>{
 const f=await harness(t,{balance:3});
 const result=await f.route.POST(f.request('email',{purpose:undefined,input:JSON.stringify(emailInput)}));
 assert.equal(result.status,200,JSON.stringify(result.body));
 assert.equal(result.body.response_id,'synthetic-response');assert.equal(result.body.id,result.body.response_id);
 assert.equal(f.calls.providerInput.input.recipient.offer,'Synthetic offer');
 assert.deepEqual(f.calls.providerInput.outputSchema,emailDecision.EMAIL_DECISION_SCHEMA);
 assert.equal(await count(f.db),0);assert.deepEqual(await available(f.db),{balance:3,reserved:3,available:0});
 const duplicate=await f.route.POST(f.request('email',{input:emailInput}));
 assert.equal(duplicate.status,200);assert.equal(duplicate.body.cached,true);assert.equal(f.calls.provider,1);
 const changed=await f.route.POST(f.request('email',{input:{...emailInput,recipient:{...emailInput.recipient,offer:'Changed'}}}));
 assert.equal(changed.status,409);assert.equal(f.calls.provider,1);
});
test('voice is routed by its binding without web AI billing and a spoofed purpose is rejected',async t=>{
 const f=await harness(t,{balance:100});
 assert.equal((await f.route.POST(f.request('execution',{purpose:'voice'}))).status,409);
 assert.equal((await f.route.POST(f.request('voice'))).status,200);
 assert.equal(f.calls.providerInput.kind,'voice');
 assert.equal(f.calls.provider,1);assert.equal(await count(f.db),0);assert.equal((await available(f.db)).reserved,0);
});
test('email follow-up holds two credits when provider completion is uncertain',async t=>{
 const f=await harness(t,{balance:2,followUp:true,failProvider:true});
 const request=f.request('email',{input:{...emailInput,sequence_step:2}});
 const result=await f.route.POST(request);
 assert.equal(result.body.billingStatus,'needs_attention',JSON.stringify(result.body));
 assert.equal((await available(f.db)).reserved,2);
 assert.equal((await f.route.POST(request)).status,409);
 assert.equal(f.calls.provider,1);
});
test('email provider requires an authorized binding and sufficient capacity',async t=>{
 for(const options of [{balance:3,bindingDenied:true},{balance:2},{balance:3,historicalPartial:true}]){
  const f=await harness(t,options);
  assert.equal((await f.route.POST(f.request('email',{input:emailInput}))).status,409);
  assert.equal(f.calls.provider,0);
 }
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

test('the checked-in email workflow sends structured input the provider can consume', () => {
 const {nodes}=require('../n8n/workflows/outbound-email-crm.json');
 const env={organization_id:org,agent_id:agent,event_type:emailInput.event_type,input:emailInput.recipient,sequence_step:1};
 const build=nodes.find(node=>node.id==='email-build').parameters.jsCode;
 const workflowData={'Validate Outbound Envelope':env,'Queue Email Execution':{execution_id:'email'}};
 const [result]=new Function('$','$json',build)(name=>({first:()=>({json:workflowData[name]})}),{compiled_prompt:'Synthetic snapshot'});
 assert.deepEqual(result.json.provider_request.input.recipient,emailInput.recipient);
 assert.equal(result.json.provider_request.input.event_type,emailInput.event_type);
 assert.equal(result.json.provider_request.execution_id,'email');
 const parse=nodes.find(node=>node.id==='email-parse').parameters.jsCode;
 const [decision]=new Function('$','$json',parse)(()=>({first:()=>result}),{output_text:'{"action":"skip"}',response_id:'synthetic-response'});
 assert.equal(decision.json.provider_response_id,'synthetic-response');
});

test('concurrent email requests hold capacity once before producing a cached result',async t=>{
 const f=await harness(t,{balance:3});let resume;f.pause(new Promise(resolve=>{resume=resolve;}));
 const request=f.request('email',{input:emailInput});
 const first=f.route.POST(request);
 try {
  await Promise.race([f.providerStarted,first.then(result=>assert.fail(JSON.stringify(result.body)))]);
  assert.equal(f.calls.provider,1);
  const retry=await f.route.POST(request);
  assert.equal(retry.status,409);
  assert.equal((await available(f.db)).reserved,3);
  assert.equal(await count(f.db),0);
 } finally {resume();}
 assert.equal((await first).status,200);
 assert.equal((await f.route.POST(request)).body.cached,true);
 assert.equal(f.calls.provider,1);
});
