const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const routePath=path.resolve(__dirname,'../app/api/limitless/campaigns/send/route.ts');
const ORG='10000000-0000-4000-8000-000000000001';
const OTHER='20000000-0000-4000-8000-000000000002';
const leads=[{id:'lead-1',organization_id:ORG,name:'Newton',phone:'2348012345678',status:'new',campaign_eligible:true},{id:'lead-2',organization_id:OTHER,name:'Outside',phone:'2348012345679',status:'new',campaign_eligible:true}];
const properties=[{id:'property-1',organization_id:ORG,title:'Verified duplex',location_city:'Abuja',price:'N50m',status:'active'},{id:'property-2',organization_id:OTHER,title:'Other tenant',status:'active'}];
function harness(){
 const state={approvals:new Map(),used:new Set(),dispatches:0,propertyQueryOrg:null,tracking:new Map(),report:null,leadRows:leads};
 let sequence=0;
 const mocks={
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/admin-organization-scope':{resolveAdminOrganizationScope:async()=>({organizationId:ORG})},
  '@/lib/admin-auth':{getAdminSession:async()=>({email:'operator@example.test',userId:'operator-1',issuedAt:1792848000000})},
  '@/lib/leo-action-approval':{
   createLeoActionApproval:async(input)=>{const approvalId=`approval-${++sequence}`;const token=`token-${sequence}`;state.approvals.set(approvalId,{args:JSON.stringify(input.arguments),token});return{approvalId,token,expiresAt:new Date(Date.now()+60000).toISOString()};},
   consumeLeoActionApproval:async(input)=>{const record=state.approvals.get(input.approvalId);if(!record||record.token!==input.token||record.args!==JSON.stringify(input.arguments)||state.used.has(input.approvalId))return{accepted:false,status:'rejected'};state.used.add(input.approvalId);return{accepted:true,status:'accepted'};},
  },
  '@/lib/real-estate-campaign-approval':{campaignApprovalArguments:(value)=>value,campaignApprovalIdentity:(session)=>({principal:session.userId}),campaignApprovalSessionId:()=> 'session-1',REAL_ESTATE_CAMPAIGN_SEND_TOOL:'leo.limitless.campaign.send'},
  '@/lib/real-estate-campaign-groups':{getRealEstateCampaignGroup:async()=>null,matchesRealEstateCampaignGroupRules:()=>false},
  '@/lib/limitless-data':{getProperties:async(_limit,org)=>{state.propertyQueryOrg=org;return properties;}},
  '@/lib/lead-profile-service':{getCampaignAudienceLeads:async()=>state.leadRows,normalizeLeadPhone:(value)=>String(value||'').replace(/\D/g,'')},
  '@/lib/maia-action-gateway':{dispatchMaiaCampaignAction:async(command)=>{state.dispatches++;return{accepted:1,failed:0,skipped:0,pendingDelivery:1,acceptedRecipients:[{leadId:'lead-1',phone:'2348012345678',name:'Newton',provider:'meta_whatsapp',provider_message_id:'wamid.1'}],failedRecipients:[],executionId:'exec-1',path:['trigger','campaign'],summary:{attempted:1,accepted_by_whatsapp_api:1,pending_delivery_confirmation:1,status:'submitted'}};}},
  '@/lib/campaign-report-store':{saveCampaignDeliveryReport:async(report)=>{state.report=report;}},
  '@/lib/whatsapp-message-splitter':{splitWhatsAppMessage:(message)=>[message]},
  '@/lib/property-campaign-message':{buildPropertyCampaignContent:(property,original)=>({message:`${original}\n\nProperty: ${property.title}\nLocation: ${property.location_city}\n\nReply MORE INFO for human verification.`,propertyName:property.title,memory:{propertyId:property.id},replyInstruction:'human verification'}),PropertyCampaignMessageError:class extends Error{}},
  '@/lib/whatsapp-status-log':{getMetaCooldownPhones:async()=>new Set()},
  '@/lib/supabase/admin':{createAdminClient:()=>({})},
  '@/lib/real-estate-campaign-delivery':{
   claimOutboundTracking:async(_admin,input)=>{const key=input.idempotencyKey;const existing=state.tracking.get(key);if(existing)return{duplicate:true,row:existing};const row={...input,metadata:input.metadata||{}};state.tracking.set(key,row);return{duplicate:false,row};},
   updateOutboundTracking:async(_admin,_org,key,values)=>{const row=state.tracking.get(key);if(row){Object.assign(row,values);if(values.metadata)row.metadata={...row.metadata,...values.metadata};}return row||null;},
  },
 };
 return{route:load(routePath,mocks),state};
}
function base(extra={}){return{requestId:'campaign-1',approvalStage:'prepare',campaignType:'limitless_realty_update',topic:'Abuja market update',message:'Main market update\n\nSupporting details\n\nReply MORE INFO.',audienceMode:'all',propertyId:'property-1',...extra};}
function request(value){return{json:async()=>value};}

