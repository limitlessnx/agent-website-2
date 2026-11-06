const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
function load(file,mocks={}) {
  const m=new Module(path.join(root,file),module); m.filename=path.join(root,file); m.paths=module.paths;
  m.require=function(name){ if(Object.hasOwn(mocks,name))return mocks[name]; return require(name); };
  m._compile(ts.transpileModule(fs.readFileSync(m.filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,m.filename);
  return m.exports;
}
const contract=load('lib/leo-execution/contract.ts');
const org='00000000-0000-4000-8000-000000000001';
const action=contract.crmAction({agent_id:org,customer_id:org,message:'Approved text'},org);
const identity={scope:'tenant',role:'manager',userId:'user',organizationId:org,channel:'chat',globalScope:false};
function fixture(options={}) {
  let row={id:'execution',organization_id:org,approval_id:'approval',principal:'user:user',session_id:'session',channel:'chat',identity,arguments:action,action_digest:contract.digest(action),status:'queued',authorized_until:new Date(Date.now()+900000).toISOString(),result:null,error:null,...options.row};
  const approval={consumed_at:new Date().toISOString(),execution_id:row.id,organization_id:org,principal:row.principal,session_id:row.session_id,channel:row.channel,action_digest:row.action_digest,...options.approval};
  const state={sends:0,checks:0,logs:0};
  const worker=load('lib/leo-execution/worker.ts',{
    './contract':{...contract,crmTriggerEnabled:()=>options.enabled!==false},
    './store':{loadExecution:async()=>({...row}),transition:async(id,from,patch)=>{if(!from.includes(row.status))return null; row={...row,...patch};return {...row};}},
    './authorization':{currentCrmIdentity:async()=>{state.checks++;if(options.revoked)throw Error('revoked');return identity;},validateCrmBindings:async()=>{if(options.tenantMismatch)throw Error('tenant');return {phone:'15550000000'};}},
    '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select(){return this;},eq(){return this;},single:async()=>({data:approval,error:null})})})},
    '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async input=>{state.sends++;assert.equal(input.text,action.message);assert.equal(input.textOnly,true);if(options.timeout)throw Error('timeout');return {providerMessageId:options.noReceipt?null:'receipt'};}},
    '@/lib/hotel-communications':{hotelConversationState:async()=>({handoff:Boolean(options.handoff),lastInboundAt:options.closed?null:new Date().toISOString()})},
    '@/lib/hotel-communication-policy':{withinWhatsAppWindow:value=>Boolean(value)},
    '@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{if(options.billing)throw Error('feature');}},
    '@/lib/canonical-customer':{getOrCreateCanonicalConversation:async()=> 'conversation',addCanonicalCrmMessage:async()=>{state.logs++;if(options.logFailure)throw Error('log');}},
  });
  return {run:()=>worker.runCrmFollowup('execution'),state,row:()=>row};
}
test('canonical action rejects arbitrary recipient, channel or worker choice and hashes key order stably',()=>{
  assert.equal(contract.digest({b:2,a:1}),contract.digest({a:1,b:2}));
  for(const extra of [{to:'other'},{task:'evil'},{channel:'email'},{lastInboundAt:'now'}]) assert.throws(()=>contract.crmAction({...action,...extra},org));
});
test('worker records provider acceptance separately from delivery and duplicate/concurrent tasks send once',async()=>{
  const f=fixture();await Promise.all([f.run(),f.run()]);
  assert.equal(f.state.sends,1);const result=await f.run();
  assert.equal(result.status,'completed');assert.equal(result.result.delivery_status,'provider_accepted');
  assert.equal(result.result.providerMessageId,'receipt');assert.equal(f.state.sends,1);
});
for(const [name,options] of Object.entries({revoked:{revoked:true},tenant:{tenantMismatch:true},expiry:{row:{authorized_until:new Date(0).toISOString()}},approval:{approval:{execution_id:'other'}},principal:{row:{principal:'user:other'}},binding:{row:{action_digest:'changed'}},handoff:{handoff:true},window:{closed:true},feature:{billing:true},disabled:{enabled:false}})) {
  test(`worker fails closed before delivery: ${name}`,async()=>{const f=fixture(options);const result=await f.run();assert.equal(result.status,'failed');assert.equal(f.state.sends,0);});
}
for(const options of [{timeout:true},{noReceipt:true}]) test(`ambiguous provider result never resends: ${JSON.stringify(options)}`,async()=>{
  const f=fixture(options);assert.equal((await f.run()).status,'unknown');await f.run();assert.equal(f.state.sends,1);
});
test('CRM log failure after durable acceptance cannot turn completion into resend',async()=>{
  const f=fixture({logFailure:true});assert.equal((await f.run()).status,'completed');await f.run();assert.equal(f.state.sends,1);
});
test('dispatcher preserves legacy default, selects only CRM and does not fall back on Trigger failure',async()=>{
  let legacy=0,trigger=0,enabled=false;
  const {dispatchLeoExecution}=load('lib/leo-execution/dispatcher.ts',{
    '@/lib/leo-n8n-executor':{executeLeoEnvelopeViaN8n:async()=>{legacy++;return {ok:true,status:'completed'};}},
    './contract':{...contract,crmTriggerEnabled:()=>enabled},
    './providers/trigger-crm':{dispatchCrmFollowup:async()=>{trigger++;throw Error('broker unavailable');}},
  });
  const envelope={requestId:'id',toolKey:contract.CRM_FOLLOWUP_TOOL,arguments:{}};
  await dispatchLeoExecution(envelope);assert.equal(legacy,1);enabled=true;
  await assert.rejects(dispatchLeoExecution(envelope),/broker unavailable/);assert.equal(trigger,1);assert.equal(legacy,1);
  await dispatchLeoExecution({...envelope,toolKey:'leo.appointment.manage'});assert.equal(legacy,2);
  await dispatchLeoExecution({...envelope,arguments:{_real_estate_approval:{}}});assert.equal(legacy,3);
  await assert.rejects(dispatchLeoExecution({...envelope,requestId:''}),/request ID/);
});

test('client retains approval only in memory and binds confirmation to exact session, channel and arguments',async()=>{
  const {executeLeoClientTool,leoExecutionMessage}=load('lib/leo-tool-client.ts');
  const approvals=new Map(), requests=[];
  const fetcher=async(_url,init)=>{requests.push(JSON.parse(init.body));return {ok:false,json:async()=>({status:'confirmation_required',approvalId:'approval',approvalToken:'secret',message:'Confirm'})};};
  const input={toolKey:contract.CRM_FOLLOWUP_TOOL,arguments:action,sessionId:'session',channel:'chat',confirmed:true};
  const first=await executeLeoClientTool(input,approvals,fetcher);
  assert.equal(requests[0].approvalToken,undefined);assert.equal(first.result.approvalToken,undefined);
  await executeLeoClientTool(input,approvals,fetcher);assert.equal(requests[1].approvalToken,'secret');
  for(const change of [{sessionId:'other'},{channel:'voice'},{arguments:{...action,message:'changed'}},{confirmed:false}]) {
    await executeLeoClientTool({...input,...change},approvals,fetcher);
    assert.equal(requests.at(-1).approvalToken,undefined);
  }
  assert.match(leoExecutionMessage({status:'queued'}),/not yet confirmed/);
  assert.doesNotMatch(leoExecutionMessage({status:'enqueue_unknown'}),/queued/);
  assert.match(leoExecutionMessage({status:'completed',result:{delivery_status:'provider_accepted'}}),/Delivery is not yet confirmed/);
});

test('real signed envelopes reject tampering and expiration before CRM enqueue',async()=>{
  process.env.LEO_EXECUTION_SIGNING_SECRET='test-only-secret';
  const core={assertLeoToolAllowed:(identity,key)=>{if(identity.scope==='tenant'&&!identity.permissions?.includes('customers.manage'))throw Error('not permitted');return {key};},enforceLeoOrganizationScope:(identity,id)=>{if(identity.scope==='tenant'&&id!==identity.organizationId)throw Error('Cross-tenant');return id;}};
  const api=load('lib/leo-execution-envelope.ts',{'@/lib/leo-core':core});
  const envelope=api.createLeoExecutionEnvelope({requestId:'approval',sessionId:'session',identity:{...identity,permissions:['customers.manage']},toolKey:contract.CRM_FOLLOWUP_TOOL,arguments:action,approvalGranted:true});
  assert.equal(api.verifyLeoExecutionEnvelope(envelope,{permissions:['customers.manage']}).identity.userId,'user');
  assert.throws(()=>api.verifyLeoExecutionEnvelope({...envelope,arguments:{...action,message:'changed'}},{permissions:['customers.manage']}),/signature/);
  assert.throws(()=>api.verifyLeoExecutionEnvelope({...envelope,expiresAt:0},{permissions:['customers.manage']}),/expired/);
  assert.throws(()=>api.verifyLeoExecutionEnvelope(envelope,{permissions:[]}),/not permitted/);
});

test('CRM adapter reconciles ambiguous enqueue using same execution and broker key, then returns queued without completion',async()=>{
  process.env.LEO_EXECUTION_SIGNING_SECRET='test-only-secret';
  const current={...identity,permissions:['customers.manage']};
  let row={id:'durable-id',approval_id:'approval',status:'pending_dispatch',result:null,error:null}, calls=[],fail=true;
  const store={transition:async(id,from,patch)=>{if(!from.includes(row.status))return null;return row={...row,...patch};},loadExecution:async()=>row};
  const api=load('lib/leo-execution/providers/trigger-crm.ts',{
    '@trigger.dev/sdk':{tasks:{trigger:async(task,payload,options)=>{calls.push({task,payload,options});if(fail)throw Error('timeout');return {id:'run'};}}},
    '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:row,error:null})})},
    '@/lib/leo-execution-envelope':{verifyLeoExecutionEnvelope:e=>({envelope:e,identity:current})},
    '../authorization':{currentCrmIdentity:async()=>current,validateCrmBindings:async()=>({})},
    '../contract':{...contract,crmTriggerEnabled:()=>true},'../store':store,
  });
  const envelope={identity:current,channel:'chat',toolKey:contract.CRM_FOLLOWUP_TOOL,requestId:'approval',sessionId:'session',approvalGranted:true,arguments:{...action,_crm_approval:{approvalId:'approval',token:'token',principal:'user:user'}}};
  assert.equal((await api.dispatchCrmFollowup(envelope)).status,'enqueue_unknown');fail=false;
  assert.equal((await api.dispatchCrmFollowup(envelope)).status,'queued');
  assert.equal(calls[0].options.idempotencyKey,calls[1].options.idempotencyKey);
  assert.deepEqual(calls[0].payload,{executionId:'durable-id'});
  await api.dispatchCrmFollowup(envelope);assert.equal(calls.length,2);
  await assert.rejects(api.dispatchCrmFollowup({...envelope,arguments:{...action,_crm_approval:{approvalId:'approval',token:'token',principal:'user:other'}}}),/approval required/);
});

test('authorization refreshes tenant membership and canonical tool permissions, rejecting revoked and cross-tenant actors',async()=>{
  let permissions=['customers.manage'],membershipId='membership';
  const core=load('lib/leo-core.ts',{'@/lib/admin-auth':{},'@/lib/client-auth':{},'@/lib/organization-membership':{}});
  const api=load('lib/leo-execution/authorization.ts',{
    '@/lib/leo-core':core,
    '@/lib/organization-membership':{getOrganizationAccessContext:async()=>({permissions,membershipId})},
    '@/lib/supabase/admin':{},'@/lib/hotel-communication-policy':{},'@/lib/real-estate-organization':{},'./contract':contract,
  });
  assert.deepEqual((await api.currentCrmIdentity({...identity,membershipId},org)).permissions,['customers.manage']);
  permissions=[];await assert.rejects(api.currentCrmIdentity(identity,org),/not permitted/);
  permissions=['customers.manage'];await assert.rejects(api.currentCrmIdentity(identity,'other-tenant'),/Cross-tenant/);
  await assert.rejects(api.currentCrmIdentity({...identity,membershipId:'old'},org),/membership changed/);
  await assert.rejects(api.currentCrmIdentity({...identity,scope:'public'},org),/authenticated/);
});

test('status endpoint keeps execution private to its initiating actor and reports stale sends as reconciliation required',async()=>{
  let current=identity,permitted=true;
  const row={id:'execution',principal:'user:user',organization_id:org,status:'sending',authorized_until:new Date(0).toISOString()};
  const route=load('app/api/leo/executions/[executionId]/route.ts',{
    'next/server':{NextResponse:{json:(body,init={})=>({body,status:init.status||200,headers:init.headers})}},
    '@/lib/leo-core':{resolveLeoIdentity:async()=>current},
    '@/lib/leo-execution/authorization':{currentCrmIdentity:async()=>{if(!permitted)throw Error('revoked');}},
    '@/lib/leo-execution/contract':contract,'@/lib/leo-execution/store':{loadExecution:async()=>row},
  });
  const get=()=>route.GET({}, {params:Promise.resolve({executionId:'execution'})});
  assert.equal((await get()).body.status,'reconciliation_required');
  permitted=false;assert.equal((await get()).status,404);
  permitted=true;current={...identity,userId:'other'};assert.equal((await get()).status,404);
  current=null;assert.equal((await get()).status,401);
});
