const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=require('./helpers/load-typescript.cjs');const policy=load(path.resolve(__dirname,'../lib/hotel-communication-policy.ts'));
const customerId='00000000-0000-4000-8000-000000000001';
function fixture(options={}) {
 const state={writes:[],filters:[]};
 const admin={from(table){let values;return {select(){return this},eq(k,v){state.filters.push([table,k,v]);return this},update(v){values=v;state.writes.push(v);return this},upsert(v){values=v;state.writes.push(v);return this},single:async()=>({data:table==='crm_customers'?(options.foreign?null:{id:customerId}):values,error:options.foreign?Error('foreign'):null})}}};
 const route=load(path.resolve(__dirname,'../app/api/portal/hotel/route.ts'),{
  'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
  '@/lib/client-auth':{getClientSession:async()=>options.anonymous?null:{organizationId:'hotel-a',userId:'manager-2'}},
  '@/lib/portal-access':{requirePortalPermission:async(_session,keys)=>{if(options.revoked||options.preview||options.noReply&&keys.includes('conversations.reply'))throw Error('denied')}},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/flux-credits':{assertFluxFeatureAccess:async()=>{}},
  '@/lib/hotel-communication-policy':policy,
  '@/lib/hotel-communications':{requireHotelOrganization:async()=>{},loadHotelAudience:async()=>({guests:[],bookings:[]}),processDueHotelFollowups:async()=>({processed:0})},
 });return {route,state};
}
const body={action:'save_guest',customerId,organizationId:'hotel-b',marketingConsent:'opted_in',serviceConsent:'unknown',optedOut:false,humanHandoff:false};
test('hotel API binds writes to the session tenant and supports a second authorized manager',async()=>{
 const {route,state}=fixture();assert.equal((await route.POST({json:async()=>body})).status,200);
 assert.equal(state.writes[0].organization_id,'hotel-a');assert.equal(state.writes[0].updated_by,'manager-2');
 assert.ok(state.filters.some(([table,k,v])=>table==='crm_customers'&&k==='organization_id'&&v==='hotel-a'));
});
test('anonymous, revoked, preview and cross-tenant customer writes are rejected',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{revoked:true},403],[{preview:true},403],[{foreign:true},400]]) {
  const {route,state}=fixture(options);assert.equal((await route.POST({json:async()=>body})).status,status);assert.equal(state.writes.length,0);
 }
});
test('follow-up dispatch requires reply permission as well as customer management',async()=>{
 const {route}=fixture({noReply:true});assert.equal((await route.POST({json:async()=>({action:'dispatch_followups'})})).status,403);
});
const enquiry={action:'save_enquiry',customerId,bookingId:'00000000-0000-4000-8000-000000000002',revision:1,status:'confirmed'};
test('status-only booking updates preserve stored stay dates',async()=>{
 const {route,state}=fixture();assert.equal((await route.POST({json:async()=>enquiry})).status,200);
 assert.equal(Object.hasOwn(state.writes[0],'arrival_date'),false);
 assert.equal(Object.hasOwn(state.writes[0],'departure_date'),false);
});
test('explicit date changes and clearing retain optimistic concurrency filters',async()=>{
 const {route,state}=fixture();assert.equal((await route.POST({json:async()=>({...enquiry,arrivalDate:'2026-12-01',departureDate:null})})).status,200);
 assert.equal(state.writes[0].arrival_date,'2026-12-01');assert.equal(state.writes[0].departure_date,null);
 assert.ok(state.filters.some(([table,key,value])=>table==='hotel_booking_enquiries'&&key==='revision'&&value===1));
});
test('invalid calendar dates never mutate bookings',async()=>{
 for(const arrivalDate of ['2026-02-30','2026-13-01','2026-12-01T00:00:00Z',42]) {
  const {route,state}=fixture();assert.equal((await route.POST({json:async()=>({...enquiry,arrivalDate})})).status,400);assert.equal(state.writes.length,0);
 }
});
