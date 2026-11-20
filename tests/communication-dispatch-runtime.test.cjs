/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs'),adapter=require('./helpers/outcome-query-adapter.cjs'),f=require('./helpers/communication-outcome-database.cjs');
const customerId='70000000-0000-4000-8000-000000000001';
const commandApi=load('lib/runtime/command-queue.ts',{},'',{Error});
async function fixture(t,{missing=false,failProgress=()=>false,failIntegration=()=>false}={}){const db=await f.fixture(t);await db.exec(`insert into crm_customers(id,organization_id,external_key,email) values('${customerId}','${f.org}','synthetic-contact','synthetic@example.test')`);const schema=fs.readFileSync('tests/fixtures/tenant-starter-repair/schema.sql','utf8').split('\n').find(x=>x.startsWith('create table public.organization_integrations '));await db.exec(schema);if(!missing)await db.exec(`insert into organization_integrations(organization_id,provider,display_name,status,credential_reference) values('${f.org}','email','Synthetic email','connected','synthetic-private-reference'),('${f.org}','google_calendar','Synthetic calendar','connected','synthetic-private-reference')`);
 const admin=adapter(db,{failProgress,failIntegration});const route=load('app/api/internal/runtime/actions/dispatch/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/runtime/auth':{assertRuntimeSecret:()=>{}},'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/runtime/command-queue':commandApi,'@/lib/maia-action-gateway':{dispatchMaiaWhatsAppFollowUp:()=>{throw Error('External communications forbidden in this test')}}},'',{Error});
 const post=async(actions,extra={})=>route.POST({headers:{get:()=>null},json:async()=>({organization_id:f.org,agent_id:f.agent,execution_id:f.execution,idempotency_key:'synthetic-dispatch',actions,...extra})});return{db,post};}
const email={type:'reply',payload:{channel:'email',customer_id:customerId,recipient:'synthetic@example.test',subject:'Synthetic subject',content:'Synthetic content'}};
test('retried email/appointment/follow-up intents queue once using real constraints, preserve subject and do not expose integration references',async t=>{
 const x=await fixture(t);const actions=[email,{type:'appointment',payload:{starts_at:'2027-01-01T00:00:00Z'}},{type:'follow_up',payload:{due_at:'2027-01-01T00:00:00Z'}}];const a=await x.post(actions),b=await x.post(actions);assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.body.action_results,b.body.action_results);assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,3);assert.equal((await x.db.query("select payload->>'subject' subject from command_queue where command_type='email.send_message'")).rows[0].subject,'Synthetic subject');assert.ok(!JSON.stringify(a).includes('synthetic-private-reference'));
});
test('a missing integration or incomplete email action is blocked, never reported as successful dispatch',async t=>{
 const x=await fixture(t,{missing:true});const r=await x.post([email]);assert.equal(r.status,409);assert.equal(r.body.ok,false);assert.equal(r.body.needs_attention,true);assert.equal((await x.db.query('select event_type from runtime_progress_events')).rows[0].event_type,'actions.blocked');assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,0);
 const incomplete=await x.post([{type:'reply',payload:{channel:'email',content:'message'}}]);assert.match(incomplete.body.action_results[0].reason,/missing/);
});
test('progress storage outage after enqueue is recoverable without creating another job',async t=>{
 let failing=true;const x=await fixture(t,{failProgress:()=>failing});assert.equal((await x.post([email])).status,409);failing=false;assert.equal((await x.post([email])).status,200);assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,1);
});
test('conflicting retry or failed job never overwrites or restarts the original queue entry',async t=>{
 const x=await fixture(t);await x.post([email]);const changed=await x.post([{...email,payload:{...email.payload,content:'Changed'}}]);assert.equal(changed.status,409);assert.equal((await x.db.query('select payload from command_queue')).rows[0].payload.content,'Synthetic content');await x.db.exec("update command_queue set status='failed'");assert.equal((await x.post([email])).status,409);assert.equal((await x.db.query('select status from command_queue')).rows[0].status,'failed');
});
test('integration read failures remain unavailable evidence rather than missing-configuration feedback',async t=>{
 const x=await fixture(t,{failIntegration:()=>true});const r=await x.post([email]);assert.equal(r.status,409);assert.match(r.body.error,/evidence is unavailable/);assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,0);
});
test('foreign execution cannot enqueue a command or expose a tenant integration',async t=>{
 const x=await fixture(t);assert.equal((await x.post([email],{execution_id:f.foreignExecution})).status,404);assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,0);
});

test('a recovered action rechecks current opt-out and recipient evidence before enqueue',async t=>{
 const x=await fixture(t);await x.db.exec(`update crm_customers set metadata='{"opted_out":true}' where id='${customerId}'`);const stopped=await x.post([email]);assert.equal(stopped.status,409);assert.match(stopped.body.action_results[0].reason,/suppressed/);assert.equal((await x.db.query('select count(*)::int n from command_queue')).rows[0].n,0);
 await x.db.exec(`update crm_customers set metadata='{}' where id='${customerId}'`);const changed=await x.post([{...email,payload:{...email.payload,recipient:'different@example.test'}}]);assert.equal(changed.status,409);assert.equal(changed.body.action_results[0].reason,'email_recipient_requires_review');
});
