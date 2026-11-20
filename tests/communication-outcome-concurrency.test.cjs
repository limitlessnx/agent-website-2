/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const f=require('./helpers/communication-outcome-database.cjs');
const run=promisify(execFile),database=process.env.COMMUNICATION_OUTCOME_TEST_DATABASE_URL;
if(database){const u=new URL(database);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/communication_outcome_test')throw Error('Only the dedicated disposable localhost outcome database is allowed');}
const lit=value=>"'"+String(value).replaceAll("'","''")+"'";
const sql=async query=>(await run(process.env.PSQL_BIN||'psql',[database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],{timeout:30000,maxBuffer:4*1024*1024})).stdout.trim();
const persist=(kind='email',changes={})=>{const n=f.normalized(kind,changes);return sql(`select public.persist_runtime_communication_outcome(${lit(n.body.organization_id)},${lit(n.body.agent_id)},${lit(n.body.execution_id)},${lit(n.workflow)},${lit(JSON.stringify(n.body))}::jsonb,${lit(JSON.stringify(n.billing))}::jsonb)`);};
test('independent PostgreSQL sessions commit one outcome/debit and all retries recover the same action intent',{skip:!database},async()=>{
 await sql(f.rolesSQL);await sql(f.schemaSQL);await sql(f.capacitySQL);await sql(f.outcomeSQL);await sql(f.seedSQL);
 await sql("create function outcome_test_delay() returns trigger language plpgsql as $$begin perform pg_sleep(0.05);return new;end$$;create trigger outcome_test_delay before insert on runtime_progress_events for each row execute function outcome_test_delay();");
 const results=(await Promise.all(Array.from({length:8},()=>persist()))).map(JSON.parse);assert.equal(results.filter(r=>r.duplicate!==true).length,1);assert.equal(new Set(results.map(r=>r.conversation_id)).size,1);assert.equal(new Set(results.map(r=>JSON.stringify(r.email_action))).size,1);assert.equal(await sql('select count(*) from flux_credit_ledger'),'1');assert.equal(await sql('select count(*) from crm_customers'),'1');assert.equal(await sql('select count(*) from usage_ledger'),'1');
});
test('concurrent failed audit attempts roll back every side effect; a later retry commits only once',{skip:!database},async()=>{
 const changes={execution_id:'30000000-0000-4000-8000-000000000003',idempotency_key:'synthetic-voice'};
 await sql(`insert into runtime_executions(id,organization_id,agent_id,status) values(${lit(changes.execution_id)},${lit(f.org)},${lit(f.agent)},'running')`);
 await sql("create function outcome_reject_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger outcome_reject_audit before insert on audit_logs for each row execute function outcome_reject_audit();");
 const attempts=await Promise.allSettled(Array.from({length:8},()=>persist('voice',changes)));assert.equal(attempts.filter(x=>x.status==='rejected').length,8);assert.equal(await sql('select count(*) from flux_credit_ledger'),'1');assert.equal(await sql('select count(*) from audit_logs'),'1');assert.equal(await sql(`select balance from flux_credit_wallets where organization_id=${lit(f.org)}`),'97');
 await sql('drop trigger outcome_reject_audit on audit_logs');const results=(await Promise.all(Array.from({length:8},()=>persist('voice',changes)))).map(JSON.parse);assert.equal(results.filter(x=>x.duplicate!==true).length,1);assert.equal(await sql('select count(*) from flux_credit_ledger'),'2');assert.equal(await sql('select count(*) from audit_logs'),'2');assert.equal(await sql(`select balance from flux_credit_wallets where organization_id=${lit(f.org)}`),'57');
});
