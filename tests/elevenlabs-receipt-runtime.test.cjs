/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const {createHmac} = require('node:crypto');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const helpers = load(path.resolve('lib/elevenlabs-webhooks.ts'));
const org = '10000000-0000-4000-8000-000000000001';
const foreign = '10000000-0000-4000-8000-000000000002';
const agent = '20000000-0000-4000-8000-000000000001';
const secret = 'synthetic-elevenlabs-secret';
const payload = () => ({event_id:'event-one',type:'post_call_transcription',data:{conversation_id:'call-one',agent_id:'provider-agent',duration_seconds:61,metadata:{organization_id:org}}});

function fixture(options={}) {
  const events = new Map();
  let agentFailures = options.agentFailures || 0;
  let callReadFailures = options.callReadFailures || 0;
  const state = {events,queries:[],rpc:[],preflights:[],legacyMetering:0,directBusinessWrites:0,commits:0,mappingOrg:org};
  const admin = {from(table) {
    let action='read',value; const filters=[];
    const query={select(){return this},insert(v){action='insert';value=v;return this},update(v){action='update';value=v;return this},upsert(v){action='upsert';value=v;return this},
      eq(k,v){filters.push([k,v]);return this},is(k,v){filters.push([k,v]);return this},contains(){return this},ilike(){return this},maybeSingle(){return this},single(){return this},
      then(resolve,reject){state.queries.push({table,action,filters});let result;
        if(table==='elevenlabs_voice_webhook_events'){
          const key=action==='insert'?value.event_key:filters.find(([k])=>k==='event_key')?.[1];let row=events.get(key);
          if(action==='insert'){if(row)result={error:{code:'23505'}};else{row={...value,processed_at:null,processing_error:null,organization_id:null};events.set(key,row);result={error:null}}}
          else if(action==='update'){if(row&&(!filters.some(([k,v])=>k==='processed_at'&&v===null)||!row.processed_at))Object.assign(row,value);result={data:row,error:null}}
          else result={data:row||null,error:options.receiptReadError?{message:'private receipt error'}:null};
        }else if(table==='agents'){
          if(agentFailures-->0)result={data:null,error:{message:'private database outage'}};
          else result={data:options.unmapped?null:{id:agent,organization_id:state.mappingOrg,name:'Synthetic voice agent'},error:options.ambiguous?{message:'multiple rows'}:null};
        }else if(table==='elevenlabs_voice_calls'&&action==='read')result={data:options.metered?{id:'voice-row',metered_at:'2026-11-18T00:00:00Z',flux_credits_charged:42}:null,error:callReadFailures-->0?{message:'synthetic read outage'}:null};
        else {state.directBusinessWrites++;result={data:{id:'legacy-write',metered_at:null},error:null};}
        return Promise.resolve(result).then(resolve,reject);
      }};return query;
    },async rpc(name,args){state.rpc.push({name,args});
      if(options.rpcFailure)return {data:null,error:{code:'PGRST202',message:'private migration detail'}};
      if(options.emptyRpc)return {data:null,error:null};
      const row=events.get(args.p_event_key);const duplicate=!!row.processed_at;
      if(!duplicate){state.commits++;row.processed_at='2026-11-18T00:00:00Z';row.processing_error=null;row.organization_id=org;}
      if(options.lostResponse&&!duplicate)return {data:null,error:{message:'response lost after commit'}};
      return {data:{ok:true,duplicate,event_key:args.p_event_key,organization_id:org,conversation_id:args.p_call_id,call_status:'completed',duration_seconds:61,flux_credits_charged:42},error:null};
    }};
  const route = load(path.resolve('app/api/webhooks/elevenlabs/post-call/route.ts'), {
    'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin}, '@/lib/elevenlabs-webhooks':helpers,
    '@/lib/flux-ai-metering-core':{preflightChargeableFluxAi:async x=>{state.preflights.push(x);return {credits:42,wallet:{planCode:'business_plus'}}},recordChargeableFluxAiUsage:async()=>{state.legacyMetering++;throw Error('Direct billing forbidden in test')}},
    '@/lib/fluxknight-plans':{calculateModeledProviderCostCents:()=>0.3},
  },'',{process:{env:{ELEVENLABS_WEBHOOK_SECRET:secret}}});
  return {state,async post(body=payload(),options={}){
    const raw=JSON.stringify(body);const timestamp=String(Math.floor(Date.now()/1000)+(options.stale?-1000:0));
    const digest=createHmac('sha256',options.invalid?'wrong':secret).update(`${timestamp}.${raw}`).digest('hex');
    return route.POST({text:async()=>raw,headers:{get:()=>`t=${timestamp},v0=${digest}`}});
  }};
}

