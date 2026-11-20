/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-typescript.cjs');
const plans=load('lib/fluxknight-plans.ts');
const base={organization_id:'10000000-0000-4000-8000-000000000001',agent_id:'20000000-0000-4000-8000-000000000001',execution_id:'30000000-0000-4000-8000-000000000001',idempotency_key:'synthetic',customer_key:'synthetic-contact'};
function fixture({allowed=true,unavailable=false,rpcError=null,alterResult=false,authorized=true,scopeValid=true}={}){
 const calls=[];
 const helper=load('lib/runtime/communication-outcome.ts',{'@/lib/flux-credits':{assertFluxFeatureAccess:async(org,feature)=>{calls.push({gate:feature,org});if(!allowed){const e=new Error('Private policy diagnostic');e.name='FluxFeatureGateError';throw e;}if(unavailable)throw Error('Private connection string');return {planCode:'business_plus'};}},'@/lib/fluxknight-plans':plans,'@/lib/supabase/admin':{createAdminClient:()=>({from(table){const filters=[];const q={select(){return q},eq(k,v){filters.push([k,v]);return q},maybeSingle:async()=>{calls.push({table,filters});return {data:scopeValid?{id:table==='organizations'?base.organization_id:base.execution_id}:null,error:null}}};return q},rpc:async(name,args)=>{calls.push({name,args});return {error:rpcError,data:rpcError?null:{ok:true,organization_id:alterResult?'foreign':args.p_organization_id,agent_id:args.p_agent_id,execution_id:args.p_execution_id,duplicate:true,actions:[]}}}})}},'',{Error});
 const route=kind=>load(`app/api/internal/runtime/actions/${kind}/route.ts`,{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/runtime/auth':{assertRuntimeSecret:()=>{if(!authorized)throw Error('Unauthorized.')}},'@/lib/runtime/communication-outcome':helper},'',{Error});
 return {helper,calls,post:async(kind='outbound-email',body=base)=>route(kind).POST({headers:{get:()=>null},json:async()=>body})};
}
for(const kind of ['outbound-email','voice-receptionist'])test(kind+' authenticates before data access and returns explicit failure rather than success on RPC errors',async()=>{
 let f=fixture({authorized:false});assert.equal((await f.post(kind)).status,401);assert.equal(f.calls.length,0);
 f=fixture({rpcError:{message:'legacy_outcome_requires_review: private diagnostic'}});const r=await f.post(kind);assert.equal(r.status,409);assert.equal(r.body.ok,false);assert.equal(r.body.needs_attention,true);assert.equal(r.body.do_not_redispatch,true);assert.equal(r.body.error,'legacy_outcome_requires_review');assert.ok(!JSON.stringify(r).includes('private diagnostic'));
});
test('email first touch and follow-up retain distinct feature gates and existing 3/2 credit units',async()=>{
 for(const [extra,feature,credits] of [[{},'email_automation',3],[{sequence_step:2},'email_follow_up',2],[{event_type:'email.followup'},'email_follow_up',2]]){const f=fixture();const r=await f.post('outbound-email',{...base,...extra});assert.equal(r.status,200);assert.equal(f.calls.find(x=>x.gate).gate,feature);assert.equal(f.calls.find(x=>x.args).args.p_billing.credits,credits);assert.equal(f.calls.find(x=>x.args).name,'persist_runtime_communication_outcome');}
});
test('voice uses rounded terminal duration and retains no debit for a live event',async()=>{
 for(const [body,credits] of [[{decision:{call_status:'completed'},input:{duration_seconds:61}},40],[{event_type:'voice.call_ended',input:{duration_minutes:2.1}},60],[{decision:{call_status:'completed'}},20],[{decision:{call_status:'in_progress'}},0]]){const f=fixture();assert.equal((await f.post('voice-receptionist',{...base,...body})).status,200);assert.equal(f.calls.find(x=>x.gate).gate,'leo_voice');assert.equal(f.calls.find(x=>x.args).args.p_billing.credits,credits);}
});
test('invalid scopes and identifiers fail before calling the database or feature gate',async()=>{
 for(const body of [{},{...base,organization_id:'not-a-uuid'},{...base,customer_id:'not-a-uuid'},{...base,idempotency_key:'x'.repeat(513)}]){const f=fixture();assert.equal((await f.post('outbound-email',body)).status,400);assert.equal(f.calls.length,0);}
});
test('feature denial is explicit permission feedback; connection failures and foreign RPC results remain unavailable evidence',async()=>{
 let f=fixture({allowed:false});assert.equal((await f.post()).status,403);assert.equal(f.calls.filter(x=>x.gate).length,1);f=fixture({unavailable:true});assert.equal((await f.post()).body.error,'outcome_evidence_unavailable');f=fixture({alterResult:true});assert.equal((await f.post()).body.error,'outcome_evidence_unavailable');
});
test('normalization preserves safe date fallback, text trimming and finite billing quantities',()=>{
 const f=fixture();const r=f.helper.normalizeCommunicationOutcome('outbound_email_crm_v5',{...base,campaign_id:' campaign ',provider:' openai ',model:' model ',input:{email:' synthetic@example.test '},decision:{subject:' subject ',next_send_at:'bad date',follow_up_at:'2026-11-23T10:00:00Z'}});assert.equal(r.body.input.email,'synthetic@example.test');assert.equal(r.body.campaign_id,'campaign');assert.equal(r.body.provider,'openai');assert.equal(r.body.model,'model');assert.equal(r.body.decision.subject,'subject');assert.equal(r.body.decision.next_send_at,null);assert.equal(r.body.decision.follow_up_at,'2026-11-23T10:00:00.000Z');
 assert.throws(()=>f.helper.normalizeCommunicationOutcome('voice_receptionist_v6',{...base,input:{duration_seconds:1e20}}),/invalid_outcome_quantity/);
});

test('execution ownership and active lifecycle are checked before any wallet initialization or RPC mutation',async()=>{
 const f=fixture({scopeValid:false});assert.equal((await f.post()).status,404);assert.equal(f.calls.filter(x=>x.gate||x.args).length,0);
 const valid=fixture();await valid.post();const reads=valid.calls.filter(x=>x.table);assert.ok(reads[0].filters.some(([k,v])=>k==='organization_id'&&v===base.organization_id));assert.ok(reads[0].filters.some(([k,v])=>k==='agent_id'&&v===base.agent_id));assert.ok(reads[1].filters.some(([k,v])=>k==='status'&&v==='active'));
});