test('standard campaign preview is tenant-scoped and returns the exact composed message with masked recipients',async()=>{
 const {route,state}=harness();
 const result=await route.POST(request(base()));
 assert.equal(result.status,200);
 assert.equal(result.body.status,'confirmation_required');
 assert.equal(state.propertyQueryOrg,ORG);
 assert.equal(result.body.preview.attemptedRecipients,1);
 assert.equal(result.body.preview.propertyName,'Verified duplex');
 assert.match(result.body.preview.message,/Property: Verified duplex/);
 assert.deepEqual(JSON.parse(JSON.stringify(result.body.preview.recipientPreview)),[{name:'Newton',phone:'••••5678'}]);
 assert.equal(state.dispatches,0);
});

test('standard campaign sends only after exact one-time confirmation and reports accepted-not-delivered state',async()=>{
 const {route,state}=harness();
 const prepared=await route.POST(request(base()));
 const sent=await route.POST(request(base({approvalStage:'send',approvalId:prepared.body.approval.approvalId,approvalToken:prepared.body.approval.token})));
 assert.equal(sent.status,200);
 assert.equal(sent.body.approvalStatus,'consumed');
 assert.equal(sent.body.accepted,1);
 assert.equal(sent.body.pendingDelivery,1);
 assert.equal(sent.body.deliveryStatus,'accepted');
 assert.equal(state.dispatches,1);
});

test('replay with a new approval and same request ID is stopped by the durable outbox claim',async()=>{
 const {route,state}=harness();
 let prepared=await route.POST(request(base()));
 await route.POST(request(base({approvalStage:'send',approvalId:prepared.body.approval.approvalId,approvalToken:prepared.body.approval.token})));
 prepared=await route.POST(request(base()));
 const replay=await route.POST(request(base({approvalStage:'send',approvalId:prepared.body.approval.approvalId,approvalToken:prepared.body.approval.token})));
 assert.equal(replay.body.duplicatePrevented,true);
 assert.equal(state.dispatches,1);
});

test('cross-tenant property and non-verified templates or media fail before approval',async()=>{
 for(const [extra,expectedStatus] of [[{propertyId:'property-2'},404],[{campaignType:'new_estate_update'},400],[{mediaUrl:'https://cdn.example.test/image.jpg'},400]]){
  const {route,state}=harness();
  const result=await route.POST(request(base(extra)));
  assert.equal(result.status,expectedStatus);
  assert.equal(state.dispatches,0);
  assert.equal(state.approvals.size,0);
 }
});

test('a mis-scoped CRM row cannot enter the server audience even if the reader returned it',async()=>{
 const {route,state}=harness();
 state.leadRows=[...leads,{id:'foreign-lead',organization_id:OTHER,name:'Foreign',phone:'2348012345699',status:'new',campaign_eligible:true}];
 const result=await route.POST(request(base({propertyId:''})));
 assert.equal(result.body.preview.attemptedRecipients,1);
 assert.equal(result.body.preview.recipientPreview.some((row)=>row.name==='Foreign'),false);
});
