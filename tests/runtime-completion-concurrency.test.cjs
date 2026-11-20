/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const f=require('./helpers/runtime-completion-database.cjs'),run=promisify(execFile),database=process.env.RUNTIME_COMPLETION_TEST_DATABASE_URL;
if(database){const u=new URL(database);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/runtime_completion_test')throw Error('Only the dedicated disposable localhost completion database is allowed');}
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const sql=async query=>(await run(process.env.PSQL_BIN||'psql',[database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],{timeout:30000,maxBuffer:4*1024*1024})).stdout.trim();
const complete=(extra={})=>{const n=f.input(extra);return sql(`select public.complete_runtime_execution(${lit(n.p_organization_id)},${lit(n.p_agent_id)},${lit(n.p_execution_id)},${lit(n.p_status)},${lit(JSON.stringify(n.p_output))}::jsonb,null,null)`);};
test('independent PostgreSQL finalizers write one completion/usage/audit and leave queued deliveries untouched',{skip:!database},async()=>{
 await sql(f.rolesSQL);await sql(f.schemaSQL);await sql(f.completionSQL);await sql(f.seedSQL);
 await sql(`insert into command_queue(organization_id,agent_id,execution_id,command_type) values(${lit(f.org)},${lit(f.agent)},${lit(f.execution)},'email.send_message')`);
 await sql("create function completion_test_delay() returns trigger language plpgsql as $$begin perform pg_sleep(0.05);return new;end$$;create trigger completion_test_delay before insert on runtime_progress_events for each row execute function completion_test_delay();");
 const results=(await Promise.all(Array.from({length:8},()=>complete()))).map(JSON.parse);assert.equal(results.filter(x=>!x.duplicate).length,1);assert.equal(new Set(results.map(x=>x.completed_at)).size,1);assert.equal(await sql('select count(*) from usage_ledger'),'1');assert.equal(await sql('select count(*) from audit_logs'),'1');assert.equal(await sql("select status from command_queue where command_type='email.send_message'"),'queued');assert.equal(await sql('select count(*) from flux_credit_ledger'),'0');
});
test('independent audit failures leave no partial completion and concurrent recovery commits once',{skip:!database},async()=>{
 const id='30000000-0000-4000-8000-000000000003';await sql(`insert into runtime_executions(id,organization_id,agent_id,status) values(${lit(id)},${lit(f.org)},${lit(f.agent)},'running')`);
 await sql("create function completion_reject_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger completion_reject_audit before insert on audit_logs for each row execute function completion_reject_audit();");
 const results=await Promise.allSettled(Array.from({length:8},()=>complete({p_execution_id:id})));assert.equal(results.filter(x=>x.status==='rejected').length,8);assert.equal(await sql(`select status from runtime_executions where id=${lit(id)}`),'running');assert.equal(await sql('select count(*) from usage_ledger'),'1');
 await sql('drop trigger completion_reject_audit on audit_logs');const recovered=(await Promise.all(Array.from({length:8},()=>complete({p_execution_id:id})))).map(JSON.parse);assert.equal(recovered.filter(x=>!x.duplicate).length,1);assert.equal(await sql('select count(*) from usage_ledger'),'2');assert.equal(await sql('select count(*) from audit_logs'),'2');
});
