/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const industry=load('lib/industryExperience.ts');
const catalog=load('lib/industryCatalog.ts');
const plans=load('lib/fluxknight-plans.ts');
const overview=load('lib/workspace-overview.ts',{'@/lib/fluxknight-plans':plans});
const org='10000000-0000-4000-8000-000000000001';
function caps(overrides={}){return {role:'owner',isOwner:true,permissions:['appointments.view'],installedSystems:['appointment-system'],systemStates:{'appointment-system':'active'},systemsUnavailable:false,agents:true,customers:true,conversations:true,systems:true,appointments:true,analytics:true,team:true,integrations:true,billing:true,support:true,...overrides};}

test('all twelve catalog industries resolve from canonical slugs and advertised names',()=>{
 assert.equal(catalog.industries.length,12);
 for(const item of catalog.industries){
  assert.equal(industry.getIndustryExperience(item.slug).slug,item.slug);
  assert.equal(industry.getIndustryExperience(item.name).slug,item.slug,item.name);
 }
 for(const alias of ['Hotel','hospitality','HOTELS'])assert.equal(industry.getIndustryExperience(alias).slug,'hotels');
 for(const alias of ['Photography','Photography Studios'])assert.equal(industry.getIndustryExperience(alias).slug,'photography-studio');
 assert.equal(industry.getIndustryExperience('A business not in the catalog').slug,'general');
 assert.equal(industry.getIndustryExperience(null).slug,'general');
 assert.equal(industry.getIndustryExperience('other').slug,'general');
});
test('nine remaining industries receive versioned configuration without tenant content or pricing',()=>{
 const expected={'sales-companies':'sales','professional-services':'sales','service-businesses':'jobs','auto-shops':'jobs','beauty-salons':'appointments','clinics':'appointments',gyms:'memberships',ecommerce:'commerce',restaurants:'restaurant'};
 for(const [slug,key] of Object.entries(expected)){
  const experience=industry.getIndustryExperience(slug),preset=industry.getIndustryWorkspacePreset(experience);
  assert.equal(preset.key,key);assert.equal(preset.version,1);assert.equal(preset.journey.length,4);assert.ok(preset.requirements.length>=3);
  assert.ok(!Object.keys(preset).some(k=>/organization|customer|credential|price|allowance/i.test(k)));
 }
 assert.equal(industry.getIndustryWorkspacePreset(industry.getIndustryExperience()).key,'general');
 assert.match(industry.getIndustryExperience('clinics').workspaceSetupNote,/administrative|clinical/);
});
test('module destinations follow current role, installation and configuration evidence',()=>{
 const experience=industry.getIndustryExperience();
 const modules=overview.getWorkspaceModules({experience,capabilities:caps(),planCode:'plus'});
 assert.equal(modules.find(x=>x.key==='appointments').href,'/portal/appointments');
 assert.equal(modules.find(x=>x.key==='followups').status,'setup');
 const restricted=overview.getWorkspaceModules({experience,capabilities:caps({isOwner:false,permissions:[],customers:false,conversations:false,systems:false,appointments:false,analytics:false,team:false,integrations:false,billing:false}),planCode:'business_plus'});
 assert.equal(restricted.length,0);
 for(const status of [undefined,'setup_required','paused','needs_attention']){
  const list=overview.getWorkspaceModules({experience,capabilities:caps({systemStates:status?{'appointment-system':status}:{},appointments:!!status}),planCode:'plus'});
  assert.equal(list.find(x=>x.key==='appointments').status,'setup');assert.equal(list.find(x=>x.key==='appointments').href,'/portal/systems');
 }
 const outage=overview.getWorkspaceModules({experience,capabilities:caps({systemsUnavailable:true,systemStates:{}}),planCode:'plus'});
 assert.equal(outage.find(x=>x.key==='appointments').status,'unavailable');
 const ecommerce=overview.getWorkspaceModules({experience:industry.getIndustryExperience('ecommerce'),capabilities:caps(),planCode:'plus'});
 assert.equal(ecommerce.some(x=>x.key==='appointments'),false);assert.equal(ecommerce.some(x=>/orders|vehicles|memberships/.test(x.key)),false);
});
test('plans do not fabricate activation and preview never emits actionable module URLs',()=>{
 for(const [plan,trial,status] of [['basic',false,'plan'],['plus',false,'setup'],['business',true,'plan'],[null,false,'unavailable']]){
  const modules=overview.getWorkspaceModules({experience:industry.getIndustryExperience(),capabilities:caps(),planCode:plan,trial});assert.equal(modules.find(x=>x.key==='followups').status,status);
 }
 const preview=overview.getWorkspaceModules({experience:industry.getIndustryExperience(),capabilities:caps(),planCode:'business',preview:true});
 assert.ok(preview.length);assert.ok(preview.every(x=>x.status==='preview'&&!x.href&&!x.action));
 assert.equal(overview.getWorkspaceModules({experience:industry.getIndustryExperience(),capabilities:null}).length,0);
});
test('health distinguishes actual empty setup, recorded failures, incomplete evidence and observed activity',()=>{
 const summary={agents:[],workflows:[],runs:[],onboarding:null,unavailableSources:[]};
 assert.equal(overview.getWorkspaceHealth(summary,false).state,'setup');
 assert.equal(overview.getWorkspaceHealth({...summary,unavailableSources:['runs']},false).state,'unavailable');
 assert.equal(overview.getWorkspaceHealth(summary,true).state,'unavailable');
 assert.equal(overview.getWorkspaceHealth({...summary,runs:[{status:'failed'}]},false).state,'attention');
 assert.equal(overview.getWorkspaceHealth({...summary,agents:[{status:'paused'}]},false).state,'attention');
 assert.equal(overview.getWorkspaceHealth({...summary,workflows:[{status:'testing'}],runs:[{status:'queued'}]},false).state,'observed');
});
test('existing summary reader reports independent failures, preserves available evidence and scopes every read',async()=>{
 const reads=[];
 const data=load('lib/client-portal-data.ts',{
  '@/lib/client-workspace-onboarding':{getClientOnboardingProfile:async id=>{assert.equal(id,org);return {industry:'restaurants'};}},
  '@/lib/supabase-server-rest':{supabaseServerRequest:async url=>{reads.push(url);if(url.startsWith('agents?'))throw Error('secret-provider-token');return url.startsWith('workflow_runs?')?[{id:'run',status:'succeeded'}]:[];}}
 });
 const summary=await data.getClientPortalSummary(org);
 assert.equal(JSON.stringify(summary.unavailableSources),'["agents"]');assert.equal(summary.runs.length,1);assert.equal(summary.agents.length,0);
 assert.ok(reads.every(url=>url.includes('=eq.'+org)));assert.doesNotMatch(JSON.stringify(summary),/secret-provider-token/);
});
test('existing capability reader preserves role boundaries and records unavailable system evidence',async()=>{
 const reads=[];
 const access=load('lib/portal-access.ts',{
  '@/lib/organization-membership':{getOrganizationAccessContext:async(tenant,user)=>{assert.equal(tenant,org);assert.equal(user,'manager');return {roles:['manager'],permissions:new Set(['customers.view','appointments.view','members.view'])};}},
  '@/lib/supabase-server-rest':{supabaseServerRequest:async url=>{reads.push(url);throw Error('database password');}}
 });
 const result=await access.getPortalCapabilities({organizationId:org,userId:'manager',role:'owner'});
 assert.equal(result.isOwner,false);assert.equal(result.role,'manager');assert.equal(result.customers,true);assert.equal(result.billing,false);assert.equal(result.systemsUnavailable,true);assert.equal(result.appointments,false);
 assert.ok(reads[0].includes('organization_id=eq.'+org));assert.doesNotMatch(JSON.stringify(result),/database password/);
});
