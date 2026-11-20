/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const ORG = '10000000-0000-4000-8000-000000000001';
const organization = { organization_id: ORG, organization_name: 'Same Business', organization_slug: 'same-business', provisioning: { project_id: 'project-1' } };
function harness({ configured = true, failTransfer = false, failCreate = false, running = false, qaBlocked = false } = {}) {
  const project = { id: 'project-1', name: 'Starter', organization_id: ORG, metadata: running ? { onboarding_sync_running: true } : qaBlocked ? { qa_outbound_disabled: true } : {} };
  const row = { id: 'registry-1', organization_uuid: ORG, workflow_key: 'intake', name: 'Intake', metadata: {} };
  const state = { projects: [], workflows: [], creates: 0, transfers: 0, writes: [] };
  const db = async (url, init) => {
    const body = init?.body && JSON.parse(init.body);
    if (init?.method === 'PATCH') {
      state.writes.push(url);
      if (url.startsWith('projects?')) {
        assert.ok(url.includes(`organization_id=eq.${ORG}`));
        const encoded = url.split('&metadata=eq.')[1];
        if (encoded && JSON.stringify(project.metadata) !== decodeURIComponent(encoded)) return [];
        Object.assign(project, body); return [structuredClone(project)];
      }
      Object.assign(row, body); return [structuredClone(row)];
    }
    if (url.startsWith('projects?')) return [structuredClone(project)];
    if (url.startsWith('workflow_registry?')) { assert.ok(url.includes(`organization_uuid=eq.${ORG}`)); return [structuredClone(row)]; }
    throw Error('Unexpected request ' + url);
  };
  const api = load(path.join(root, 'lib/n8n-organization-provisioning.ts'), {
    '@/lib/supabase-server-rest': { supabaseServerRequest: db },
    '@/lib/n8n-api': {
      isN8nApiConfigured: () => configured,
      findN8nProjectByName: async name => state.projects.find(p => p.name === name),
      createN8nProject: async name => { const p = { id: 'remote-project', name }; state.projects.push(p); return p; },
      findN8nWorkflowByName: async name => state.workflows.find(w => w.name === name),
      createN8nWorkflow: async input => { state.creates++; if (failCreate) throw Error('SECRET provider body'); const w = { ...input, id: 'remote-workflow', active: false }; state.workflows.push(w); return w; },
      getN8nWorkflow: async id => state.workflows.find(w => w.id === id),
      transferN8nWorkflow: async () => { state.transfers++; if (failTransfer) { failTransfer = false; throw Error('SECRET transfer'); } },
      updateN8nWorkflow: async () => { throw Error('Unexpected update'); },
    },
  });
  return { state, project, api, row };
}
test('partial failure preserves identities and retry transfers without creating another workflow', async () => {
  const { api, state, project } = harness({ failTransfer: true });
  const first = await api.provisionOrganizationN8nProject(organization);
  assert.equal(first.status, 'needs_attention'); assert.equal(state.creates, 1);
  assert.equal(project.metadata.n8n_project_id, 'remote-project');
  assert.ok(!JSON.stringify(first).includes('SECRET'));
  const second = await api.provisionOrganizationN8nProject(organization);
  assert.equal(second.status, 'awaiting_customer_configuration'); assert.equal(state.creates, 1);
  assert.equal(state.projects[0].name, `Fluxknight ${ORG}`);
});
test('uncertain workflow creation cannot automatically create again', async () => {
  const { api, state } = harness({ failCreate: true });
  assert.equal((await api.provisionOrganizationN8nProject(organization)).status, 'needs_attention');
  assert.equal((await api.provisionOrganizationN8nProject(organization)).status, 'needs_attention');
  assert.equal(state.creates, 1);
});
test('concurrent retries claim a single worker', async () => {
  const { api, state } = harness();
  const results = await Promise.all([api.provisionOrganizationN8nProject(organization), api.provisionOrganizationN8nProject(organization)]);
  assert.equal(state.creates, 1); assert.ok(results.some(r => r.status === 'provisioning_in_progress'));
});
test('missing provider configuration cannot report completion', async () => {
  const { api, state } = harness({ configured: false });
  assert.equal((await api.provisionOrganizationN8nProject(organization)).status, 'needs_attention'); assert.equal(state.creates, 0);
});
test('an existing in-flight claim never starts another attempt', async () => {
  const { api, state } = harness({ running: true });
  assert.equal((await api.provisionOrganizationN8nProject(organization)).status, 'provisioning_in_progress'); assert.equal(state.creates, 0);
});
const { evaluateTenantReadiness } = load(path.join(root, 'lib/tenant-readiness.ts'));
const checks = ['owner','template','subscription','agents','integrations','knowledge','automation','tests','approval'].map(key => ({key,ready:true,label:key,action:'Review',href:'#'}));
for (const [stage, changes] of [
  ['organization_created', {hasSetup:false}],
  ['provisioning_in_progress', {provisioning:'provisioning'}],
  ['needs_attention', {provisioning:'needs_attention'}],
  ['needs_attention', {unavailable:true}],
  ['awaiting_customer_configuration', {checks:checks.map(c=>({...c,ready:c.key!=='integrations'}))}],
  ['ready_for_testing', {checks:checks.map(c=>({...c,ready:!['tests','approval'].includes(c.key)}))}],
  ['ready_for_activation', {}],
  ['active', {live:true}],
  ['needs_attention', {live:true,checks:checks.map(c=>({...c,ready:c.key!=='tests'}))}],
]) test('readiness state: '+stage+' '+JSON.stringify(changes), () => {
  assert.equal(evaluateTenantReadiness({checks,hasSetup:true,live:false,provisioning:'',...changes}).stage,stage);
});
function routeHarness({ authorized = true, externalFails = false, scalar = true } = {}) {
  let creates = 0;
  const api = load(path.join(root, 'app/api/admin/organizations/create-and-provision/route.ts'), {
    'next/server': { NextResponse: { json: (data, options) => ({ data, status: options?.status || 200 }) } },
    '@/lib/admin-auth': { getAdminSession: async () => authorized ? { email:'admin@example.test' } : null },
    '@/lib/supabase-server-rest': { supabaseServerRequest: async () => { creates++; return scalar ? organization : [organization]; } },
    '@/lib/n8n-organization-provisioning': { provisionOrganizationN8nProject: async () => { if(externalFails) throw Error('secret'); return {complete:true,status:'awaiting_customer_configuration'}; } },
  });
  return {api,get creates(){return creates}};
}
test('creation authorizes before any database or external work', async () => {
  const h=routeHarness({authorized:false}); assert.equal((await h.api.POST({})).status,401);assert.equal(h.creates,0);
});
for (const scalar of [true,false]) test('creation preserves tenant on external failure; jsonb shape '+scalar,async()=>{
  const h=routeHarness({externalFails:true,scalar});
  const response=await h.api.POST({json:async()=>({name:'Same Business',templateSlug:'real-estate',requestId:'10000000-0000-4000-8000-000000000002'})});
  assert.equal(response.status,201);assert.equal(response.data.organization_created,true);assert.equal(response.data.ok,false);assert.equal(response.data.result.organization_id,ORG);assert.equal(response.data.provisioning.status,'needs_attention');assert.ok(!JSON.stringify(response).includes('secret'));
});
test('readiness reads are tenant scoped and database errors fail closed', async()=>{
  const calls=[];
  const admin={from(table){const filters=[];const builder={
    select(){return builder},eq(k,v){filters.push([k,v]);return builder},order(){return builder},limit(){return builder},maybeSingle(){return builder},
    then(resolve,reject){calls.push({table,filters});return Promise.resolve({data:table==='organizations'?{id:ORG,status:'active',metadata:{}}:[],error:table==='agent_test_runs'?new Error('unavailable'):null}).then(resolve,reject)},
  };return builder}};
  const evaluate=load(path.join(root,'lib/tenant-readiness.ts'));
  const api=load(path.join(root,'lib/tenant-readiness-server.ts'),{
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/organization-package-service':{getOrganizationPackageSnapshot:async id=>{assert.equal(id,ORG);return {packageEntitlements:[],organizationOverrides:[]}}},
    '@/lib/industryExperience':load(path.join(root,'lib/industryExperience.ts')),
    '@/lib/tenant-readiness':evaluate,'@/lib/hotel-inventory-readiness':{getHotelInventoryReadiness:async()=>{throw Error('Hotel not expected in this fixture')}},
  });
  const result=await api.getTenantReadiness(ORG);
  assert.equal(result.stage,'needs_attention');assert.ok(result.blockers.some(c=>c.key==='evidence'));
  for(const call of calls) assert.ok(call.filters.some(([key,value])=>key===(call.table==='organizations'?'id':'organization_id')&&value===ORG),call.table);
});

