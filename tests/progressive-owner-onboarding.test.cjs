/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-typescript.cjs');
const industry=load('lib/industryExperience.ts');
const org='10000000-0000-4000-8000-000000000001',user='owner';
const next={NextResponse:{json:(body,{status=200}={})=>({body,status})}};
function harness(role='owner',preview=false){
 const state={id:'profile',organization_id:org,user_id:user,status:'in_progress',current_step:1,industry:'hotels',business_name:'Hotel',business_description:'Original',business_knowledge:{faqs:'Keep',pricing:'Old'},whatsapp_preferences:{connection_path:'already_have_whatsapp_business',preferred_number:'keep-number'},business_goals:['answer_questions'],channels:['WhatsApp'],existing_tools:['CRM'],updated_at:'2026-11-25T00:00:00Z'};
 const writes=[];
 const lib=load('lib/client-workspace-onboarding.ts',{'@/lib/supabase-server-rest':{supabaseServerRequest:async(path,init)=>{
   if(path.startsWith('organizations?'))return[{id:org,metadata:{industry_slug:'hotels'}}];
   assert.ok(path.includes('organization_id=eq.'+org));
   if(init?.method==='PATCH'){assert.ok(path.includes('user_id=eq.'+user));const payload=JSON.parse(init.body);writes.push(payload);Object.assign(state,payload);return[structuredClone(state)];}
   return[structuredClone(state)];
 }}});
 const route=load('app/api/client-onboarding/route.ts',{'next/server':next,'@/lib/industryExperience':industry,'@/lib/client-auth':{getClientSession:async()=>role?{role,isAdminPreview:preview,userId:user,organizationId:org,membershipId:'member',organizationSlug:'hotel',email:'owner@example.test'}:null},'@/lib/client-workspace-onboarding':lib});
 return{state,writes,route,lib};
}
const request=body=>({json:async()=>body});
test('partial profile and nested updates preserve unrelated fields and authoritative industry',async()=>{const h=harness();const r=await h.route.PATCH(request({business_knowledge:{pricing:'New'},whatsapp_preferences:{preferred_number:'new-number'},industry:'real-estate',current_step:3}));assert.equal(r.status,200);assert.equal(h.state.business_knowledge.faqs,'Keep');assert.equal(h.state.business_knowledge.pricing,'New');assert.equal(h.state.whatsapp_preferences.connection_path,'already_have_whatsapp_business');assert.equal(h.state.whatsapp_preferences.preferred_number,'new-number');assert.equal(h.state.industry,'hotels');assert.equal(h.state.business_description,'Original');assert.equal(h.state.current_step,3);});
test('skipping changes only progress and permits resuming saved data',async()=>{const h=harness();assert.equal((await h.route.PATCH(request({current_step:4}))).status,200);assert.equal(h.state.current_step,4);assert.equal(h.state.business_knowledge.faqs,'Keep');assert.equal(h.state.whatsapp_preferences.preferred_number,'keep-number');const resumed=await h.route.GET();assert.equal(resumed.body.profile.current_step,4);assert.equal(resumed.body.profile.business_description,'Original');});
test('manager, preview and unauthenticated sessions cannot mutate setup',async()=>{for(const [role,preview,code] of [['manager',false,403],['owner',true,403],[null,false,401]]){const h=harness(role,preview);assert.equal((await h.route.PATCH(request({business_name:'Other'}))).status,code);assert.equal((await h.route.POST(request({action:'complete'}))).status,code);assert.equal(h.writes.length,0);}});
test('authoritative metadata allocates the hotel even if profile recovery is pending',async()=>{const h=harness();assert.equal(await h.lib.getClientWorkspaceIndustry(org,null),'hotels');assert.equal(await h.lib.getClientWorkspaceIndustry(org,{industry:'other'}),'hotels');});
test('skipping optional fields cannot bypass submission requirements',async()=>{const h=harness();h.state.business_description='';assert.equal((await h.route.PATCH(request({current_step:5}))).status,200);assert.equal((await h.route.POST(request({action:'complete'}))).status,400);assert.equal(h.state.status,'in_progress');});
