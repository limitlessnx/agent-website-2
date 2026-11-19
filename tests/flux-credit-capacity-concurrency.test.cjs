/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {execFile}=require('node:child_process'),{promisify}=require('node:util');
const {org,schemaSQL,capacitySQL}=require('./helpers/flux-capacity-database.cjs');
const run=promisify(execFile),database=process.env.FLUX_CAPACITY_TEST_DATABASE_URL;
if(database){const u=new URL(database);if(!['localhost','127.0.0.1','[::1]'].includes(u.hostname)||u.pathname!=='/flux_capacity_test')throw Error('Capacity tests require the dedicated disposable localhost database');}
const sql=async query=>(await run(process.env.PSQL_BIN||'psql',[database,'-X','-qAt','-v','ON_ERROR_STOP=1','-c',query],{timeout:30000,maxBuffer:4*1024*1024})).stdout.trim();
const lit=v=>"'"+String(v).replaceAll("'","''")+"'";
const reserve=key=>sql("select reserve_flux_credit_capacity('"+org+"',"+lit(key)+",'"+'a'.repeat(64)+"','web_ai',2,'phase12_provider_runtime')");
const finish=(id,outcome='settled')=>sql("select finish_flux_credit_capacity('"+org+"',"+lit(id)+","+lit(outcome)+")");
test('independent PostgreSQL sessions serialize holds, legacy debits, settlement and release', {skip:!database},async()=>{
 await sql(schemaSQL);await sql(capacitySQL);
 await sql("create function capacity_test_delay() returns trigger language plpgsql as $$begin perform pg_sleep(0.05);return new;end$$;create trigger capacity_delay before insert on flux_credit_reservations for each row execute function capacity_test_delay();");
 const same=await Promise.all(Array.from({length:8},()=>reserve('same')));
 const rows=same.map(JSON.parse);assert.equal(rows.filter(r=>r.created).length,1);assert.equal(new Set(rows.map(r=>r.id)).size,1);
 const contenders=await Promise.allSettled(Array.from({length:8},(_,i)=>reserve('competitor-'+i)));
 const admitted=contenders.filter(x=>x.status==='fulfilled').map(x=>JSON.parse(x.value));assert.equal(admitted.length,1);
 await assert.rejects(sql("select record_flux_credit_usage('"+org+"','web_ai',1)"),/reserved/);
 const settled=await Promise.all(Array.from({length:8},()=>finish(rows[0].id)));assert.ok(settled.every(r=>JSON.parse(r).status==='settled'));
 const released=await Promise.all(Array.from({length:8},()=>finish(admitted[0].id,'released')));assert.ok(released.every(r=>JSON.parse(r).status==='released'));
 assert.equal(await sql('select count(*) from flux_credit_ledger'),'1');
 const available=JSON.parse(await sql("select get_flux_credit_availability('"+org+"')"));assert.deepEqual(available,{balance:2,reserved:0,available:2});
});

const {extraSQL,recoverySQL,execution}=require('./helpers/flux-recovery-database.cjs');
test('independent recovery sessions settle once and audit failure rolls back every concurrent attempt',{skip:!database},async()=>{
 await sql(extraSQL);await sql(recoverySQL);
 const reservation=JSON.parse(await reserve('phase12-provider:'+execution));
 const proof={provider:'synthetic',credit_reservation_id:reservation.id,credit_request_fingerprint:'a'.repeat(64),provider_response_id:'synthetic-response'};
 const payload={...proof,id:'synthetic-response',provider:'synthetic',output_text:'Synthetic output',credit_provider_cost_cents:1,credit_usage_quantity:0};
 await sql("insert into runtime_model_requests(organization_id,execution_id,status,response_payload,completed_at) values("+lit(org)+","+lit(execution)+",'succeeded',"+lit(JSON.stringify(payload))+"::jsonb,clock_timestamp());insert into usage_ledger(organization_id,execution_id,usage_type,metadata,occurred_at) values("+lit(org)+","+lit(execution)+",'ai_tokens',"+lit(JSON.stringify(proof))+"::jsonb,clock_timestamp());insert into runtime_progress_events(organization_id,execution_id,event_type,payload,created_at) values("+lit(org)+","+lit(execution)+",'provider.completed',"+lit(JSON.stringify(proof))+"::jsonb,clock_timestamp());");
 const recover=()=>sql("select reconcile_flux_credit_capacity("+lit(org)+","+lit(reservation.id)+",'admin@example.test',null,'Reviewed synthetic completion proof')");
 await sql("create function reject_recovery_audit() returns trigger language plpgsql as $$begin raise exception 'synthetic audit failure';end$$;create trigger reject_recovery_audit before insert on audit_logs for each row execute function reject_recovery_audit();");
 const blocked=await Promise.allSettled(Array.from({length:8},recover));assert.equal(blocked.filter(x=>x.status==='rejected').length,8);assert.equal(await sql('select count(*) from flux_credit_ledger'),'1');assert.equal(await sql('select count(*) from audit_logs'),'0');
 await sql('drop trigger reject_recovery_audit on audit_logs');
 const results=(await Promise.all(Array.from({length:8},recover))).map(JSON.parse);assert.equal(results.filter(x=>x.outcome==='settled').length,1);assert.equal(results.filter(x=>x.outcome==='already_settled').length,7);
 assert.equal(await sql('select count(*) from flux_credit_ledger'),'2');assert.equal(await sql('select count(*) from audit_logs'),'8');
});

test('independent channel recovery sessions settle once using the same audited transaction',{skip:!database},async()=>{
 const fs=require('node:fs');const migration=fs.readdirSync('supabase/migrations').find(x=>x.endsWith('_flux_credit_channel_operations.sql'));
 await sql(fs.readFileSync('supabase/migrations/'+migration,'utf8'));
 await sql('update flux_credit_wallets set balance=4');
 const fingerprint='b'.repeat(64),key='flux-op:phase12_internal_agent:independent-session';
 const r=JSON.parse(await sql("select reserve_flux_credit_capacity("+lit(org)+","+lit(key)+","+lit(fingerprint)+",'web_ai',2,'phase12_internal_agent')"));
 const raw=JSON.stringify({version:1,reservation_id:r.id,organization_id:org,fingerprint,action:'web_ai',source:'phase12_internal_agent',credits:2,provider:'synthetic',provider_completed:true,provider_cost_cents:1,usage:{}});
 const hash=require('node:crypto').createHash('sha256').update(raw).digest('hex');
 await sql("select finish_flux_credit_capacity("+lit(org)+","+lit(r.id)+",'needs_attention','provider_completed_accounting_pending',null,null,'{}',"+lit(JSON.stringify({operation_completion_json:raw,operation_completion_sha256:hash}))+"::jsonb)");
 const recover=()=>sql("select reconcile_flux_credit_capacity("+lit(org)+","+lit(r.id)+",'admin@example.test',null,'Reviewed synthetic channel completion')");
 await sql('create trigger reject_recovery_audit before insert on audit_logs for each row execute function reject_recovery_audit()');
 const blocked=await Promise.allSettled(Array.from({length:8},recover));assert.equal(blocked.filter(x=>x.status==='rejected').length,8);assert.equal(await sql('select count(*) from flux_credit_ledger'),'2');
 await sql('drop trigger reject_recovery_audit on audit_logs');
 const results=(await Promise.all(Array.from({length:8},recover))).map(JSON.parse);assert.equal(results.filter(x=>x.outcome==='settled').length,1);assert.equal(results.filter(x=>x.outcome==='already_settled').length,7);assert.equal(await sql('select count(*) from flux_credit_ledger'),'3');
});
