const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');const policy=load(path.resolve(__dirname,'../lib/hotel-communication-policy.ts'));
function harness(options={}) {
 const now=Date.now();const state={sent:[],queries:[],tables:{
  organizations:[{id:'hotel-a',status:'active',metadata:{industry:'hotel'}}],
  crm_customers:[{organization_id:'hotel-a',id:'guest',phone:'123',full_name:'Guest'}],
  hotel_guest_profiles:[{organization_id:'hotel-a',customer_id:'guest',marketing_consent:'opted_in',service_consent:'opted_in',opted_out:false,human_handoff:false,...options.guest}],
  hotel_booking_enquiries:[{id:'booking',organization_id:'hotel-a',customer_id:'guest',status:'enquiry',revision:options.revision||1}],
  hotel_followups:[{id:'job',organization_id:'hotel-a',customer_id:'guest',booking_id:'booking',booking_revision:1,purpose:'booking_recovery',status:'pending',scheduled_at:new Date(now-1000).toISOString(),created_at:new Date(now-3600000).toISOString(),message:'Hello'}],
  agent_conversations:options.handoff?[{organization_id:'hotel-a',external_thread_key:'123',ai_paused:true}]:[],
  crm_conversations:[{id:'conversation',organization_id:'hotel-a',customer_id:'guest',channel:'whatsapp',status:'active'}],
  crm_messages:options.inbound?[{organization_id:'hotel-a',conversation_id:'conversation',direction:'inbound',created_at:options.inbound}]:[],
 }};
 const admin={from(table){let filters=[],values=null;const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);state.queries.push([table,k,v]);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},lte(k,v){filters.push(row=>row[k]<=v);return q},order(){return q},limit(){return q},update(v){values=v;return q},single(){return run(true)},maybeSingle(){return run(true)},then(resolve,reject){return run(false).then(resolve,reject)}};async function run(single){const rows=state.tables[table].filter(row=>filters.every(filter=>filter(row)));if(values)rows.forEach(row=>Object.assign(row,values));return {data:single?rows[0]||null:rows,error:null}}return q}};
 const api=load(path.resolve(__dirname,'../lib/hotel-communications.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/hotel-communication-policy':policy,
  '@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{}},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async input=>{state.sent.push(input);if(options.providerError)throw Error('timeout');return {providerMessageId:'wamid.hotel'}}},
 });return {api,state};
}
test('concurrent hotel drains submit each claimed reminder once and retain provider tracking',async()=>{
 const {api,state}=harness();await Promise.all([api.processDueHotelFollowups('hotel-a'),api.processDueHotelFollowups('hotel-a')]);
 assert.equal(state.sent.length,1);assert.equal(state.sent[0].deliveryMode,'template');assert.equal(state.sent[0].requireProviderApproval,true);
 assert.equal(state.tables.hotel_followups[0].provider_message_id,'wamid.hotel');
 await api.processDueHotelFollowups('hotel-a');assert.equal(state.sent.length,1);
});
test('state changes, opt-outs, human handover and new replies suppress dispatch',async()=>{
 for(const options of [{revision:2},{guest:{opted_out:true}},{handoff:true},{inbound:new Date(Date.now()-1000).toISOString()}]) {
  const {api,state}=harness(options);await api.processDueHotelFollowups('hotel-a');assert.equal(state.sent.length,0);assert.equal(state.tables.hotel_followups[0].status,'cancelled');
 }
});
test('only canonical inbound within the window permits direct follow-up',async()=>{
 const {api,state}=harness({inbound:new Date(Date.now()-7200000).toISOString()});await api.processDueHotelFollowups('hotel-a');
 assert.equal(state.sent.length,1);assert.equal(state.sent[0].deliveryMode,'direct');
 assert.equal(state.sent[0].organizationId,'hotel-a');
});
test('uncertain provider outcome cannot be retried automatically',async()=>{
 const {api,state}=harness({providerError:true});await api.processDueHotelFollowups('hotel-a');await api.processDueHotelFollowups('hotel-a');
 assert.equal(state.sent.length,1);assert.equal(state.tables.hotel_followups[0].status,'unknown');
});