test('retry preserves mapped legacy workflow contents and name', async()=>{
  const {api,state,row}=harness();
  await api.provisionOrganizationN8nProject(organization);
  state.workflows[0].name='Customer-owned legacy name';
  state.workflows[0].nodes=[{id:'existing-customer-node'}];
  row.metadata.n8n_workflow_id=state.workflows[0].id;
  const result=await api.provisionOrganizationN8nProject(organization);
  assert.equal(result.complete,true);assert.equal(state.creates,1);
  assert.equal(state.workflows[0].name,'Customer-owned legacy name');
  assert.equal(state.workflows[0].nodes[0].id,'existing-customer-node');
});

test('marked QA projects never call any provider operation', async()=>{
  const {api,state,project}=harness({qaBlocked:true});
  const first=await api.provisionOrganizationN8nProject(organization);
  const retry=await api.provisionOrganizationN8nProject(organization);
  assert.equal(first.status,'needs_attention');assert.equal(retry.complete,false);
  assert.match(first.message,/QA tenant.*blocked/);
  assert.equal(state.creates,0);assert.equal(state.transfers,0);assert.equal(state.projects.length,0);
  assert.equal(project.metadata.qa_outbound_disabled,true);
  assert.equal(project.metadata.onboarding_sync_running,false);
});

test('saved-tenant retry reads existing metadata timezone and scopes the starter project',async()=>{
  const calls=[];let invoked;
  const api=load(path.join(root,'app/api/admin/organizations/[organizationId]/n8n/sync/route.ts'),{
    'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status||200})}},
    '@/lib/admin-auth':{getAdminSession:async()=>({email:'qa@example.test'})},
    '@/lib/supabase-server-rest':{supabaseServerRequest:async url=>{
      calls.push(url);assert.ok(!url.includes('settings'));
      if(url.startsWith('organizations?'))return [{id:ORG,name:'QA',slug:'qa',metadata:{timezone:'Europe/London'}}];
      assert.ok(url.includes('organization_id=eq.'+ORG));assert.ok(url.includes('slug=eq.platform-starter'));
      return [{id:'project-1'}];
    }},
    '@/lib/n8n-organization-provisioning':{provisionOrganizationN8nProject:async(org,options)=>{invoked={org,options};return {complete:false,status:'needs_attention',message:'QA blocked'};}},
  });
  const result=await api.POST({json:async()=>({})},{params:Promise.resolve({organizationId:ORG})});
  assert.equal(result.status,200);assert.equal(result.data.ok,false);
  assert.equal(invoked.options.timezone,'Europe/London');assert.equal(invoked.org.provisioning.project_id,'project-1');assert.equal(calls.length,2);
});
