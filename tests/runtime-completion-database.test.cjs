/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const f=require('./helpers/runtime-completion-database.cjs');
async function count(db,table){return(await db.query('select count(*)::int n from '+table)).rows[0].n;}
test('completion retries commit one usage/audit and recover the original timestamp without consuming queued delivery jobs',async t=>{
 const db=await f.fixture(t);await f.parent(db);await db.exec(`update runtime_executions set input='{"workflow_key":"outbound_email_crm_v5"}'`);
 const a=await f.complete(db),b=await f.complete(db);assert.equal(a.ok,true);assert.deepEqual(b,{...a,duplicate:true});
 assert.equal(await count(db,'usage_ledger'),1);assert.equal(await count(db,'audit_logs'),1);assert.equal(await count(db,'runtime_progress_events'),2);assert.equal(await count(db,'flux_credit_ledger'),0);
 const rows=(await db.query('select command_type,status,completed_at from command_queue order by command_type')).rows;
 assert.equal(rows.find(x=>x.command_type==='agent.respond').status,'succeeded');for(const r of rows.filter(x=>x.command_type!=='agent.respond')){assert.equal(r.status,'queued');assert.equal(r.completed_at,null);}
 assert.equal((await db.query('select metadata from usage_ledger')).rows[0].metadata.workflow_key,'outbound_email_crm_v5');
});
test('changed output/status/error on a retry cannot overwrite original completion',async t=>{
 const db=await f.fixture(t);await f.complete(db);
 for(const extra of [{p_output:{changed:true}},{p_status:'failed',p_error_code:'failure'},{p_status:'blocked',p_error_message:'blocked'}])await assert.rejects(f.complete(db,extra),/completion_input_conflict/);
 assert.equal(await count(db,'usage_ledger'),1);assert.equal((await db.query('select status from runtime_executions where id=$1',[f.execution])).rows[0].status,'succeeded');
});
test('every persistence failure rolls back execution, usage, progress, queue and audit; retry then commits once',async t=>{
 const db=await f.fixture(t);await f.parent(db);
 await db.exec("create function completion_reject_test() returns trigger language plpgsql as $$begin raise exception 'synthetic persistence failure';end$$;");
 for(const table of ['usage_ledger','runtime_progress_events','command_queue','audit_logs']){
  await db.exec('create trigger completion_reject before insert or update on '+table+' for each row execute function completion_reject_test()');
  await assert.rejects(f.complete(db),/synthetic persistence failure/);assert.equal(await count(db,'usage_ledger'),0);assert.equal(await count(db,'runtime_progress_events'),0);assert.equal(await count(db,'audit_logs'),0);
  assert.equal((await db.query('select status from runtime_executions where id=$1',[f.execution])).rows[0].status,'running');assert.equal((await db.query("select status from command_queue where command_type='agent.respond'")).rows[0].status,'queued');
  await db.exec('drop trigger completion_reject on '+table);
 }
 assert.equal((await f.complete(db)).ok,true);assert.equal((await f.complete(db)).duplicate,true);assert.equal(await count(db,'usage_ledger'),1);
});
test('foreign identities and inactive organizations fail closed without telemetry or mutations',async t=>{
 const db=await f.fixture(t);
 for(const extra of [{p_execution_id:f.foreignExecution},{p_agent_id:f.foreignAgent},{p_organization_id:f.other}])await assert.rejects(f.complete(db,extra),/completion_scope_mismatch/);
 await db.query("update organizations set status='suspended' where id=$1",[f.org]);await assert.rejects(f.complete(db),/completion_scope_mismatch/);assert.equal(await count(db,'usage_ledger'),0);
});
test('legacy terminal and partial telemetry require review without guessing a successful finalization',async t=>{
 const db=await f.fixture(t);await db.query("update runtime_executions set status='succeeded' where id=$1",[f.execution]);await assert.rejects(f.complete(db),/legacy_completion_requires_review/);
 await db.query("update runtime_executions set status='running' where id=$1",[f.execution]);await db.query("insert into usage_ledger(organization_id,agent_id,execution_id,usage_type,quantity) values($1,$2,$3,'workflow_execution',1)",[f.org,f.agent,f.execution]);await assert.rejects(f.complete(db),/legacy_completion_requires_review/);assert.equal(await count(db,'audit_logs'),0);
});
test('missing usage/audit, altered receipt or changed execution state invalidates replay evidence',async t=>{
 const db=await f.fixture(t);await f.complete(db);
 const mutations=["delete from audit_logs","delete from usage_ledger","update runtime_executions set output='{}'",`update runtime_progress_events set payload=jsonb_set(payload,'{result,status}','"failed"') where event_type='execution.finalization_committed'`];
 for(const sql of mutations){await db.exec('begin');await db.exec(sql);await assert.rejects(f.complete(db),/completion_evidence_unavailable/);await db.exec('rollback');}
 assert.equal((await f.complete(db)).duplicate,true);
});
test('cancelled parent retains cancellation and terminal delivery jobs remain untouched',async t=>{
 const db=await f.fixture(t);await f.parent(db);await db.exec("update command_queue set status='failed',last_error='provider failure' where command_type='email.send_message'");
 await f.complete(db,{p_status:'cancelled'});const rows=(await db.query('select command_type,status,last_error from command_queue')).rows;assert.equal(rows.find(x=>x.command_type==='agent.respond').status,'cancelled');assert.equal(rows.find(x=>x.command_type==='email.send_message').last_error,'provider failure');
});
test('function is invoker with empty search path and denies anonymous/authenticated roles',async t=>{
 const db=await f.fixture(t);const rows=(await db.query("select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'execute') anon,has_function_privilege('authenticated',p.oid,'execute') authenticated,has_function_privilege('service_role',p.oid,'execute') service from pg_proc p where proname='complete_runtime_execution'")).rows;assert.equal(rows[0].prosecdef,false);assert.deepEqual(rows[0].proconfig,['search_path=\"\"']);assert.equal(rows[0].anon,false);assert.equal(rows[0].authenticated,false);assert.equal(rows[0].service,true);
 await db.exec('set role authenticated');await assert.rejects(f.complete(db),/permission denied/);await db.exec('reset role');
});
