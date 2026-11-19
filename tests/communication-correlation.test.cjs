/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const org='10000000-0000-4000-8000-000000000001',customer='20000000-0000-4000-8000-000000000001',correlation='30000000-0000-4000-8000-000000000001';
function fixture(error=null){
 const calls=[];const helper=load('lib/canonical-customer.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:error?null:'timeline-id',error};}})}});
 return {helper,calls};
}
const input={organizationId:org,customerId:customer,eventType:'communication.observed',title:'Provider evidence'};
test('explicit correlation reaches the existing timeline RPC without becoming tenant authority',async()=>{
 const f=fixture();assert.equal(await f.helper.addCanonicalTimelineEvent({...input,correlationId:correlation,metadata:{organization_id:'foreign',correlation_id:'untrusted'}}),'timeline-id');
 const {name,args}=f.calls[0];assert.equal(name,'add_customer_timeline_event');assert.equal(args.p_correlation_id,correlation);assert.equal(args.p_organization_id,org);assert.equal(args.p_customer_id,customer);
});
test('legacy callers retain null correlation and metadata cannot invent a trace identity',async()=>{
 for(const value of [undefined,null,'']){const f=fixture();await f.helper.addCanonicalTimelineEvent({...input,correlationId:value,metadata:{correlation_id:correlation}});assert.equal(f.calls[0].args.p_correlation_id,null);}
});
test('timeline persistence failure is visible and never retried with an invented correlation',async()=>{
 const f=fixture(new Error('synthetic storage unavailable'));await assert.rejects(f.helper.addCanonicalTimelineEvent({...input,correlationId:correlation}),/synthetic storage unavailable/);assert.equal(f.calls.length,1);
});
function leadFixture(){
 const calls=[];const admin={
  from:table=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,update:()=>q,maybeSingle:async()=>({data:table==='organizations'?{id:org}:null,error:null}),then:(resolve,reject)=>Promise.resolve({data:[],error:null}).then(resolve,reject)};return q;},
  rpc:async(name,args)=>{calls.push({name,args});return {data:name==='resolve_crm_customer'?{customer_id:customer,status:'matched'}:name==='get_or_create_crm_conversation'?'40000000-0000-4000-8000-000000000001':'timeline-id',error:null};},
 };
 return {calls,helper:load('lib/canonical-customer.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}})};
}
test('public Leo capture uses the persisted session ID for the trace and the resolved platform organization for authority',async()=>{
 const f=leadFixture();await f.helper.canonicalizePublicLeoLead({leadId:'50000000-0000-4000-8000-000000000001',sessionId:correlation,email:'synthetic@example.test'});
 const args=f.calls.find(x=>x.name==='add_customer_timeline_event').args;assert.equal(args.p_correlation_id,correlation);assert.equal(args.p_organization_id,org);assert.equal(args.p_customer_id,customer);assert.equal(args.p_event_type,'lead.public_leo_captured');
});
test('evaluation capture retains its evaluation ID across conversation and timeline evidence',async()=>{
 const f=leadFixture();await f.helper.canonicalizeEvaluationLead({evaluationId:correlation,fullName:'Synthetic lead',email:'synthetic@example.test',phone:'',companyName:'Synthetic'});
 const args=f.calls.find(x=>x.name==='add_customer_timeline_event').args;assert.equal(args.p_correlation_id,correlation);assert.equal(args.p_source_id,correlation);assert.equal(args.p_organization_id,org);assert.equal(args.p_channel,'web');
});
function inspectionFixture({accepted=true}={}){
 const traces=[],updates=[],calls={sends:0,metering:0};let claimed=false;
 const inspection={id:correlation,organization_id:org,customer_id:customer,status:'completed',timezone:'UTC',source:'synthetic',requested_start_at:'2026-11-17T10:00:00Z'};
 const admin={from:table=>{
  const filters=[];let values;
  const read=()=>{
   if(table==='organizations')return {id:org,slug:'synthetic-realty',status:'active',metadata:{industry_slug:'real-estate'}};
   if(table==='real_estate_inspection_automation')return {status:'enabled'};
   if(table==='real_estate_inspections')return inspection;
   if(table==='crm_customers')return {id:customer,phone:'15555550123',full_name:'Synthetic',metadata:{}};
   if(table==='organization_customer_stages')return {id:'stage',key:'negotiation'};
   return null;
  };
  const finish=single=>{if(table!=='organizations')assert.ok(filters.some(([k,v])=>k==='organization_id'&&v===org)||table==='real_estate_inspection_jobs'&&values?.organization_id===org,'Scoped '+table);return {data:single?(read()||{id:'synthetic-job'}):[],error:null};};
  const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q;},in:()=>q,not:()=>q,order:()=>q,limit:()=>q,
   update:v=>{values=v;updates.push({table,values:v});return q;},insert:v=>{values=v;return q;},maybeSingle:async()=>({data:read(),error:null}),single:async()=>finish(true),then:(resolve,reject)=>Promise.resolve(finish(false)).then(resolve,reject)};return q;
 },rpc:async(name,args)=>{
  if(name==='add_customer_timeline_event'){traces.push(args);return {data:'timeline-id',error:null};}
  if(name==='transition_real_estate_inspection_with_audit')return {data:inspection,error:null};
  if(name==='claim_real_estate_inspection_job'){assert.equal(args.p_organization_id,org);if(claimed)return {data:null,error:null};claimed=true;return {data:{id:'synthetic-job',inspection_id:correlation,job_type:'outcome_followup'},error:null};}
  throw Error('Unexpected RPC '+name);
 }};
 const canonical=load('lib/canonical-customer.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}});
 const worker=load('lib/real-estate-inspection-worker.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/canonical-customer':canonical,
  '@/lib/flux-ai-metering-core':{preflightChargeableFluxAi:async()=>undefined,recordChargeableFluxAiUsage:async()=>calls.metering++},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async()=>{calls.sends++;return {provider:'synthetic',providerMessageId:accepted?'synthetic-message':null};}},
 });
 const service=load('lib/real-estate-inspections.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/canonical-customer':canonical,
  '@/lib/real-estate-timezone':{},'@/lib/system-orchestrator':{},'@/lib/appointment-scheduling':{},'@/lib/real-estate-inspection-policy':{assertTransition:()=>undefined},
 });
 return {worker,service,traces,updates,calls};
}
test('inspection outcome and provider-accepted follow-up retain the same inspection trace',async()=>{
 const f=inspectionFixture();await f.service.recordRealEstateInspectionOutcome({organizationId:org,inspectionId:correlation,outcome:'completed'});
 await f.worker.processDueRealEstateInspectionJobs({organizationId:org,limit:1});
 assert.equal(f.traces.length,2);for(const args of f.traces){assert.equal(args.p_correlation_id,correlation);assert.equal(args.p_source_id,correlation);assert.equal(args.p_organization_id,org);assert.equal(args.p_customer_id,customer);}
 assert.equal(f.calls.sends,1);assert.equal(f.calls.metering,1);assert.equal(f.updates.find(x=>x.table==='real_estate_inspection_jobs'&&x.values.status==='completed').values.delivery_status,'accepted');
});
test('unconfirmed provider acceptance emits no successful follow-up timeline and no metering',async()=>{
 const f=inspectionFixture({accepted:false});await f.worker.processDueRealEstateInspectionJobs({organizationId:org,limit:1});assert.equal(f.traces.length,0);assert.equal(f.calls.metering,0);
 assert.equal(f.updates.find(x=>x.table==='real_estate_inspection_jobs').values.payload.delivery_status,'unknown');
});
