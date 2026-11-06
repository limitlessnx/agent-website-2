const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const load=require('./helpers/load-typescript.cjs');
const A='b15f21b4-5697-4d21-9421-8a34eae3476d',LEAD='50000000-0000-4000-8000-000000000001',PROPERTY='60000000-0000-4000-8000-000000000001';
const contract=load(path.resolve('lib/limitless-followup-contract.ts'));
function harness(options={}){
 const state={filters:[],calls:[]};
 const admin={from(table){assert.equal(table,'properties');return{select(){return this},eq(k,v){state.filters.push([k,v]);return this},order(){return this},maybeSingle:async()=>({data:options.missingProperty?null:{id:PROPERTY,title:'Test estate'}}),then(resolve){return Promise.resolve({data:[{id:PROPERTY,title:'Test estate'}],error:options.loadError}).then(resolve)}}},
 rpc:async(name,args)=>{state.calls.push({name,args});return{data:{created:!options.existing,status:'active',sequence_id:'test-sequence',first_step_status:'pending'},error:options.rpcError}}};
 const route=load(path.resolve('app/api/limitless/manual-followups/route.ts'),{
  'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
  '@/lib/admin-auth':{getAdminSession:async()=>options.anonymous?null:{email:'operator@example.test'}},
  '@/lib/admin-organization-scope':{resolveAdminOrganizationScope:async()=>({organizationId:options.otherTenant?'other':A,slug:'limitless-realty',status:options.inactive?'inactive':'active'})},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{if(options.noPlan)throw Error('denied')}},
  '@/lib/limitless-followup-contract':contract,
  '@/lib/follow-up-policy':{resolveFollowUpPolicy:async()=>({}),computeSequenceStepDueAt:(_policy,anchor,index)=>new Date(Date.parse(anchor)+index*86400000).toISOString()},
 });
 const request=extra=>({json:async()=>({lead_id:LEAD,property_id:PROPERTY,reason:'Prior enquiry',notes:'Internal notes',consent_confirmed:true,organization_id:'forged',actor:'forged',...extra})});
 return{route,state,request};
}
test('manual activation uses the scoped tenant and audited operator, requests six steps with first due now, and does not claim delivery',async()=>{
 const h=harness(),before=Date.now();const result=await h.route.POST(h.request());assert.equal(result.status,201);assert.equal(result.body.status,'active');assert.equal(result.body.delivery_status,'not_sent');
 const call=h.state.calls[0];assert.equal(call.name,'activate_limitless_manual_followup');assert.equal(call.args.p_organization_id,A);assert.equal(call.args.p_actor,'admin:operator@example.test');assert.equal(call.args.p_steps.length,6);
 assert.ok(Date.parse(call.args.p_steps[0].scheduled_at)>=before&&Date.parse(call.args.p_steps[0].scheduled_at)<=Date.now());assert.ok(!JSON.stringify(call.args.p_steps).includes('Internal notes'));
});
test('anonymous, other-tenant and inactive contexts cannot read properties or activate follow-ups',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{otherTenant:true},403],[{inactive:true},403]]){const h=harness(options);assert.equal((await h.route.GET()).status,status);assert.equal((await h.route.POST(h.request())).status,status);assert.equal(h.state.calls.length,0);}
});
test('property loading is tenant scoped and independent of the draft history table',async()=>{
 const h=harness();assert.equal((await h.route.GET()).status,200);assert.ok(h.state.filters.some(([k,v])=>k==='organization_id'&&v===A));assert.equal((await harness({loadError:true}).route.GET()).status,503);
});
test('missing permission confirmation, invalid IDs, oversized input, missing properties and entitlement failures do not enroll',async()=>{
 for(const extra of [{consent_confirmed:false},{consent_confirmed:'true'},{lead_id:'bad'},{reason:''},{notes:'x'.repeat(4001)}]){const h=harness();assert.equal((await h.route.POST(h.request(extra))).status,400);assert.equal(h.state.calls.length,0);}
 for(const [options,status] of [[{missingProperty:true},404],[{noPlan:true},409]]){const h=harness(options);assert.equal((await h.route.POST(h.request())).status,status);assert.equal(h.state.calls.length,0);}
});
test('opt-out conflicts and an unapplied migration are explicit errors, while an existing active sequence is reused',async()=>{
 const blocked=harness({rpcError:{code:'P0001',message:'This customer has opted out.'}});assert.equal((await blocked.route.POST(blocked.request())).status,409);
 const missing=harness({rpcError:{code:'PGRST202'}});assert.equal((await missing.route.POST(missing.request())).status,503);
 const existing=harness({existing:true});const result=await existing.route.POST(existing.request());assert.equal(result.status,200);assert.match(result.body.message,/already active/);
});
