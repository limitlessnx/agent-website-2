const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');

const ORG='10000000-0000-4000-8000-000000000001';
const HANDOFF='20000000-0000-4000-8000-000000000001';
const NOTIFICATION='30000000-0000-4000-8000-000000000001';
const USER='40000000-0000-4000-8000-000000000001';
const MEMBER='50000000-0000-4000-8000-000000000001';
const session={organizationId:ORG,userId:USER,membershipId:MEMBER};

function harness({sendError=null,mutateSummary=false,fallbackAttempted=false,notificationErrorCode='400'}={}){
 const state={handoff:{id:HANDOFF,status:'assigned',customer_id:'customer-1',conversation_summary:'Please call me about the inspection.',reason:'Inspection help',next_action:'Confirm the requested inspection',stage_id_at_handoff:'stage-1'},notification:{id:NOTIFICATION,status:'failed',channel:'whatsapp',recipient:'2348000000000',membership_id:MEMBER,error_code:notificationErrorCode,retry_count:0,metadata:{destination_source:'membership',fallback_template_attempted:fallbackAttempted}},approvals:[],updates:[],rpcCalls:[],sends:[],sendError,mutateSummary};
 function resultFor(table,query){
  if(query.operation==='delete')return{data:null,error:null};
  if(query.operation==='insert'){if(table==='handoff_notification_retry_approvals')state.approvals.push(query.body);return{data:query.body,error:null};}
  if(query.operation==='update'){state.updates.push({table,body:query.body,filters:{...query.filters}});return{data:query.returning?{id:NOTIFICATION,status:query.body.status}:null,error:null};}
  if(table==='human_handoffs')return{data:state.handoff,error:null};
  if(table==='handoff_notifications')return{data:state.notification,error:null};
  if(table==='organization_memberships')return{data:{id:MEMBER,status:'active'},error:null};
  if(table==='organization_member_notification_preferences')return{data:{whatsapp_phone:'2348000000000',notify_whatsapp_handoffs:true,metadata:{supervisor:true}},error:null};
  if(table==='crm_customers')return{data:{full_name:'Newton',phone:'2348012345678',current_stage_id:'stage-1'},error:null};
  if(table==='organization_customer_stages')return{data:{name:'Qualified'},error:null};
  return{data:null,error:new Error('Unexpected table '+table)};
 }
 const admin={
  from(table){const query={table,filters:{},operation:'select',body:null,returning:false};const builder={
   select(){query.returning=true;return builder;},eq(key,value){query.filters[key]=value;return builder;},lt(key,value){query.filters[key]=value;return builder;},
   delete(){query.operation='delete';return builder;},insert(body){query.operation='insert';query.body=body;return builder;},update(body){query.operation='update';query.body=body;return builder;},
   maybeSingle(){return Promise.resolve(resultFor(table,query));},single(){return Promise.resolve(resultFor(table,query));},
   then(resolve,reject){return Promise.resolve(resultFor(table,query)).then(resolve,reject)},
  };return builder;},
  async rpc(name,args){state.rpcCalls.push({name,args});if(name!=='claim_real_estate_handoff_notification_retry')return{data:null,error:new Error('Unexpected RPC')};if(state.sendError?.changeApproval)return{data:null,error:new Error('Retry approval expired, changed, or already used')};return{data:{claimed:true,notificationId:NOTIFICATION,retryCount:1},error:null};},
 };
 const api=load(path.resolve(__dirname,'../lib/handoff-notification-retry.ts'),{
  'node:crypto':require('node:crypto'),
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/organization-membership':{getOrganizationAccessContext:async()=>({membershipId:MEMBER,permissions:new Set(['handoffs.manage'])}),assertAnyOrganizationPermission:(access,permissions)=>{if(!permissions.some((p)=>access.permissions.has(p)))throw new Error('permission denied');}},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async(input)=>{state.sends.push(input);if(state.sendError)throw state.sendError;return{providerMessageId:'provider-accepted-1'};}},
  '@/lib/real-estate-organization':{resolveActiveRealEstateOrganization:async(_client,id)=>({id,slug:'limitless-realty',status:'active',metadata:{}})},
 });
 return{api,state};
}

