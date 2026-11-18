/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const catalog = load('lib/organization-context-catalog.ts');
const ORG = '10000000-0000-4000-8000-000000000001';
const adminSession = {email:'admin@example.test',userId:'30000000-0000-4000-8000-000000000001',authMode:'account'};
function database(tables = {}, errors = {}) {
  const calls = [];
  return { calls, from(table) {
    const call = {table,filters:[],select:'',insert:null}; calls.push(call);
    const q = {
      select(value){call.select=value;return q;},eq(key,value){call.filters.push([key,value]);return q;},
      order(){return q;},limit(){return q;},gte(){return q;},range(){return q;},ilike(){return q;},in(){return q;},not(){return q;},
      insert(value){call.insert=value;return q;},
      maybeSingle(){return Promise.resolve({data:tables[table]?.[0]||null,error:errors[table]||null});},
      then(resolve,reject){return Promise.resolve({data:tables[table]||[],error:errors[table]||null}).then(resolve,reject);},
    };return q;
  }};
}
function selection(db) { return load('lib/admin-workspace-selection.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/organization-context-catalog':catalog,
}); }

test('organization category uses exact configured slugs, never customer display names or substrings',()=>{
  assert.equal(catalog.organizationCategory('fluxknight'),'platform');
  assert.equal(catalog.organizationCategory('limitless-realty'),'internal');
  assert.equal(catalog.organizationCategory('gencouv'),'internal');
  for(const value of ['limitless-realty-client','fluxknight-partner','gencouv-studio',null,''])assert.equal(catalog.organizationCategory(value),'customer');
});
test('workspace selection validates kind, UUID and known system IDs before database access',async()=>{
  const db=database();const api=selection(db);
  for(const value of [{kind:'owner',id:ORG},{kind:'tenant',id:'not-a-uuid'},{kind:'system',id:'arbitrary'},{kind:'tenant',id:['id']}]) await assert.rejects(api.authorizeWorkspaceSelection(adminSession,value),error=>error.status===400);
  assert.equal(db.calls.length,0);
});
test('nonexistent tenant is denied, outcome audited, and lookup failure cannot become a valid selection',async()=>{
  const db=database();await assert.rejects(selection(db).authorizeWorkspaceSelection(adminSession,{kind:'tenant',id:ORG}),error=>error.status===404);
  const audit=db.calls.find(x=>x.table==='audit_logs').insert;assert.equal(audit.metadata.outcome,'not_found');assert.equal(audit.actor_user_id,adminSession.userId);
  const unavailable=database({}, {organizations:{message:'SECRET'}});
  await assert.rejects(selection(unavailable).authorizeWorkspaceSelection(adminSession,{kind:'tenant',id:ORG}),error=>error.status===503&&!error.message.includes('SECRET'));
  assert.equal(unavailable.calls.filter(x=>x.table==='audit_logs').length,0);
});
test('selection audits exact actor and organization before success, fails closed on audit errors, and never writes memberships',async()=>{
  const db=database({organizations:[{id:ORG,status:'suspended'}]});
  assert.equal((await selection(db).authorizeWorkspaceSelection(adminSession,{kind:'tenant',id:ORG})).id,ORG);
  const audit=db.calls.find(x=>x.table==='audit_logs').insert;assert.equal(audit.organization_id,ORG);assert.equal(audit.metadata.auth_mode,'account');assert.equal(audit.metadata.outcome,'selected');
  assert.deepEqual(db.calls[0].filters,[['id',ORG]]);assert.equal(db.calls.some(x=>x.table==='organization_memberships'),false);
  const failure=database({organizations:[{id:ORG}]},{audit_logs:{message:'SECRET'}});await assert.rejects(selection(failure).authorizeWorkspaceSelection(adminSession,{kind:'tenant',id:ORG}),error=>error.status===503&&!error.message.includes('SECRET'));
});
test('configured system contexts remain selectable without tenant records and legacy identity is explicit',async()=>{
  const db=database();await selection(db).authorizeWorkspaceSelection({email:'recovery@example.test'},{kind:'system',id:'fluxknight'});
  const audit=db.calls.find(x=>x.table==='audit_logs').insert;assert.equal(audit.organization_id,null);assert.equal(audit.actor_user_id,null);assert.equal(audit.metadata.auth_mode,'legacy');
});
test('operator data reader rejects non-admins before any service-role query',async()=>{
  let reads=0;
  const api=load('lib/admin-control-center.ts',{'@/lib/organization-context-catalog':catalog,'@/lib/admin-auth':{getAdminSession:async()=>null},'@/lib/supabase/admin':{createAdminClient:()=>{reads++;}}});
  await assert.rejects(api.getAdminControlCenter(),/administrator/);await assert.rejects(api.getAdminOrganizations(),/administrator/);assert.equal(reads,0);
});
test('operator sources fail independently, caps are explicit, secrets and unapproved audit metadata are not rendered',async()=>{
  const db=database({organizations:Array.from({length:101},(_,i)=>({id:String(i)})),audit_logs:[{id:'audit',metadata:{actor_email:'admin@example.test',outcome:'selected',password:'SECRET'}}]}, {maia_inbound_events:{message:'SECRET'}});
  const api=load('lib/admin-control-center.ts',{'@/lib/organization-context-catalog':catalog,'@/lib/admin-auth':{getAdminSession:async()=>adminSession},'@/lib/supabase/admin':{createAdminClient:()=>db}});
  const result=await api.getAdminControlCenter();assert.equal(result.organizations.rows.length,100);assert.equal(result.organizations.truncated,true);assert.equal(result.maia.available,false);assert.equal(result.jobs.available,true);assert.equal(JSON.stringify(result).includes('SECRET'),false);
  assert.equal(result.audit.rows[0].actorEmail,'admin@example.test');
  for(const call of db.calls.filter(x=>!['organizations','audit_logs'].includes(x.table)))assert.doesNotMatch(call.select,/\*|payload|secret|recipient|transcript|configuration|last_error/);
});
test('tool metrics exclude pending and unknown outcomes and never return 100 percent for zero evidence',()=>{
  const {summarizeOperationOutcomes:summary}=load('lib/operation-outcomes.ts');
  assert.equal(summary([]).successRate,null);assert.equal(summary([{status:'pending'}]).successRate,null);
  const result=summary([{status:'completed'},{status:'failed'},{status:'running'},{status:'awaiting_approval'},{status:'cancelled'}]);assert.equal(result.successRate,50);assert.equal(result.completed,2);assert.equal(result.other,3);
});
test('provider configuration checks never return secret values or imply connected status',()=>{
  const {getPlatformProviderReadiness}=load('lib/platform-provider-readiness.ts');
  const values=getPlatformProviderReadiness({ELEVENLABS_API_KEY:'SECRET',N8N_BASE_URL:'SECRET',N8N_API_KEY:'SECRET',GOOGLE_OAUTH_CLIENT_ID:'SECRET'});
  assert.equal(values.find(x=>x.name==='ElevenLabs').configured,true);assert.equal(values.find(x=>x.name==='Google Calendar OAuth').configured,false);assert.equal(JSON.stringify(values).includes('SECRET'),false);assert.equal(values.some(x=>'connected' in x),false);
});
test('Super Leo portfolio rejects tenants and classifies spoofed internal names as customers',async()=>{
  const db=database({organizations:[{id:ORG,name:'Limitless Gencouv Fluxknight customer',slug:'customer-company'},{id:'internal',name:'Limitless Realty',slug:'limitless-realty'},{id:'empty',name:'Other business',slug:''}]});
  const api=load('lib/leo-workspace-portfolio.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/organization-context-catalog':catalog});
  await assert.rejects(api.listLeoWorkspacePortfolio({scope:'tenant'}),/restricted/);assert.equal(db.calls.length,0);
  const portfolio=await api.listLeoWorkspacePortfolio({scope:'super_admin'});assert.equal(portfolio[0].relation,'client');assert.equal(portfolio[0].aliases.includes('maia'),false);assert.equal(portfolio[1].relation,'owned');
  await assert.rejects(api.resolveLeoWorkspaceTarget({scope:'super_admin'},'unknown-workspace'),/not found/);
});
test('queued Super Leo account actions recheck active admin enrollment, without an environment email requirement',async()=>{
  let active=true;let checks=0;
  const api=load('lib/leo-execution/authorization.ts',{
    '@/lib/leo-core':{enforceLeoOrganizationScope:(_identity,id)=>id,assertLeoToolAllowed:()=>{}},
    '@/lib/platform-admin-access':{isActivePlatformAdmin:async id=>{checks++;assert.equal(id,adminSession.userId);return active;}},
    '@/lib/organization-membership':{},'@/lib/supabase/admin':{},'@/lib/hotel-communication-policy':{},'@/lib/real-estate-organization':{},
    './contract':{principal:()=> 'user:'+adminSession.userId,CRM_FOLLOWUP_TOOL:'leo.crm.followup.send'},
  });
  const identity={scope:'super_admin',email:'non-environment-admin@example.test',userId:adminSession.userId};
  await api.currentCrmIdentity(identity,ORG);active=false;await assert.rejects(api.currentCrmIdentity(identity,ORG),/no longer current/);assert.equal(checks,2);
});
test('context POST denies anonymous and cross-origin changes; failed verification never sets a cookie',async()=>{
  const {NextResponse}=require('next/server');let session=null;let calls=0;let fail=false;
  class SelectionError extends Error {constructor(){super('Unavailable');this.status=503;}}
  const api=load('app/api/admin/organization-context/route.ts',{
    'next/server':{NextResponse},'@/lib/organization-context-catalog':catalog,'@/lib/admin-auth':{getAdminSession:async()=>session},
    '@/lib/admin-organization-context':{ADMIN_ORGANIZATION_COOKIE:'selection',serializeAdminOrganizationContext:x=>`${x.kind}:${x.id}`},
    '@/lib/admin-workspace-selection':{WorkspaceSelectionError:SelectionError,authorizeWorkspaceSelection:async(_s,input)=>{calls++;if(fail)throw new SelectionError();return input;}},
  }, '', {URL});
  const request=(origin='https://app.example.test')=>new Request('https://app.example.test/api/admin/organization-context',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({kind:'tenant',id:ORG})});
  assert.equal((await api.POST(request())).status,401);session=adminSession;assert.equal((await api.POST(request('https://attacker.example'))).status,403);assert.equal(calls,0);
  fail=true;const denied=await api.POST(request());assert.equal(denied.status,503);assert.equal(denied.headers.get('set-cookie'),null);
  fail=false;const response=await api.POST(request());assert.equal(response.status,200);const cookies=response.headers.getSetCookie().join(';');assert.match(cookies,/Path=\//);assert.match(cookies,/Path=\/dashboard; Max-Age=0/);assert.match(cookies,/HttpOnly/);
});
test('provisioning drill-down rejects non-admins and malformed IDs before querying; all detail reads are organization scoped',async()=>{
  let authorized=false;let readinessCalls=0;
  const db=database({organizations:[{id:ORG,name:'Tenant'}]});
  const api=load('lib/admin-provisioning-detail.ts',{
    '@/lib/organization-context-catalog':catalog,'@/lib/admin-auth':{getAdminSession:async()=>authorized?adminSession:null},'@/lib/supabase/admin':{createAdminClient:()=>db},
    '@/lib/tenant-readiness-server':{getTenantReadiness:async id=>{assert.equal(id,ORG);readinessCalls++;return {stage:'needs_attention',checks:[],blockers:[]};}},
  });
  await assert.rejects(api.getAdminProvisioningDetail(ORG),/administrator/);assert.equal(db.calls.length,0);authorized=true;
  await assert.rejects(api.getAdminProvisioningDetail('not-an-id'),/Invalid/);assert.equal(db.calls.length,0);
  const detail=await api.getAdminProvisioningDetail(ORG);assert.equal(detail.readiness.stage,'needs_attention');assert.equal(readinessCalls,1);
  for(const call of db.calls)assert.deepEqual(call.filters,[[call.table==='organizations'?'id':'organization_id',ORG]]);
});
test('missing internal workspace never falls back to platform data or a different organization',async()=>{
 const calls=[];const api=load('lib/admin-organization-scope.ts',{
  '@/lib/admin-organization-context':{getAdminOrganizationContext:async()=>({kind:'system',id:'gencouv',name:'Gencouv'})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from(){return {select(){return this;},eq(key,value){calls.push([key,value]);return this;},maybeSingle:async()=>({data:null,error:null})};}})},
 });
 const result=await api.resolveAdminOrganizationScope();assert.equal(result.status,'unavailable');assert.equal(result.systemId,'gencouv');assert.equal(result.organizationId,'unavailable:system:gencouv');assert.deepEqual(calls,[['slug','gencouv']]);
});
