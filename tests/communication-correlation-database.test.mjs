import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import load from './helpers/load-typescript.cjs';

const source=readFileSync('supabase/migrations/20260927000230_c1_c5_unified_customer_conversation_timeline.sql','utf8');
const table=source.match(/create table if not exists public\.customer_timeline_events\s*\([\s\S]*?;/)[0];
const unique=source.match(/create unique index if not exists customer_timeline_source_uidx[\s\S]*?;/)[0];
const grantStart=source.indexOf('grant execute on function public.add_customer_timeline_event');
const rpc=source.slice(source.indexOf('create or replace function public.add_customer_timeline_event('),source.indexOf(';',grantStart)+1);
const org='10000000-0000-4000-8000-000000000001',foreign='10000000-0000-4000-8000-000000000002';
const customer='20000000-0000-4000-8000-000000000001',otherCustomer='20000000-0000-4000-8000-000000000002';
const correlation='30000000-0000-4000-8000-000000000001',conversation='40000000-0000-4000-8000-000000000001';
const sourceId='50000000-0000-4000-8000-000000000001';
async function fixture(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table organizations(id uuid primary key);
 create table crm_customers(id uuid primary key,organization_id uuid references organizations,unique(organization_id,id));
 create table crm_conversations(id uuid primary key,organization_id uuid references organizations,unique(organization_id,id));
 ${table}\n${unique}\n${rpc}
 insert into organizations values('${org}'),('${foreign}');
 insert into crm_customers values('${customer}','${org}'),('${otherCustomer}','${foreign}');
 insert into crm_conversations values('${conversation}','${foreign}');`);
 const args=['p_organization_id','p_customer_id','p_event_type','p_title','p_summary','p_channel','p_conversation_id','p_source_table','p_source_id','p_correlation_id','p_actor_type','p_actor_id','p_metadata','p_occurred_at'];
 const helper=load('lib/canonical-customer.ts',{'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,input)=>{
  assert.equal(name,'add_customer_timeline_event');
  try{const result=await db.query(`select public.add_customer_timeline_event(${args.map((_,i)=>'$'+(i+1)).join(',')}) id`,args.map(key=>input[key]));return {data:result.rows[0].id,error:null};}catch(error){return {data:null,error};}
 }})}});
 return {db,add:overrides=>helper.addCanonicalTimelineEvent({organizationId:org,customerId:customer,eventType:'communication.observed',title:'Synthetic evidence',sourceTable:'synthetic_receipt',sourceId,correlationId:correlation,...overrides})};
}
test('actual timeline SQL matches production body and stores correlation from the real helper',async t=>{
 const f=await fixture(t);assert.equal((await f.db.query("select md5(prosrc) body from pg_proc where proname='add_customer_timeline_event'")).rows[0].body,'b63486216effce2be535ee68e2d25ac5');
 await f.add();const row=(await f.db.query('select organization_id,customer_id,correlation_id from customer_timeline_events')).rows[0];assert.deepEqual(row,{organization_id:org,customer_id:customer,correlation_id:correlation});
});
test('source replay reuses one row and cannot replace its original correlation',async t=>{
 const f=await fixture(t);const id=await f.add();assert.equal(await f.add({correlationId:'30000000-0000-4000-8000-000000000002',summary:'Updated evidence'}),id);
 const rows=(await f.db.query('select correlation_id,summary from customer_timeline_events')).rows;assert.equal(rows.length,1);assert.equal(rows[0].correlation_id,correlation);assert.equal(rows[0].summary,'Updated evidence');
});
test('a shared trace ID does not merge tenants or confer access to a foreign customer/conversation',async t=>{
 const f=await fixture(t);await f.add();await f.add({organizationId:foreign,customerId:otherCustomer});
 assert.equal((await f.db.query('select count(*)::int n from customer_timeline_events')).rows[0].n,2);
 await assert.rejects(f.add({sourceId:null,customerId:otherCustomer}),/foreign key/);
 await assert.rejects(f.add({sourceId:null,conversationId:conversation}),/foreign key/);
 assert.equal((await f.db.query('select count(*)::int n from customer_timeline_events')).rows[0].n,2);
});
test('browser roles cannot execute the privileged timeline RPC; service execution retains existing grants',async t=>{
 const f=await fixture(t);
 for(const role of ['anon','authenticated']){await f.db.exec('set role '+role);await assert.rejects(f.add(),/permission denied/);await f.db.exec('reset role');}
 await f.db.exec('set role service_role');await f.add();await f.db.exec('reset role');
 assert.equal((await f.db.query('select count(*)::int n from customer_timeline_events')).rows[0].n,1);
});
test('legacy null traces are not silently backfilled by replay or inferred from metadata',async t=>{
 const f=await fixture(t);const id=await f.add({correlationId:null,metadata:{correlation_id:correlation}});assert.equal(await f.add(),id);
 assert.equal((await f.db.query('select correlation_id from customer_timeline_events')).rows[0].correlation_id,null);
});
