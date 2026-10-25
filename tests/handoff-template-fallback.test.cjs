const test=require('node:test');
const assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');

function makeHarness({directError,templateError=null,callbackApplied=true}={}){
 const state={notifications:[],updates:[],sends:[],calls:[],rpcCalls:[]};
 const baseNotification={id:'notification-1',organization_id:'org-1',handoff_id:'handoff-1',status:'pending',provider_message_id:null,error_code:null,error_message:null,recipient:'2348000000000',metadata:{}};
 const matches=(row,filters)=>filters.every(([key,value])=>String(row[key]??'')===String(value));
 const admin={
  rpc:async(name,args)=>{state.rpcCalls.push([name,args]);const notification=state.notifications[0]||baseNotification;return{data:{notificationId:notification.id,organizationId:'org-1',handoffId:'handoff-1',recipient:notification.recipient,status:notification.status,metadata:notification.metadata,applied:callbackApplied},error:null};},
  from(table){
   let operation='select';let payload=null;let filters=[];
   const query={
    select(){return this;},
    insert(row){operation='insert';payload=row;return this;},
    update(row){operation='update';payload=row;return this;},
    eq(key,value){filters.push([key,value]);return this;},
    async single(){const result=await this._execute();return{data:result.data,error:result.error};},
    async maybeSingle(){const result=await this._execute();return{data:result.data,error:result.error};},
    async _execute(){
     state.calls.push({table,operation,payload,filters:[...filters]});
     if(operation==='insert'){
      const row={...payload,id:'notification-1'};state.notifications.push(row);return{data:row,error:null};
     }
     if(table==='organizations'&&operation==='select')return{data:{name:'Limitless Realty'},error:null};
     if(table==='human_handoffs'&&operation==='select')return{data:{reason:'Inspection help',conversation_summary:'Please verify the property and arrange a visit.'},error:null};
     const row=state.notifications.find(item=>matches(item,filters));
     if(!row)return{data:null,error:null};
     if(operation==='update'){Object.assign(row,payload);state.updates.push({...payload});}
     return{data:row,error:null};
    },
    then(resolve,reject){return this._execute().then(resolve,reject);},
   };
   return query;
  },
 };
 const sent=[];
 const sendWhatsAppMessage=async(args)=>{
  state.sends.push(args);
  if(args.deliveryMode==='direct'&&directError)throw directError;
  if(args.deliveryMode==='template'&&templateError)throw templateError;
  return{providerMessageId:args.deliveryMode==='template'?'wamid-template':'wamid-direct'};
 };
 const api=load('lib/human-operations.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/organization-membership':{getOrganizationAccessContext:async()=>({}),assertAnyOrganizationPermission:async()=>{},listOrganizationMembers:async()=>[]},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage},
  '@/lib/ai/limitless-handoff-policy.mjs':{LIMITLESS_REALTY_ORGANIZATION_ID:'org-1',createLimitlessHumanHandoff:async()=>({})},
 },'\nmodule.exports.__notifyHandoffAssignee=notifyHandoffAssignee;');
 return{api,state};
}

const input={organizationId:'org-1',handoffId:'handoff-1',conversationId:'conversation-1',membershipId:null,destinationPhone:'2348000000000',sourceAgentId:'agent-1',customerName:'Newton',customerPhone:'2348111111111',stageName:'Inspection requested',summary:'Please verify the property and arrange a visit.',nextAction:'Call the customer',notifyWhatsApp:true,notifyDashboard:false};
const providerError=(status,code)=>Object.assign(new Error('provider rejection'),{status,code});

test('synchronous 131047 rejection marks the approved template fallback before sending it',async()=>{
 const {api,state}=makeHarness({directError:providerError(400,'131047')});
 await api.__notifyHandoffAssignee(input);
 assert.equal(state.sends.length,2);assert.equal(state.sends[0].deliveryMode,'direct');
 const template=state.sends[1];assert.equal(template.deliveryMode,'template');assert.equal(template.recipientType,'internal_staff');
 assert.equal(template.templatePurpose,'human_handoff_staff');assert.equal(template.to,'2348000000000');
 const fallbackAttempt=state.updates.find(row=>row.metadata?.fallback_template_attempted===true);
 assert.ok(fallbackAttempt);assert.equal(fallbackAttempt.error_code,'131047');
 assert.equal(state.notifications.at(-1).status,'sent');assert.equal(state.notifications.at(-1).provider_message_id,'wamid-template');
 assert.equal(state.notifications.at(-1).error_code,null);
});

test('a signed 131047 receipt uses the same compliant staff template fallback',async()=>{
 const {api,state}=makeHarness({callbackApplied:true});
 state.notifications.push({id:'notification-1',organization_id:'org-1',handoff_id:'handoff-1',status:'failed',provider_message_id:'wamid-original',error_code:'131047',error_message:'service window closed',recipient:'2348000000000',metadata:{customer_name:'Newton',customer_phone:'2348111111111',conversation_summary:'Please verify the property.'}});
 await api.syncHandoffNotificationStatus({organizationId:'org-1',providerMessageId:'wamid-original',status:'failed',errorCode:'131047',errorMessage:'service window closed'});
 assert.equal(state.rpcCalls[0][0],'apply_handoff_notification_receipt');
 assert.equal(state.rpcCalls[0][1].p_organization_id,'org-1');
 assert.equal(state.sends.length,1);assert.equal(state.sends[0].deliveryMode,'template');
 assert.equal(state.notifications.at(-1).status,'sent');
});

test('template rejection is recorded as failed and permanently blocks free-form retry',async()=>{
 const {api,state}=makeHarness({directError:providerError(400,'131047'),templateError:providerError(400,'132000')});
 await api.__notifyHandoffAssignee(input);
 assert.equal(state.sends.length,2);assert.equal(state.notifications.at(-1).status,'failed');
 assert.equal(state.notifications.at(-1).metadata.fallback_template_attempted,true);
 assert.equal(state.notifications.at(-1).metadata.fallback_template_failed,true);
 assert.equal(state.notifications.at(-1).metadata.fallback_template_error_code,'132000');
});

test('ambiguous direct-send outcomes never trigger an automatic template or retry',async()=>{
 const {api,state}=makeHarness({directError:providerError(503,'provider-timeout')});
 await api.__notifyHandoffAssignee(input);
 assert.equal(state.sends.length,1);assert.equal(state.notifications.at(-1).status,'unknown');
 assert.match(state.notifications.at(-1).error_message,/acceptance is uncertain/);
});
