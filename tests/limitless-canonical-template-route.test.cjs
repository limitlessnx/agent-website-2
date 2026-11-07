const test=require('node:test');const assert=require('node:assert/strict');const load=require('./helpers/load-typescript.cjs');
const contract=load('lib/limitless-followup-contract.ts');const org=contract.LIMITLESS_REALTY_ORGANIZATION_ID;
function harness(options={}){
 const state={sent:[],writes:[]};const consent={consent_state:'opted_in',consent_at:'2026-11-01T10:00:00Z',consent_source:'fixture',consent_actor:'fixture'};
 const row={id:'step',organization_id:org,lead_id:'lead',customer_id:'customer',property_id:'property',sequence_id:'sequence',sequence_key:contract.LIMITLESS_FOLLOWUP_SEQUENCE_KEY,sequence_step_key:'day-1',stage:1,status:'pending',...consent,scheduled_at:'2026-11-01T10:00:00Z',leads:{phone:'2348000000001',name:'Test customer',opted_out:!!options.optedOut},message_sent:'Verified follow-up text'};
 const admin={from(table){let updated=false;return{select(){return this},eq(){return this},in(){return this},is(){return this},not(){return this},lte(){return this},order(){return this},limit(){return this},update(value){updated=true;state.writes.push({table,...value});return this},maybeSingle:async()=>({data:table==='organizations'?{id:org}:table==='properties'?{id:'property',title:'Verified estate',location_city:'Benin',location_area:'Test area'}:table==='limitless_maia_followup_sequences'?{id:'sequence',lead_id:'lead',property_id:'property',status:'active',...consent}:{id:'step',status:'sent',sent_at:'2026-11-07T00:00:00Z'}}),then(resolve){return Promise.resolve({data:updated?[]:[row]}).then(resolve)}}},rpc:async name=>({data:name==='claim_limitless_maia_followup_step'?{claimed:true,attempt_count:1}:{authorized:true}})};
 const route=load('app/api/limitless/maia/followups/route.ts',{
  'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async input=>{state.sent.push(input);return{providerMessageId:'fixture-receipt',provider:'meta',messageType:input.deliveryMode}}},
  '@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{}},
  '@/lib/real-estate-campaign-delivery':{claimOutboundTracking:async()=>({duplicate:!!options.duplicate,row:{lifecycle_status:'unknown',provider_message_id:null}}),updateOutboundTracking:async()=>{}},
  '@/lib/limitless-followup-contract':contract,
  '@/lib/follow-up-policy':{computeSequenceStepDueAt:()=>null,resolveFollowUpPolicy:async()=>({})},
  '@/lib/real-estate-customer-service-window':{getRealEstateDirectWindowLastInboundAt:async()=>options.openWindow?'2026-11-07T00:00:00Z':null},
 },'',{process:{env:{CRON_SECRET:'fixture-cron'}}});
 return{route,state,request:{headers:{get:name=>name==='authorization'?'Bearer fixture-cron':null}}};
}
test('the canonical runner supplies exactly the currently approved four-variable reminder contract outside the service window',async()=>{
 const h=harness();const result=await h.route.GET(h.request);assert.equal(result.body.status_counts.sent,1);assert.equal(h.state.sent.length,1);
 const sent=h.state.sent[0];assert.equal(sent.organizationId,org);assert.equal(sent.deliveryMode,'template');assert.equal(sent.templatePurpose,'follow_up_outside_24h');
 assert.deepEqual(Array.from(sent.strictTemplateContract.approvedVariableOrder),['customer_name','followup_context','property_details','next_step']);assert.deepEqual(Object.keys(sent.variables),['customer_name','followup_context','property_details','next_step']);
 assert.match(sent.variables.property_details,/Verified estate.*Test area, Benin/);assert.equal(sent.variables.customer_name,'Test customer');
});
test('verified open service windows keep direct delivery and opt-outs still block the corrected template path',async()=>{
 const direct=harness({openWindow:true});await direct.route.GET(direct.request);assert.equal(direct.state.sent[0].deliveryMode,'direct');assert.equal(direct.state.sent[0].strictTemplateContract,undefined);
 const optedOut=harness({optedOut:true});await optedOut.route.GET(optedOut.request);assert.equal(optedOut.state.sent.length,0);
});
test('a previous unknown outbound attempt is held for review and cannot be resent by the corrected contract',async()=>{
 const h=harness({duplicate:true});const result=await h.route.GET(h.request);assert.equal(result.body.status_counts.unknown,1);assert.equal(h.state.sent.length,0);
});