test('signature rejection and stale signatures precede all storage and billing',async()=>{
  for(const options of [{invalid:true},{stale:true}]){const f=fixture();assert.equal((await f.post(payload(),options)).status,401);assert.equal(f.state.queries.length,0);assert.equal(f.state.rpc.length,0);}
});
test('failed receipt replay resumes processing instead of acknowledging a false duplicate',async()=>{
  const f=fixture({agentFailures:1});assert.equal((await f.post()).status,503);assert.ok(f.state.events.get('event-one').processing_error);
  const retry=await f.post();assert.equal(retry.status,200);assert.equal(f.state.commits,1);assert.equal(f.state.rpc[0].name,'apply_elevenlabs_voice_receipt');
  assert.equal(f.state.directBusinessWrites,0);assert.equal(f.state.legacyMetering,0);
});
test('completed replay bypasses lookup, preflight and additional persistence',async()=>{
  const f=fixture();await f.post();const before=f.state.queries.filter(x=>x.table==='agents').length;
  const retry=await f.post();assert.equal(retry.status,200);assert.equal(retry.body.duplicate,true);assert.equal(f.state.commits,1);assert.equal(f.state.preflights.length,1);assert.equal(f.state.queries.filter(x=>x.table==='agents').length,before);
});
test('changed payload under the same event identity is rejected before another application',async()=>{
  const f=fixture();await f.post();const changed=payload();changed.data.duration_seconds=1000;assert.equal((await f.post(changed)).status,409);assert.equal(f.state.commits,1);
});
test('payload property order does not change receipt identity',async()=>{
  const f=fixture();await f.post();const p=payload();const reordered={data:p.data,type:p.type,event_id:p.event_id};assert.equal((await f.post(reordered)).body.duplicate,true);
});
test('a foreign organization hint cannot override server agent binding',async()=>{
  const f=fixture();const p=payload();p.data.metadata.organization_id=foreign;assert.equal((await f.post(p)).status,403);assert.equal(f.state.rpc.length,0);assert.equal(f.state.preflights.length,0);
});
test('a failed receipt retains its first verified tenant when the provider mapping later changes',async()=>{
  const f=fixture({callReadFailures:1});const p=payload();delete p.data.metadata;
  assert.equal((await f.post(p)).status,503);assert.equal(f.state.events.get('event-one').organization_id,org);
  f.state.mappingOrg=foreign;assert.equal((await f.post(p)).status,403);assert.equal(f.state.rpc.length,0);assert.equal(f.state.preflights.length,0);
});
test('missing and ambiguous provider mappings fail closed without hint-only fallback',async()=>{
  for(const options of [{unmapped:true},{ambiguous:true}]){const f=fixture(options);assert.equal((await f.post()).status,503);assert.equal(f.state.rpc.length,0);}
  const f=fixture();const p=payload();delete p.data.agent_id;assert.equal((await f.post(p)).status,422);assert.equal(f.state.rpc.length,0);
});
test('server-resolved tenant and existing quote are passed to the atomic persistence boundary',async()=>{
  const f=fixture();const p=payload();delete p.data.metadata;assert.equal((await f.post(p)).status,200);const args=f.state.rpc[0].args;
  assert.equal(args.p_organization_id,org);assert.equal(args.p_agent_id,agent);assert.equal(args.p_credit_amount,42);assert.equal(args.p_plan_code,'business_plus');assert.equal(args.p_call_id,'call-one');
  assert.ok(f.state.queries.filter(x=>x.table==='elevenlabs_voice_calls').every(x=>x.filters.some(([k,v])=>k==='organization_id'&&v===org)));
});
test('missing migration or malformed atomic result never falls back to non-atomic writes',async()=>{
  for(const options of [{rpcFailure:true},{emptyRpc:true}]){const f=fixture(options);const r=await f.post();assert.equal(r.status,503);assert.doesNotMatch(r.body.error,/private/);assert.equal(f.state.directBusinessWrites,0);assert.equal(f.state.legacyMetering,0);}
});
test('a lost completion response cannot overwrite a committed receipt or debit again',async()=>{
  const f=fixture({lostResponse:true});assert.equal((await f.post()).status,503);assert.ok(f.state.events.get('event-one').processed_at);assert.equal(f.state.events.get('event-one').processing_error,null);
  assert.equal((await f.post()).body.duplicate,true);assert.equal(f.state.commits,1);assert.equal(f.state.preflights.length,1);
});
test('already-metered calls can accept another receipt without a new credit preflight',async()=>{
  const f=fixture({metered:true});assert.equal((await f.post()).status,200);assert.equal(f.state.preflights.length,0);assert.equal(f.state.rpc[0].args.p_credit_amount,0);
});
test('malformed root payloads or missing call identity fail before storage',async()=>{
  for(const p of [null,[],{event_id:'missing-call'}]){const f=fixture();assert.equal((await f.post(p)).status,400);assert.equal(f.state.queries.length,0);}
});
