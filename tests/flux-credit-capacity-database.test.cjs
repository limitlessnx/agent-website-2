/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const {org,other,fixture,reserve,finish,available,count,capacitySQL}=require('./helpers/flux-capacity-database.cjs');
test('holds reserve capacity without debiting or inventing consumed usage',async t=>{
 const db=await fixture(t),r=await reserve(db);
 assert.equal(r.status,'held');assert.equal(r.created,true);assert.equal(await count(db),0);
 assert.deepEqual(await available(db),{balance:4,reserved:2,available:2});
 const duplicate=await reserve(db);assert.equal(duplicate.created,false);assert.equal(duplicate.id,r.id);
 for(const changed of [{credits:3},{fingerprint:'b'.repeat(64)},{source:'other'},{action:'whatsapp_ai'}])await assert.rejects(reserve(db,changed),/conflicts/);
});
test('one scoped settlement consumes once and repeated terminal outcomes do not refund or charge again',async t=>{
 const db=await fixture(t),r=await reserve(db);
 assert.equal((await finish(db,r)).status,'settled');assert.equal((await finish(db,r)).status,'settled');
 assert.equal((await finish(db,r,'released')).status,'settled');assert.equal(await count(db),1);
 assert.deepEqual(await available(db),{balance:2,reserved:0,available:2});
 const row=(await db.query('select metadata,credit_delta from flux_credit_ledger')).rows[0];
 assert.equal(row.credit_delta,-2);assert.equal(row.metadata.credit_reservation_id,r.id);
});
test('release is idempotent, restores only capacity, and cannot be turned into a later charge',async t=>{
 const db=await fixture(t),r=await reserve(db);
 assert.equal((await finish(db,r,'released')).status,'released');await finish(db,r,'released');await finish(db,r);
 assert.equal(await count(db),0);assert.deepEqual(await available(db),{balance:4,reserved:0,available:4});
 assert.equal((await reserve(db)).created,false);
});
test('holds in separate tenants share no capacity or completion authority',async t=>{
 const db=await fixture(t),a=await reserve(db),b=await reserve(db,{organization:other});
 assert.notEqual(a.id,b.id);await assert.rejects(finish(db,a,'settled',{organization:other}),/inside the organization/);
 assert.equal((await available(db,other)).reserved,2);assert.equal(await count(db),0);
});
test('legacy consumption cannot spend held capacity but can use unreserved credits',async t=>{
 const db=await fixture(t),r=await reserve(db,{credits:3});
 const debit=credits=>db.query("select public.record_flux_credit_usage($1,'web_ai',$2)",[org,credits]);
 await assert.rejects(debit(2),/reserved/);await debit(1);
 assert.deepEqual(await available(db),{balance:3,reserved:3,available:0});
 assert.equal((await finish(db,r)).status,'settled');assert.equal((await available(db)).balance,0);assert.equal(await count(db),2);
});
test('interleaved capacity requests admit only available units and each hold can settle safely',async t=>{
 const db=await fixture(t);
 const results=await Promise.allSettled(Array.from({length:8},(_,i)=>reserve(db,{key:'request-'+i})));
 const holds=results.filter(x=>x.status==='fulfilled').map(x=>x.value);assert.equal(holds.length,2);
 assert.equal((await available(db)).available,0);
 await Promise.all(holds.map(r=>finish(db,r)));assert.equal(await count(db),2);
 assert.deepEqual(await available(db),{balance:0,reserved:0,available:0});
});
test('a failed usage insertion rolls back debit and provisional settlement together',async t=>{
 const db=await fixture(t),r=await reserve(db);
 await db.exec("create function fail_ledger() returns trigger language plpgsql as $$begin raise exception 'synthetic failure';end$$;create trigger fail_ledger before insert on flux_credit_ledger for each row execute function fail_ledger();");
 const result=await finish(db,r);assert.equal(result.status,'needs_attention');assert.equal(result.reason,'settlement_failed');
 assert.equal(await count(db),0);assert.deepEqual(await available(db),{balance:4,reserved:2,available:2});
 await db.exec('drop trigger fail_ledger on flux_credit_ledger');
 assert.equal((await finish(db,r)).status,'settled');assert.equal(await count(db),1);
});
test('period changes and suspension preserve evidence without debiting a different period or inactive wallet',async t=>{
 const db=await fixture(t),r=await reserve(db);
 await db.query("update flux_credit_wallets set current_period_start='2026-12-01',balance=100 where organization_id=$1",[org]);
 assert.equal((await finish(db,r)).reason,'billing_period_changed');assert.equal(await count(db),0);
 await finish(db,r,'released');
 const r2=await reserve(db,{key:'second'});
 await db.query("update flux_credit_wallets set status='suspended' where organization_id=$1",[org]);
 assert.equal((await finish(db,r2)).reason,'wallet_unavailable');assert.equal(await count(db),0);
});
test('invalid, inactive, expired and unavailable reservations fail before any hold is created',async t=>{
 const db=await fixture(t);
 for(const changed of [{credits:0},{credits:-1},{fingerprint:'bad'},{key:' '},{action:'unknown'},{credits:5}])await assert.rejects(reserve(db,changed));
 for(const status of ['paused','suspended','cancelled']){
  await db.query('update flux_credit_wallets set status=$1 where organization_id=$2',[status,org]);
  await assert.rejects(reserve(db),/cannot authorize/);
 }
 await db.query("update flux_credit_wallets set status='trialing',trial_credit_limit=250,trial_ends_at=now()-interval '1 day' where organization_id=$1",[org]);
 await assert.rejects(reserve(db),/cannot authorize/);
 await db.query("update flux_credit_wallets set trial_ends_at=now()+interval '1 day' where organization_id=$1",[org]);
 await assert.rejects(reserve(db,{action:'leo_chat'}),/free trial/);
 assert.equal(Number((await db.query('select count(*) as n from flux_credit_reservations')).rows[0].n),0);
});
test('anonymous/authenticated roles cannot call financial RPCs or read reservation evidence',async t=>{
 const db=await fixture(t);
 for(const role of ['anon','authenticated']){
  await db.exec('set role '+role);
  await assert.rejects(db.query('select * from flux_credit_reservations'),/permission denied/);
  await assert.rejects(available(db),/permission denied/);await assert.rejects(reserve(db),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await reserve(db)).status,'held');await db.exec('reset role');
 const funcs=(await db.query("select prosecdef from pg_proc where proname in ('get_flux_credit_availability','reserve_flux_credit_capacity','finish_flux_credit_capacity')")).rows;
 assert.equal(funcs.length,3);assert.ok(funcs.every(x=>x.prosecdef===false));
});
test('migration replay preserves in-flight evidence and the guarded debit function',async t=>{
 const db=await fixture(t),r=await reserve(db);await db.exec(capacitySQL);
 assert.equal((await reserve(db)).id,r.id);assert.equal(await count(db),0);
 assert.equal((await available(db)).reserved,2);
});

test('a plan change is reviewed without billing against a different agreement',async t=>{
 const db=await fixture(t),r=await reserve(db);
 await db.query("update flux_credit_wallets set plan_code='plus' where organization_id=$1",[org]);
 assert.equal((await finish(db,r)).reason,'plan_changed');assert.equal(await count(db),0);
 assert.equal((await available(db)).reserved,2);
});