test('prepare returns the exact staff-only preview and stores only message/recipient digests',async()=>{
 const {api,state}=harness();
 const prepared=await api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION);
 assert.equal(prepared.recipientPreview,'••••0000');
 assert.match(prepared.message,/New customer handoff: Newton/);
 assert.match(prepared.message,/Customer WhatsApp: 2348012345678/);
 assert.equal(state.approvals.length,1);
 assert.equal(typeof state.approvals[0].message_digest,'string');assert.match(state.approvals[0].message_digest,/^[0-9a-f]{64}$/);
 assert.match(state.approvals[0].recipient_digest,/^[0-9a-f]{64}$/);
 assert.equal('message' in state.approvals[0],false);assert.equal('recipient' in state.approvals[0],false);
 assert.equal(state.sends.length,0);
});

test('confirm consumes the exact preview before one internal-staff send',async()=>{
 const {api,state}=harness();
 const prepared=await api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION);
 const result=await api.confirmFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION,prepared.approvalId);
 assert.equal(result.status,'sent');assert.equal(state.rpcCalls.length,1);
 assert.equal(state.rpcCalls[0].name,'claim_real_estate_handoff_notification_retry');
 assert.equal(state.rpcCalls[0].args.p_message_digest,state.approvals[0].message_digest);
 assert.equal(state.rpcCalls[0].args.p_recipient_digest,state.approvals[0].recipient_digest);
 assert.equal(state.sends.length,1);assert.equal(state.sends[0].recipientType,'internal_staff');
 assert.equal(state.sends[0].to,'2348000000000');assert.equal(state.sends[0].text,prepared.message);
 assert.equal(state.updates.at(-1).body.status,'sent');
});

test('uncertain provider outcome is recorded unknown and is never presented as retryable',async()=>{
 const error=new Error('socket timeout');
 const {api,state}=harness({sendError:error});
 const prepared=await api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION);
 const result=await api.confirmFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION,prepared.approvalId);
 assert.equal(result.status,'unknown');assert.equal(result.errorCode,null);
 assert.equal(state.updates.at(-1).body.status,'unknown');
 assert.match(result.errorMessage,/Verify delivery manually/);
});

test('definitive provider rejection is safe-to-retry but remains capped by the transactional claim',async()=>{
 const error=Object.assign(new Error('do not persist raw provider details'),{status:400,code:131047});
 const {api,state}=harness({sendError:error});
 const prepared=await api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION);
 const result=await api.confirmFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION,prepared.approvalId);
 assert.equal(result.status,'failed');assert.equal(result.errorCode,'131047');
 assert.doesNotMatch(result.errorMessage,/raw provider details/);
 assert.equal(state.updates.at(-1).body.status,'failed');
});

test('changed exact message invalidates the preview before dispatch',async()=>{
 const {api,state}=harness();
 const prepared=await api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION);
 state.handoff.conversation_summary='Changed after preview';
 state.sendError={changeApproval:true};
 await assert.rejects(api.confirmFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION,prepared.approvalId),/expired, changed, or already used/);
 assert.equal(state.sends.length,0);
});

test('previous service-window template fallback prevents a free-form staff retry',async()=>{
 const {api,state}=harness({fallbackAttempted:true,notificationErrorCode:'400'});
 await assert.rejects(api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION),/template fallback was already attempted/);
 assert.equal(state.sends.length,0);assert.equal(state.approvals.length,0);
});

test('the closed 24-hour free-form window can never be retried as text',async()=>{
 const {api,state}=harness({notificationErrorCode:'131047'});
 await assert.rejects(api.prepareFailedHumanHandoffNotificationRetry(session,HANDOFF,NOTIFICATION),/Do not retry a text/);
 assert.equal(state.sends.length,0);assert.equal(state.approvals.length,0);
});
