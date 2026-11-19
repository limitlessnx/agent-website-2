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
