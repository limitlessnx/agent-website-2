const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const routePath=path.resolve(__dirname,'../app/api/limitless/campaigns/direct/route.ts');
const organizationId='10000000-0000-4000-8000-000000000001';
const lead={id:'lead-1',organization_id:organizationId,name:'Newton',phone:'2348012345678',status:'new',campaign_eligible:true};
function harness({windowOpen=true}={}){
 const state={approved:null,used:false,dispatches:0};
 const mocks={
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/admin-organization-scope':{resolveAdminOrganizationScope:async()=>({organizationId})},
  '@/lib/admin-auth':{getAdminSession:async()=>({email:'operator@example.test',userId:'operator-1',sessionId:'session-1'})},
  '@/lib/leo-action-approval':{
   createLeoActionApproval:async(input)=>{state.approved=JSON.stringify(input.arguments);return{approvalId:'approval-1',token:'token-1',expiresAt:new Date(Date.now()+60000).toISOString()};},
   consumeLeoActionApproval:async(input)=>{if(state.used)return{accepted:false,status:'consumed'};if(!state.approved||state.approved!==JSON.stringify(input.arguments))return{accepted:false,status:'rejected'};state.used=true;return{accepted:true,status:'accepted'};},
  },
  '@/lib/real-estate-campaign-approval':{
   campaignApprovalArguments:(value)=>value,
   campaignApprovalIdentity:(session)=>({principal:session.userId}),
   campaignApprovalSessionId:()=> 'session-1',
   REAL_ESTATE_CAMPAIGN_SEND_TOOL:'leo.limitless.campaign.send',
  },
  '@/lib/real-estate-campaign-groups':{getRealEstateCampaignGroup:async()=>null,matchesRealEstateCampaignGroupRules:()=>false},
  '@/lib/lead-profile-service':{getCampaignAudienceLeads:async()=>[lead],normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/maia-action-gateway':{dispatchMaiaCampaignAction:async()=>{state.dispatches++;return{accepted:1,failed:0,skipped:0,pendingDelivery:1,acceptedRecipients:[{leadId:lead.id,phone:lead.phone,provider:'meta_whatsapp',provider_message_id:'wamid.1'}],failedRecipients:[],executionId:'exec-1',path:['trigger','send'],summary:{pending_delivery_confirmation:1,status:'submitted'}};}},
  '@/lib/campaign-report-store':{saveCampaignDeliveryReport:async()=>{}},
  '@/lib/whatsapp-message-splitter':{splitWhatsAppMessage:(message)=>[message]},
  '@/lib/whatsapp-status-log':{getMetaCooldownPhones:async()=>new Set()},
  '@/lib/real-estate-customer-service-window':{getRealEstateDirectWindowPhones:async()=>{if(windowOpen==='missing'){const error=new Error('real_estate_customer_service_windows is missing');error.code='42P01';throw error;}return windowOpen?new Set([lead.phone]):new Set();}},
  '@/lib/supabase/admin':{createAdminClient:()=>({})},
  '@/lib/real-estate-campaign-delivery':{claimOutboundTracking:async()=>({duplicate:false,row:{metadata:{}}}),updateOutboundTracking:async()=>{}},
 };
 return{route:load(routePath,mocks),state};
}
function body(extra={}){return{requestId:'request-1',approvalStage:'prepare',topic:'Viewing follow-up',message:'Your viewing request is being followed up.',audienceMode:'all',...extra};}
function request(value){return{json:async()=>value};}

test('direct route refuses contacts without a provider-verified 24-hour inbound window',async()=>{
 const {route,state}=harness({windowOpen:false});
 const result=await route.POST(request(body()));
 assert.equal(result.status,400);
 assert.match(result.body.error,/server-verified inbound WhatsApp message/);
 assert.equal(state.dispatches,0);
 assert.equal(state.approved,null);
});

test('missing customer-window migration disables direct messaging with a clear 503',async()=>{
 const {route,state}=harness({windowOpen:'missing'});
 const result=await route.POST(request(body()));
 assert.equal(result.status,503);
 assert.match(result.body.error,/disabled until the server-verified 24-hour window migration/);
 assert.equal(state.dispatches,0);
 assert.equal(state.approved,null);
});

test('first direct-campaign action returns a server audience preview and never sends',async()=>{
 const {route,state}=harness();
 const result=await route.POST(request(body()));
 assert.equal(result.status,200);
 assert.equal(result.body.status,'confirmation_required');
 assert.equal(result.body.preview.attemptedRecipients,1);
 assert.equal(result.body.preview.serviceWindowSkipped,0);
 assert.equal(state.dispatches,0);
 assert.ok(state.approved);
});

test('exact approved direct campaign dispatches once and reports provider acceptance as pending delivery',async()=>{
 const {route,state}=harness();
 await route.POST(request(body()));
 const result=await route.POST(request(body({approvalStage:'send',approvalId:'approval-1',approvalToken:'token-1'})));
 assert.equal(result.status,200);
 assert.equal(result.body.status,'executed');
 assert.equal(result.body.accepted,1);
 assert.equal(result.body.pendingDelivery,1);
 assert.equal(result.body.deliveryStatus,'accepted');
 assert.equal(state.dispatches,1);
});

test('changed copy is rejected by exact approval and cannot dispatch',async()=>{
 const {route,state}=harness();
 await route.POST(request(body()));
 const result=await route.POST(request(body({approvalStage:'send',approvalId:'approval-1',approvalToken:'token-1',message:'Different message'})));
 assert.equal(result.status,409);
 assert.equal(state.dispatches,0);
});

test('direct route rejects unsupported media and property context before any approval or send',async()=>{
 for(const extra of [{mediaUrl:'https://cdn.example.test/image.jpg'},{propertyId:'listing-1'}]){
  const {route,state}=harness();
  const result=await route.POST(request(body(extra)));
  assert.equal(result.status,400);
  assert.equal(state.dispatches,0);
  assert.equal(state.approved,null);
 }
});
