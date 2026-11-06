import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
const org='00000000-0000-4000-8000-000000000001', approval='00000000-0000-4000-8000-000000000002';
const args={organization_id:org,agent_id:org,customer_id:org,channel:'whatsapp',message:'Approved text'};
async function fixture(t) {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table organizations(id uuid primary key); insert into organizations values ('${org}');`);
  await db.exec(readFileSync('supabase/migrations/20261106161658_leo_crm_trigger_executions.sql','utf8'));
  await db.query(`insert into leo_crm_approvals(id,organization_id,principal,session_id,channel,action_digest,token_digest,expires_at)
    values($1,$2,'user:one','session','chat','digest','token',now()+interval '5 minutes')`,[approval,org]);
  return db;
}
async function accept(db, overrides={}) {
  const p={id:approval,token:'token',org,principal:'user:one',session:'session',channel:'chat',digest:'digest',args,identity:{scope:'tenant'},...overrides};
  const {rows}=await db.query('select accept_leo_crm_execution($1,$2,$3,$4,$5,$6,$7,$8,$9) as result',Object.values(p));
  return rows[0].result;
}
test('atomic approval consumption creates one durable execution and exact replay returns it after expiry',async t=>{
  const db=await fixture(t); const first=await accept(db);
  assert.equal(first.status,'pending_dispatch');
  await db.exec(`update leo_crm_approvals set expires_at=now()-interval '1 day'`);
  const repeated=await accept(db); assert.equal(repeated.id,first.id);
  assert.equal((await db.query('select * from leo_crm_executions')).rows.length,1);
  assert.equal((await db.query('select execution_id from leo_crm_approvals')).rows[0].execution_id,first.id);
});
test('approval rejects changed tenant, principal, session, channel, digest and token; no execution leaks',async t=>{
  const db=await fixture(t);
  for(const change of [{org:approval},{principal:'user:other'},{session:'other'},{channel:'voice'},{digest:'changed'},{token:'bad'}]) await assert.rejects(accept(db,change),/does not match/);
  assert.equal((await db.query('select * from leo_crm_executions')).rows.length,0);
  await db.exec(`update leo_crm_approvals set expires_at=now()-interval '1 second'`);
  await assert.rejects(accept(db),/expired/);
});
test('replay cannot replace action; failed insert rolls back approval consumption',async t=>{
  const db=await fixture(t);
  await assert.rejects(accept(db,{args:{...args,organization_id:approval}}),/tenant mismatch/);
  assert.equal((await db.query('select consumed_at from leo_crm_approvals')).rows[0].consumed_at,null);
  await accept(db);
  await assert.rejects(accept(db,{args:{...args,message:'Changed'}}),/arguments changed/);
});
test('browser roles cannot read, write, claim or consume internal execution evidence',async t=>{
  const db=await fixture(t);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from leo_crm_approvals'),/permission denied/);
    await assert.rejects(db.query('select * from leo_crm_executions'),/permission denied/);
    await assert.rejects(accept(db),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec('set role service_role');
  assert.equal((await accept(db)).status,'pending_dispatch');
});
test('compare-and-set permits one worker and completed requires provider receipt',async t=>{
  const db=await fixture(t); const row=await accept(db);
  const claim=()=>db.query(`update leo_crm_executions set status='processing' where id=$1 and status in ('queued','pending_dispatch') returning id`,[row.id]);
  const claimed=await Promise.all([claim(),claim()]);
  assert.equal(claimed.reduce((sum,x)=>sum+x.rows.length,0),1);
  await assert.rejects(db.query(`update leo_crm_executions set status='completed',result='{}' where id=$1`,[row.id]),/check constraint/);
  await db.query(`update leo_crm_executions set status='completed',result=$2 where id=$1`,[row.id,{delivery_status:'provider_accepted',providerMessageId:'receipt'}]);
});
