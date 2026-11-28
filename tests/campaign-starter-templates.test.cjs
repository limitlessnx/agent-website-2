const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const source=(p,mocks={},globals={})=>load(path.resolve(__dirname,'..',p),mocks,'',globals);
const starters=source('lib/campaign-starter-templates.ts');
const first=starters.CAMPAIGN_STARTERS[0];
function provider(starter,status='APPROVED'){return {id:'meta-fixture',name:starter.name,language:starter.language,category:starter.category,status,body:starter.body,components:[{type:'BODY',text:starter.body}]};}
function harness(inventory=[],existing=[]){
 const inserts=[],posts=[],scopes=[];
 const admin={from(table){assert.equal(table,'whatsapp_template_configs');return {select(){return this},eq(k,v){scopes.push([k,v]);return this},in(){return this},then(resolve){return Promise.resolve({data:existing}).then(resolve)},insert:async row=>{inserts.push(row);return {error:null}}}}};
 const api=source('lib/campaign-starter-provisioning.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/whatsapp-credentials':{resolveTenantWhatsAppCredentials:async(_admin,org)=>{assert.equal(org,'new-tenant');return {providerFamily:'meta',graphVersion:'v23.0',wabaId:'123',accessToken:'fixture'}}},
  '@/lib/portal-campaign-templates':{loadLinkedCampaignTemplates:async org=>{assert.equal(org,'new-tenant');return {inventory}},CampaignTemplateError:Error},
  '@/lib/campaign-starter-templates':starters,
 },{AbortSignal,fetch:async(url,init)=>{posts.push({url,payload:JSON.parse(init.body)});return {ok:true,json:async()=>({id:'pending-id',status:'PENDING'})}}});
 return {api,inserts,posts,scopes};
}
test('saved definitions are industry neutral, purpose-specific and have complete example variables',()=>{
 assert.equal(starters.campaignStarters(false).length,2);
 assert.equal(starters.campaignStarters(true)[0].purpose,'hotel_campaign');
 for(const starter of starters.CAMPAIGN_STARTERS){
  assert.equal(starter.variable_keys.length,starter.examples.length);
  assert.equal(starters.starterMetaPayload(starter).components[0].text,starter.body);
 }
});
test('missing starters submit to tenant WABA but never become active before approval',async()=>{
 const h=harness();const result=await h.api.prepareCampaignStarters('new-tenant',false,true);
 assert.equal(result[0].status,'submitted_for_review');assert.equal(h.posts.length,2);assert.equal(h.inserts.length,0);
 assert.ok(h.posts.every(p=>p.url.includes('/123/message_templates')));
});
test('link approved exact starter without changing existing or paused mapping',async()=>{
 const h=harness([provider(first)]);const result=await h.api.prepareCampaignStarters('new-tenant',false,false);
 assert.equal(result[0].status,'ready');assert.equal(h.inserts[0].organization_id,'new-tenant');
 assert.deepEqual(Array.from(h.inserts[0].variable_keys),Array.from(first.variable_keys));assert.equal(h.posts.length,0);
 const paused=harness([provider(first)],[{purpose:first.purpose,template_name:first.name,language_code:'en',status:'paused',variable_keys:first.variable_keys}]);
 assert.equal((await paused.api.prepareCampaignStarters('new-tenant',false,true))[0].status,'existing_mapping_preserved');assert.equal(paused.inserts.length,0);
});
test('pending, duplicate, altered or recategorized starters cannot activate',async()=>{
 for(const items of [[provider(first,'PENDING')],[provider(first),provider(first)],[{...provider(first),body:'different'}],[{...provider(first),category:'UTILITY'}]]){
  const h=harness(items);await h.api.prepareCampaignStarters('new-tenant',false,false);assert.equal(h.inserts.length,0);assert.equal(h.posts.length,0);
 }
});
