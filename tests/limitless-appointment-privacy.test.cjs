const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org='b15f21b4-5697-4d21-9421-8a34eae3476d';
function fixture(organizationRecord={id:org,slug:'limitless-realty',status:'active',metadata:{industry_slug:'real_estate'}}) {
 const calls=[];
 let calendarEventCalls=0;
 const admin={from(table){calls.push(['from',table]);const q={select(){return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(){return this;},limit(){return this;},maybeSingle(){return Promise.resolve({data:table==='organizations'?organizationRecord:null,error:null});},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
 const m=load('lib/ai/maia-appointment-tools.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/limitless-inspections':{listLimitlessInspections:async()=>[]},'@/lib/appointment-scheduling':{},'@/lib/calendar-provider':{createCalendarEvent:async()=>{calendarEventCalls++;return {}; }},'@/lib/real-estate-organization':{isRealEstateOrganizationRecord:record=>record?.slug==='limitless-realty'||record?.metadata?.industry_slug==='real_estate'}});
 const tools=m.maiaAppointmentTools();
 return {tool:tools.find(t=>t.name==='list_my_appointments'),bookingTool:tools.find(t=>t.name==='create_appointment_booking'),calls,calendarEventCalls:()=>calendarEventCalls};
}
test('unresolved customer gets no tenant appointment rows',async()=>{
 const {tool,calls}=fixture();const result=await tool.execute({}, {organizationId:org,agentId:'a',sessionId:'s'});
 assert.equal(result.status,'customer_not_resolved');assert.equal(result.appointments.length,0);assert.ok(!calls.some(c=>c[1]==='appointments'));
});
test('model cannot request another customer appointments',async()=>{
 const {tool,calls}=fixture();await assert.rejects(tool.execute({customerId:'other'}, {organizationId:org,customerId:'self',agentId:'a',sessionId:'s'}),/verified current customer/);assert.equal(calls.length,0);
});
test('resolved customer query uses both organization and current customer',async()=>{
 const {tool,calls}=fixture();await tool.execute({}, {organizationId:org,customerId:'self',agentId:'a',sessionId:'s'});
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='organization_id'&&c[2]===org));assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='customer_id'&&c[2]==='self'));
});

test('real-estate booking requires operator confirmation before any calendar side effect',async()=>{
 const {bookingTool,calls,calendarEventCalls}=fixture();
 const result=await bookingTool.execute({startAt:'2026-11-01T10:00:00+01:00',title:'Property inspection'}, {organizationId:org,customerId:'self',agentId:'a',sessionId:'s'});
 assert.equal(result.status,'operator_confirmation_required');assert.equal(result.confirmed,false);
 assert.ok(!calls.some(c=>c[1]==='appointments'));assert.equal(calendarEventCalls(),0);
});

test('non-real-estate booking still passes industry gate and uses tenant customer lookup',async()=>{
 const otherOrg='other-tenant';const {bookingTool,calls}=fixture({id:otherOrg,slug:'other-tenant',status:'active',metadata:{industry_slug:'healthcare'}});
 await assert.rejects(bookingTool.execute({startAt:'2026-11-01T10:00:00+01:00',title:'Consultation'}, {organizationId:otherOrg,customerId:'customer-1',agentId:'a',sessionId:'s'}),/Customer record was not found in the active tenant/);
 assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='organization_id'&&c[2]===otherOrg));assert.ok(calls.some(c=>c[0]==='from'&&c[1]==='crm_customers'));
});
