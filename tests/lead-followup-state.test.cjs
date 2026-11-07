const test=require('node:test');const assert=require('node:assert/strict');const load=require('./helpers/load-typescript.cjs');
function harness(options={}){
 const filters=[];
 const admin={from(table){return{select(){return this},eq(key,value){filters.push([table,key,value]);return this},in(){return this},limit:async()=>table==='limitless_maia_followup_sequences'?{data:options.sequences||[],count:options.sequenceCount??(options.sequences||[]).length,error:options.sequenceError}:{data:options.issues||[],count:(options.issues||[]).length,error:options.issueError}}}};
 const module=load('lib/lead-followup-state.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}});return{module,filters};
}
test('a newly activated lead is in follow-up before its first send; multiple property sequences count the lead once',()=>{
 const{module}=harness();const states=module.summarizeLeadFollowups([{id:'s1',lead_id:'lead',status:'active',consent_state:'opted_in'},{id:'s2',lead_id:'lead',status:'active',consent_state:'opted_in'}],[]);
 assert.equal(Object.values(states).filter(state=>state.active).length,1);assert.equal(states.lead.needsReview,false);
});
test('unknown first delivery remains visibly active with needs-review state',()=>{
 const{module}=harness();const state=module.summarizeLeadFollowups([{id:'s1',lead_id:'lead',status:'active',consent_state:'opted_in'}],[{sequence_id:'s1',status:'unknown'}]).lead;
 assert.equal(state.active,true);assert.equal(state.needsReview,true);
});
test('paused, stopped and completed sequences cannot inflate active follow-up counts',()=>{
 const{module}=harness();const states=module.summarizeLeadFollowups([{id:'s1',lead_id:'paused',status:'paused',consent_state:'opted_in'},{id:'s2',lead_id:'old',status:'stopped',consent_state:'opted_in'},{id:'s3',lead_id:'done',status:'completed',consent_state:'opted_in'}],[]);
 assert.equal(Object.values(states).filter(state=>state.active).length,0);assert.equal(states.paused.paused,true);assert.equal(states.old,undefined);assert.equal(states.done,undefined);
});
test('both sequence and delivery-state reads are scoped to the current organization',async()=>{
 const h=harness({sequences:[{id:'s1',lead_id:'lead',status:'active',consent_state:'opted_in'}],issues:[{sequence_id:'s1',status:'failed'}]});const states=await h.module.getLeadFollowupStates('tenant-a');assert.equal(states.lead.needsReview,true);
 for(const table of['limitless_maia_followup_sequences','follow_ups'])assert.ok(h.filters.some(([t,k,v])=>t===table&&k==='organization_id'&&v==='tenant-a'));
});
test('read failures and truncated state fail instead of displaying a misleading zero',async()=>{
 for(const options of[{sequenceError:true},{sequences:[{id:'s1',lead_id:'lead',status:'active',consent_state:'opted_in'}],issueError:true},{sequenceCount:1001}]){const h=harness(options);await assert.rejects(()=>h.module.getLeadFollowupStates('tenant-a'),/Unable to load/);}
});
