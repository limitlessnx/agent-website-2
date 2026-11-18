import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {migration} from './helpers/elevenlabs-receipt-database.mjs';
import {fixture,apply,parameters,insertReceipt,org,other,schemaSQL,voiceReleaseSQL} from './helpers/elevenlabs-receipt-database.mjs';
const count=async(db,table)=>(await db.query(`select count(*)::integer n from ${table}`)).rows[0].n;
const balance=async(db)=>(await db.query('select balance from flux_credit_wallets where organization_id=$1',[org])).rows[0].balance;

test('failed/legacy receipt recovers and completed replay never settles twice',async t=>{
 const db=await fixture(t);await insertReceipt(db);assert.equal((await apply(db)).duplicate,false);
 assert.equal(await balance(db),958);assert.equal(await count(db,'flux_credit_ledger'),1);
 assert.equal((await db.query('select processing_error from elevenlabs_voice_webhook_events')).rows[0].processing_error,null);
 await db.query(`update flux_credit_wallets set status='paused',balance=0 where organization_id=$1`,[org]);
 assert.equal((await apply(db,parameters({credits:0,plan:null}))).duplicate,true);assert.equal(await count(db,'flux_credit_ledger'),1);
});
test('failure after credit recording rolls back records, handoff, debit and completion together',async t=>{
 const db=await fixture(t);const args=parameters({transfer:true});await insertReceipt(db,args);
 await db.exec(`create function fail_completion() returns trigger language plpgsql as $$begin if new.processed_at is not null and current_setting('test.fail_completion',true)='yes' then raise exception 'synthetic completion outage';end if;return new;end$$;
 create trigger test_completion before update on elevenlabs_voice_webhook_events for each row execute function fail_completion();set test.fail_completion='yes';`);
 await assert.rejects(apply(db,args),/synthetic completion outage/);
 for(const table of ['agent_conversations','elevenlabs_voice_calls','flux_credit_ledger','handoff_requests'])assert.equal(await count(db,table),0);
 assert.equal(await balance(db),1000);assert.equal((await db.query('select processed_at from elevenlabs_voice_webhook_events')).rows[0].processed_at,null);
 await db.exec(`set test.fail_completion='no'`);await apply(db,args);assert.equal(await balance(db),958);assert.equal(await count(db,'handoff_requests'),1);
});
test('different receipt keys for one call retain one debit and handoff; later normal evidence cannot clear failed transfer',async t=>{
 const db=await fixture(t);const first=parameters({transfer:true});await insertReceipt(db,first);await apply(db,first);
 const next=parameters({key:'event-two',credits:0,plan:null});await insertReceipt(db,next);const r=await apply(db,next);
 assert.equal(r.call_status,'transfer_failed');assert.equal(await count(db,'flux_credit_ledger'),1);assert.equal(await count(db,'handoff_requests'),1);
 assert.equal((await db.query('select ai_paused from agent_conversations')).rows[0].ai_paused,true);
 assert.equal(await count(db,'elevenlabs_voice_webhook_events'),2);
});
test('a later sparse receipt cannot erase recorded transcript, summary or analysis',async t=>{
 const db=await fixture(t);const first=parameters({projection:{transcript:'Recorded transcript',summary:'Recorded summary',analysis:{verified:true}}});await insertReceipt(db,first);await apply(db,first);
 const sparse=parameters({key:'sparse',credits:0,plan:null});await insertReceipt(db,sparse);await apply(db,sparse);
 const row=(await db.query('select transcript,summary,analysis from elevenlabs_voice_calls')).rows[0];
 assert.equal(row.transcript,'Recorded transcript');assert.equal(row.summary,'Recorded summary');assert.deepEqual(row.analysis,{verified:true});assert.equal(await count(db,'flux_credit_ledger'),1);
});
test('changed receipt content, provider mapping and foreign organization hints fail without business writes',async t=>{
 const db=await fixture(t);await insertReceipt(db);
 const changed=parameters({payload:{extra:'different'}});await assert.rejects(apply(db,changed),/identity changed/);
 await db.query(`update agents set configuration='{}' where id=$1`,[parameters()[3]]);await assert.rejects(apply(db),/mapping changed/);
 await db.query(`update agents set configuration='{"elevenlabs_agent_id":"provider-agent"}' where id=$1`,[parameters()[3]]);
 const foreignHint=parameters({key:'foreign-hint',payload:{organization_id:other}});await insertReceipt(db,foreignHint);await assert.rejects(apply(db,foreignHint),/hint conflicts/);
 assert.equal(await balance(db),1000);assert.equal(await count(db,'elevenlabs_voice_calls'),0);
});
test('a foreign existing provider conversation cannot be rebound to another tenant',async t=>{
 const db=await fixture(t);await insertReceipt(db);
 await db.query(`insert into elevenlabs_voice_calls(organization_id,agent_id,conversation_id) values($1,$2,'call-one')`,[other,'20000000-0000-4000-8000-000000000002']);
 await assert.rejects(apply(db),/already belongs to another organization/);assert.equal(await count(db,'agent_conversations'),0);assert.equal(await balance(db),1000);
});
test('plan change or missing quote cannot bypass existing commercial checks',async t=>{
 const db=await fixture(t);await insertReceipt(db);await db.query(`update flux_credit_wallets set plan_code='basic' where organization_id=$1`,[org]);
 await assert.rejects(apply(db),/Wallet plan changed/);assert.equal(await count(db,'elevenlabs_voice_calls'),0);
 await assert.rejects(apply(db,parameters({credits:0,plan:null})),/verified voice usage quote/);assert.equal(await balance(db),1000);
});
test('zero-duration evidence persists without a debit; later measured duration settles once',async t=>{
 const db=await fixture(t);const zero=parameters({credits:0,plan:null,projection:{duration_seconds:0}});await insertReceipt(db,zero);await apply(db,zero);assert.equal(await count(db,'flux_credit_ledger'),0);
 const measured=parameters({key:'measured'});await insertReceipt(db,measured);await apply(db,measured);assert.equal(await count(db,'flux_credit_ledger'),1);
});
test('invoker RPC is service-only and preserves client RLS boundaries',async t=>{
 const db=await fixture(t);await insertReceipt(db);
 for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(apply(db),/permission denied/);await db.exec('reset role');}
 // Even a permissive legacy membership predicate cannot expose raw payloads.
 await db.exec('create or replace function is_organization_member(uuid) returns boolean language sql stable as $$select true$$;');
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  for(const table of ['elevenlabs_voice_calls','elevenlabs_voice_webhook_events'])await assert.rejects(count(db,table),/permission denied/);
  await db.exec('reset role');
 }
 await db.exec('set role service_role');assert.equal((await apply(db)).ok,true);await db.exec('reset role');
 for(const table of ['elevenlabs_voice_calls','elevenlabs_voice_webhook_events']){
  for(const privilege of ['SELECT','INSERT','UPDATE'])assert.equal((await db.query(`select has_table_privilege('service_role',$1,$2) allowed`,[table,privilege])).rows[0].allowed,true);
  for(const privilege of ['DELETE','TRUNCATE','REFERENCES','TRIGGER'])assert.equal((await db.query(`select has_table_privilege('service_role',$1,$2) allowed`,[table,privilege])).rows[0].allowed,false);
 }
 assert.equal((await db.query(`select prosecdef from pg_proc where proname='apply_elevenlabs_voice_receipt'`)).rows[0].prosecdef,false);
});
test('recovery migration fails explicitly when the existing voice foundation is absent',async t=>{
 const db=await fixture(t);await db.exec('drop function apply_elevenlabs_voice_receipt(text,jsonb,uuid,uuid,text,text,jsonb,integer,text,numeric);drop table elevenlabs_voice_calls cascade;');
 await assert.rejects(db.exec(readFileSync('supabase/migrations/'+migration,'utf8')),/voice foundation/);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::integer n from pg_proc where proname='apply_elevenlabs_voice_receipt'")).rows[0].n,0);
});
test('paired foundation and recovery install atomically without an intermediate browser-access window',async t=>{
 const db=new PGlite();t.after(()=>db.close());await db.exec(schemaSQL({voice:false}));
 const bundle=voiceReleaseSQL();
 await assert.rejects(db.exec(bundle.replace(/commit;$/,'select 1/0;commit;')),/division by zero/);
 await db.exec('rollback');
 assert.equal((await db.query("select to_regclass('public.elevenlabs_voice_calls') present")).rows[0].present,null);
 await db.exec(bundle);
 for(const table of ['elevenlabs_voice_calls','elevenlabs_voice_webhook_events'])assert.equal((await db.query("select has_table_privilege('authenticated',$1,'SELECT') allowed",[table])).rows[0].allowed,false);
 await insertReceipt(db);await db.exec('set role service_role');assert.equal((await apply(db)).ok,true);await db.exec('reset role');
});
