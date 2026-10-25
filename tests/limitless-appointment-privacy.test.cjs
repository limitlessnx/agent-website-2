const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org='b15f21b4-5697-4d21-9421-8a34eae3476d';
function fixture() {
 const calls=[];
 const admin={from(table){calls.push(['from',table]);const q={select(){return this;},eq(k,v){calls.push(['eq',k,v]);return this;},order(){return this;},limit(){return this;},maybeSingle(){return Promise.resolve({data:null,error:null});},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
 const m=load('lib/ai/maia-appointment-tools.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/limitless-inspections':{listLimitlessInspections:async()=>[]},'@/lib/appointment-scheduling':{}});
 return {tool:m.maiaAppointmentTools().find(t=>t.name==='list_my_appointments'),calls};
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
