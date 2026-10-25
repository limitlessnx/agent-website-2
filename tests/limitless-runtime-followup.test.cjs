const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org='b15f21b4-5697-4d21-9421-8a34eae3476d';

function fixture(lead) {
 const writes=[]; const selects=[];
 const admin={from(table) { const q={select(v){selects.push([table,v]);return this;},eq(){return this;},insert(v){writes.push([table,v]);return this;},maybeSingle(){return Promise.resolve({data:lead,error:null});},single(){return Promise.resolve({data:{id:'f1'},error:null});}};return q;}};
 const m=load('lib/ai/maia-runtime.ts',{
  '@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/ai/maia-estate-tools':{},'@/lib/real-estate-access':{},'@/lib/real-estate-inspections':{},
  '@/lib/ai/maia-property-tools':{maiaPropertyTools:()=>[]},
  '@/lib/ai/maia-appointment-tools':{maiaAppointmentTools:()=>[]},
  '@/lib/ai/limitless-handoff-policy.mjs':{buildLimitlessHandoffAcknowledgement:()=>"Handoff recorded."},
  '@/lib/flux-ai-metering-core':{},'@/lib/limitless-inspections':{},'@/lib/human-operations':{},'@/lib/whatsapp-integration':{},
 },'export { toolSet };');
 return {tool:m.toolSet().find(t=>t.name==='create_followup_task'),writes,selects};
}
const args={leadId:'l1',title:'Approved follow-up',description:'Check inspection preference',dueAt:'2099-01-01T12:00:00Z'};
const ctx={organizationId:org,agentId:'a1',sessionId:'s1'};
test('Limitless follows actual opted_out field and stores text content in authoritative pipeline',async()=>{
 const {tool,writes,selects}=fixture({id:'l1',phone:'234000000000',opted_out:false}); await tool.execute(args,ctx);
 assert.equal(writes.length,1);assert.equal(writes[0][0],'follow_ups');assert.equal(writes[0][1].message_sent,'Check inspection preference');
 assert.equal(writes[0][1].organization_id,org);assert.equal(writes[0][1].status,'pending');assert.ok(selects.some(x=>x[1]==='id,phone,opted_out'));
 assert.ok(!selects.some(x=>x[1].includes('whatsapp_opted_out')));
});
test('opted-out lead never creates an active follow-up',async()=>{
 const {tool,writes}=fixture({id:'l1',phone:'234000000000',opted_out:true});await assert.rejects(tool.execute(args,ctx),/opted out/);assert.equal(writes.length,0);
});
test('invalid or missing future due time never writes an active schedule',async()=>{
 for(const dueAt of [undefined,'invalid','2000-01-01T00:00:00Z']){
  const {tool,writes}=fixture({id:'l1',phone:'234000000000',opted_out:false});await assert.rejects(tool.execute({...args,dueAt},ctx),/future/);assert.equal(writes.length,0);
 }
});
