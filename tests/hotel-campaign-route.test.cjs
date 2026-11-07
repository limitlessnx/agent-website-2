const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const policy=load(path.resolve(__dirname,'../lib/hotel-communication-policy.ts'));
function harness(options={}) {
  const state={sent:[],filters:[]};
  const guest={organization_id:'hotel-a',customer_id:'guest',marketing_consent:'opted_in',service_consent:'opted_in',opted_out:false,human_handoff:false,...options.guest};
  const admin={from(table){const query={select(){return this},eq(k,v){state.filters.push([table,k,v]);return this},in(){return this},single:async()=>({data:{status:'active',metadata:{industry:options.industry||'hotel'}},error:null}),maybeSingle:async()=>({data:{industry:options.profileIndustry || options.industry},error:null}),then(resolve){return Promise.resolve({data:[{id:'guest',phone:'123',full_name:'Guest'}],error:null}).then(resolve)}};return query}};
  const route=load(path.resolve(__dirname,'../app/api/portal/campaigns/send/route.ts'),{
    'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
    '@/lib/client-auth':{getClientSession:async()=>options.noSession?null:{organizationId:'hotel-a',userId:options.userId||'manager-1'}},
    '@/lib/portal-access':{requirePortalPermission:async()=>{if(options.denied)throw Error('revoked')}},
    '@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{}},
    '@/lib/supabase/admin':{createAdminClient:()=>admin},
    '@/lib/whatsapp-delivery':{sendWhatsAppMessage:async input=>state.sent.push(input)},
    '@/lib/portal-campaign-templates':{loadLinkedCampaignTemplates:async()=>{throw Error('Hotel sending must retain its existing template policy')}},
    '@/lib/hotel-communication-policy':policy,
    '@/lib/hotel-communications':{loadHotelAudience:async()=>{if(options.readError)throw Error('offline');return {guests:[guest],bookings:options.bookings||[]}},hotelConversationState:async()=>({handoff:!!options.handoff})},
  });
  return {route,state};
}
const request=(extra={})=>({json:async()=>({templateName:'hotel_offer',templatePurpose:'hotel_campaign',customerIds:['guest'],organizationId:'hotel-b',...extra})});
test('both authorized hotel managers use session tenant and approved-template gateway',async()=>{
  for(const userId of ['manager-1','manager-2']) {
    const {route,state}=harness({userId});const response=await route.POST(request());
    assert.equal(response.body.accepted,1);assert.equal(state.sent[0].organizationId,'hotel-a');
    assert.equal(state.sent[0].requireProviderApproval,true);assert.equal(state.sent[0].forceTemplate,true);
    assert.ok(state.filters.some(([table,key,value])=>table==='crm_customers'&&key==='organization_id'&&value==='hotel-a'));
  }
});
test('campaign route suppresses consent, opt-out, active-booking and handover recipients',async()=>{
  for(const options of [{guest:{marketing_consent:'unknown'}},{guest:{opted_out:true}},{handoff:true},{bookings:[{organization_id:'hotel-a',customer_id:'guest',status:'confirmed'}]}]) {
    const {route,state}=harness(options);const response=await route.POST(request());
    assert.equal(response.body.results[0].status,'skipped');assert.equal(state.sent.length,0);
  }
});
test('revoked manager and anonymous session cannot send; uncertain audience fails closed',async()=>{
  for(const [options,status] of [[{noSession:true},401],[{denied:true},403]]) {const {route,state}=harness(options);assert.equal((await route.POST(request())).status,status);assert.equal(state.sent.length,0)}
  const {route,state}=harness({readError:true});assert.equal((await route.POST(request())).body.failed,1);assert.equal(state.sent.length,0);
});
test('non-hotel tenants retain existing shared template delivery behavior',async()=>{
  const {route,state}=harness({industry:'photography'});assert.equal((await route.POST(request({templatePurpose:'campaign'}))).body.accepted,1);
  assert.equal(state.sent[0].requireProviderApproval,false);
});
test('existing campaign composer selects the hotel template purpose without a new UI contract',async()=>{
  const {route,state}=harness();const response=await route.POST(request({templatePurpose:undefined}));
  assert.equal(response.body.accepted,1);assert.equal(state.sent[0].templatePurpose,'hotel_campaign');
});
