import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import load from './helpers/load-typescript.cjs';
const dirname=path.dirname(fileURLToPath(import.meta.url));
const contract=load(path.resolve(dirname,'../lib/hotel-booking-contract.ts'));
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const guest='20000000-0000-4000-8000-000000000001',foreignGuest='20000000-0000-4000-8000-000000000002';
const booking='30000000-0000-4000-8000-000000000001',foreignBooking='30000000-0000-4000-8000-000000000002';
const room='40000000-0000-4000-8000-000000000001',type='50000000-0000-4000-8000-000000000001',requestId='60000000-0000-4000-8000-000000000001';
function harness(options={}){
 const state={queries:[],writes:[],canonical:[],rpc:[],tables:{
  crm_customers:[{id:guest,organization_id:org,full_name:'Ada',phone:'123',email:null},{id:foreignGuest,organization_id:other,full_name:'Outside'}],
  hotel_guest_profiles:[{customer_id:guest,organization_id:org,marketing_consent:'opted_out',service_consent:'unknown',opted_out:true,human_handoff:true}],
  hotel_room_types:[{id:type,organization_id:org,currency:'NGN',nightly_rate_minor:10000,capacity:2,name:'Double'}],
  hotel_rooms:[{id:room,organization_id:org,room_type_id:type,name:'101',active:true}],
  hotel_booking_enquiries:[{id:booking,organization_id:org,customer_id:guest,room_id:room,status:'confirmed',revision:2,currency:'NGN',nightly_rate_minor:10000,arrival_date:'2026-12-01',departure_date:'2026-12-03'},{id:foreignBooking,organization_id:other,customer_id:foreignGuest,revision:1,currency:'USD'}],
  hotel_offline_payments:[],hotel_booking_events:[],hotel_booking_references:[{organization_id:org,booking_id:booking,number:42},{organization_id:other,booking_id:foreignBooking,number:42}],
 }};
 const admin={from(table){let filters=[],values=null,operation=null,upsertOptions={},limit=Infinity;const q={
  select(){return q},eq(k,v){filters.push(row=>row[k]===v);state.queries.push([table,k,v]);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},limit(n){limit=n;return q},
  insert(v){values=v;operation='insert';return q},update(v){values=v;operation='update';return q},upsert(v,o){values=v;operation='upsert';upsertOptions=o;return q},single(){return run(true)},maybeSingle(){return run(true)},then(resolve,reject){return run(false).then(resolve,reject)},
 };async function run(single){const rows=state.tables[table];let matches=rows.filter(row=>filters.every(f=>f(row)));if(operation==='insert'||operation==='upsert'){
   const conflict=rows.find(row=>row.organization_id===values.organization_id&&((values.request_id&&row.request_id===values.request_id)||(values.source_request_id&&row.source_request_id===values.source_request_id)||(operation==='upsert'&&row.customer_id===values.customer_id)));
   if(conflict&&operation==='insert')return{data:null,error:{code:'23505'}};
   if(conflict&&upsertOptions.ignoreDuplicates)matches=[];
   else {const row={id:randomUUID(),status:table==='hotel_offline_payments'?'pending':'enquiry',...values};rows.push(row);matches=[row];state.writes.push([table,{...values}]);}
  }else if(operation==='update'){matches.forEach(row=>Object.assign(row,values));if(matches.length)state.writes.push([table,{...values}]);}
  return{data:single?matches[0]||null:matches.slice(0,limit),count:matches.length,error:null};}return q},
  async rpc(name,args){state.rpc.push([name,args]);if(name==='hotel_workspace_page'){
    const all=state.tables.hotel_booking_enquiries.filter(row=>row.organization_id===args.p_organization_id);const allRooms=state.tables.hotel_rooms.filter(row=>row.organization_id===args.p_organization_id),types=state.tables.hotel_room_types.filter(row=>row.organization_id===args.p_organization_id);
    let rows=all.filter(row=>(!args.p_status||row.status===args.p_status)&&(!args.p_arrival_day||row.arrival_date===args.p_arrival_day&&['confirmed','checked_in','checked_out'].includes(row.status))&&(!args.p_departure_day||row.departure_date===args.p_departure_day&&['checked_in','checked_out'].includes(row.status))&&(!args.p_pending_only||state.tables.hotel_offline_payments.some(p=>p.organization_id===args.p_organization_id&&p.booking_id===row.id&&p.status==='pending')));
    rows=rows.filter(row=>!args.p_query||`${state.tables.crm_customers.find(c=>c.id===row.customer_id)?.full_name} ${row.id}`.toLowerCase().includes(args.p_query.toLowerCase()));const total=rows.length,page=Math.min(args.p_page,Math.max(Math.ceil(total/25)-1,0));
    const availability=allRooms.map(r=>({room_id:r.id,available:r.active&&!all.some(b=>b.room_id===r.id&&['confirmed','checked_in'].includes(b.status)&&b.arrival_date<args.p_departure&&b.departure_date>args.p_arrival)}));
    return{data:{reservations:rows.slice(page*25,page*25+25),pagination:{total,page,pageSize:25,query:args.p_query,status:args.p_status,pendingOnly:args.p_pending_only},summary:{enquiries:all.filter(b=>['enquiry','quoted'].includes(b.status)).length,confirmed:all.filter(b=>b.status==='confirmed').length,inHouse:all.filter(b=>b.status==='checked_in').length},rooms:allRooms,roomTypes:types,availability,availabilityGroups:types.map(t=>({...t,active_rooms:allRooms.filter(r=>r.room_type_id===t.id&&r.active).length,available_rooms:allRooms.filter(r=>r.room_type_id===t.id&&availability.some(a=>a.room_id===r.id&&a.available)).length}))},error:null};
  }if(name==='hotel_room_availability')return {data:[{room_id:room,available:false}],error:null};return{data:(args.p_booking_ids||[]).map(booking_id=>({booking_id,verified_minor:'0',pending_minor:'0'})),error:null}},
 };
 const service=load(path.resolve(dirname,'../lib/hotel-booking-service.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/hotel-booking-contract':contract,
  '@/lib/canonical-customer':{resolveCanonicalCustomer:async input=>{state.canonical.push(input);return{customerId:guest}}},
  '@/lib/hotel-communication-policy':{HOTEL_BOOKING_STATES:['enquiry','quoted','confirmed','checked_in','checked_out','cancelled','expired']},
 });
 const permissions=new Set(options.permissions||['customers.view','customers.manage','billing.view','billing.manage']);
 const route=load(path.resolve(dirname,'../app/api/portal/hotel/workspace/route.ts'),{
  'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},
  '@/lib/client-auth':{getClientSession:async()=>options.anonymous?null:{organizationId:org,userId:options.actor||'manager-one',isAdminPreview:!!options.preview}},
  '@/lib/portal-access':{requirePortalPermission:async(_s,keys)=>{if(options.preview||options.revoked||!keys.some(k=>permissions.has(k)))throw Error('denied');return{permissions}}},
  '@/lib/hotel-communications':{requireHotelOrganization:async()=>{if(options.nonHotel)throw Error('not hotel')}},
  '@/lib/hotel-booking-service':service,
 },'',{URL});return{route,state,service};
}
const post=(route,body)=>route.POST({json:async()=>body});
const get=(route,query='arrival=2026-12-01&departure=2026-12-03')=>route.GET({url:'https://hotel.test/api/portal/hotel/workspace?'+query});
test('overview links scope daily stays before the recent-list limit and fetch exact older booking context',async()=>{
 const {route,state}=harness({permissions:['customers.view']});
 state.tables.hotel_booking_enquiries.unshift(...Array.from({length:300},(_,i)=>({id:`new-${i}`,organization_id:org,customer_id:guest,arrival_date:'2027-01-01',departure_date:'2027-01-02',status:'enquiry'})));
 const daily=await get(route,'arrival=2026-12-01&departure=2026-12-03&arrivalDay=2026-12-01');assert.equal(daily.status,200);assert.equal(daily.body.reservations.length,1);assert.equal(daily.body.reservations[0].id,booking);
 const detail=await get(route,'bookingId='+booking);assert.equal(detail.status,200);assert.equal(detail.body.customer.id,guest);assert.equal(detail.body.room.id,room);assert.equal(detail.body.payments.length,0);assert.equal(state.rpc.some(([name])=>name==='hotel_booking_payment_totals'),false);
 assert.equal((await get(route,'arrival=2026-12-01&departure=2026-12-03&arrivalDay=invalid')).status,400);
});
test('workspace is session-tenant scoped and finance data is permission gated',async()=>{
 const {route,state}=harness({permissions:['customers.view']});const response=await get(route);
 assert.equal(response.status,200);assert.equal(response.body.customers.length,1);assert.equal(response.body.canViewPayments,false);assert.equal(response.body.canManage,false);
 assert.equal(state.rpc.some(([name])=>name==='hotel_booking_payment_totals'),false);
 assert.ok(state.queries.every(([,key,value])=>key!=='organization_id'||value===org));
 assert.equal((await get(route,'bookingId='+foreignBooking)).status,404);
});
test('anonymous, revoked, non-hotel and preview sessions cannot mutate reservations',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{revoked:true},403],[{nonHotel:true},403],[{preview:true},403]]){
  const {route,state}=harness(options);assert.equal((await post(route,{action:'save_reservation',bookingId:booking,revision:2,status:'checked_in'})).status,status);assert.equal(state.writes.length,0);
 }
});
test('multiple authorized managers retain dates and use exact optimistic-concurrency filters',async()=>{
 for(const actor of ['manager-one','manager-two']){const {route,state}=harness({actor});const response=await post(route,{action:'save_reservation',bookingId:booking,revision:2,status:'checked_in',organizationId:other,updated_by:'attacker'});
  assert.equal(response.status,200);assert.equal(response.body.reservation.arrival_date,'2026-12-01');assert.equal(state.writes[0][1].updated_by,actor);
  assert.ok(state.queries.some(([table,key,value])=>table==='hotel_booking_enquiries'&&key==='revision'&&value===2));
 }
 const {route,state}=harness();assert.equal((await post(route,{action:'save_reservation',bookingId:booking,revision:1,status:'checked_in'})).status,409);assert.equal(state.writes.length,0);
});
test('reservation creation is idempotent and mismatched replays cannot create another booking',async()=>{
 const {route,state}=harness();const body={action:'save_reservation',requestId,customerId:guest,status:'enquiry',guestCount:1};
 const first=await post(route,body),second=await post(route,body);assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(first.body.reservation.id,second.body.reservation.id);
 assert.equal((await post(route,{...body,guestCount:2})).status,409);assert.equal(state.writes.length,1);
});
test('recording payments cannot bypass finance permission, currency, actor or pending verification',async()=>{
 const denied=harness({permissions:['customers.manage']});assert.equal((await post(denied.route,{action:'record_payment'})).status,403);
 const {route,state}=harness();const body={action:'record_payment',bookingId:booking,requestId,amount:'50.25',method:'cash',currency:'USD',status:'verified',recorded_by:'attacker'};
 const first=await post(route,body),again=await post(route,body);assert.equal(first.status,200);assert.equal(again.body.payment.id,first.body.payment.id);
 assert.equal(first.body.payment.amount_minor,'5025');assert.equal(first.body.payment.currency,'NGN');assert.equal(first.body.payment.status,'pending');assert.equal(first.body.payment.recorded_by,'manager-one');
 assert.equal((await post(route,{...body,amount:'51'})).status,409);assert.equal(state.writes.length,1);
 assert.equal((await post(route,{...body,requestId:'60000000-0000-4000-8000-000000000002',amount:'1.234'})).status,400);
});
test('new guest identity matching never resets existing opt-out or handover choices',async()=>{
 const {route,state}=harness();assert.equal((await post(route,{action:'create_guest',requestId,name:'Ada',phone:'123',organizationId:other})).status,200);
 assert.equal(state.canonical[0].organizationId,org);assert.equal(state.tables.hotel_guest_profiles[0].opted_out,true);assert.equal(state.tables.hotel_guest_profiles[0].human_handoff,true);assert.equal(state.tables.hotel_guest_profiles[0].marketing_consent,'opted_out');
});
test('payment state changes require the current state and a reason for rejection or voiding',async()=>{
 const {route,state}=harness();const created=await post(route,{action:'record_payment',bookingId:booking,requestId,amount:'25',method:'cash'});const id=created.body.payment.id;
 assert.equal((await post(route,{action:'reject_payment',paymentId:id})).status,400);
 assert.equal((await post(route,{action:'verify_payment',paymentId:id})).status,200);
 assert.equal(state.tables.hotel_offline_payments[0].verified_by,'manager-one');
 assert.equal((await post(route,{action:'verify_payment',paymentId:id})).status,409);
 assert.equal((await post(route,{action:'void_payment',paymentId:id})).status,400);
 assert.equal((await post(route,{action:'void_payment',paymentId:id,note:'Incorrect reference recorded'})).status,200);
});
test('trusted admin preview reads are allowed but all mutation capabilities remain off',async()=>{
 const {route,state}=harness({preview:true});const response=await get(route);assert.equal(response.status,200);assert.equal(response.body.canManage,false);assert.equal(response.body.canManagePayments,false);assert.equal(response.body.canViewPayments,true);
 assert.equal((await post(route,{action:'create_room',name:'999',roomTypeId:type})).status,403);assert.equal(state.writes.length,0);
});
test('room rate changes require a current rate and retain server-owned currency',async()=>{
 const {route,state}=harness();const body={action:'update_type',typeId:type,name:'Double',nightlyRate:'150.00',expectedRateMinor:'10000',currency:'USD',capacity:99};
 assert.equal((await post(route,body)).status,200);const values=state.writes[0][1];assert.equal(values.nightly_rate_minor,'15000');assert.equal(Object.hasOwn(values,'currency'),false);assert.equal(Object.hasOwn(values,'capacity'),false);
 assert.equal((await post(route,{...body,nightlyRate:'160.00'})).status,409);
});

test('full-history query parameters retain tenant scope and pending queues require finance access',async()=>{
 const f=harness();const response=await f.route.GET({url:'https://hotel.invalid/api/portal/hotel/workspace?arrival=2026-12-01&departure=2026-12-03&query=HT-000042&page=2&view=payments&organizationId='+other});assert.equal(response.status,200);const call=f.state.rpc.find(r=>r[0]==='hotel_workspace_page');assert.equal(call[1].p_organization_id,org);assert.equal(call[1].p_query,'HT-000042');assert.equal(call[1].p_page,2);assert.equal(call[1].p_pending_only,true);const denied=harness({permissions:['customers.view']});assert.equal((await denied.route.GET({url:'https://hotel.invalid/api/portal/hotel/workspace?arrival=2026-12-01&departure=2026-12-03&view=payments'})).status,403);
 const detail=await f.route.GET({url:'https://hotel.invalid/api/portal/hotel/workspace?bookingId='+booking});assert.equal(detail.body.reservation.reference,'HT-000042');
});
