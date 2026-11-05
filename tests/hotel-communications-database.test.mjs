import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
const c='00000000-0000-4000-8000-000000000003', d='00000000-0000-4000-8000-000000000004';
async function fixture(t) {
  const db=new PGlite(); t.after(()=>db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table organizations(id uuid primary key);
    create table crm_customers(id uuid primary key, organization_id uuid not null references organizations(id), unique(organization_id,id));
    create function has_organization_permission(uuid,text) returns boolean language sql stable as $$ select $1::text=current_setting('test.organization',true) and current_setting('test.manager',true) in ('manager-1','manager-2') $$;
    insert into organizations values ('${a}'),('${b}');
    insert into crm_customers values ('${c}','${a}'),('${d}','${b}');`);
  await db.exec(readFileSync('supabase/migrations/20261105045404_hotel_shared_communications.sql','utf8'));
  await db.exec(`insert into hotel_guest_profiles(organization_id,customer_id) values ('${a}','${c}'),('${b}','${d}');`);
  return db;
}
test('migration enforces tenant/customer foreign keys and multiple authorized managers through RLS',async t=>{
  const db=await fixture(t);
  await assert.rejects(db.exec(`insert into hotel_guest_profiles(organization_id,customer_id) values ('${a}','${d}')`),/foreign key/);
  for(const manager of ['manager-1','manager-2']) {
    await db.exec(`set role authenticated; set test.organization='${a}'; set test.manager='${manager}';`);
    const {rows}=await db.query('select * from hotel_guest_profiles');
    assert.equal(rows.length,1); assert.equal(rows[0].organization_id,a);
    await assert.rejects(db.exec(`update hotel_guest_profiles set opted_out=true`),/permission denied/);
    await db.exec('reset role');
  }
  await db.exec(`set role authenticated; set test.manager='revoked';`);
  assert.equal((await db.query('select * from hotel_guest_profiles')).rows.length,0);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select * from hotel_guest_profiles'),/permission denied/);
});
test('booking updates atomically cancel pending and processing reminders; stale enrollment is rejected',async t=>{
  const db=await fixture(t);
  const {rows:[booking]}=await db.query(`insert into hotel_booking_enquiries(organization_id,customer_id) values ('${a}','${c}') returning id`);
  for(const status of ['pending','processing']) await db.exec(`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message,status) values ('${a}','${c}','${booking.id}',1,'booking_recovery',now(),gen_random_uuid(),'Hello','${status}')`);
  await db.exec(`update hotel_booking_enquiries set status='confirmed' where id='${booking.id}'`);
  const {rows}=await db.query('select status,stop_reason from hotel_followups');
  assert.ok(rows.every(row=>row.status==='cancelled' && row.stop_reason==='booking_changed'));
  await assert.rejects(db.exec(`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message) values ('${a}','${c}','${booking.id}',1,'booking_recovery',now(),gen_random_uuid(),'Hello')`),/Booking changed/);
  await assert.rejects(db.exec(`update hotel_booking_enquiries set customer_id='${d}' where id='${booking.id}'`),/immutable/);
  assert.equal((await db.query(`select revision from hotel_booking_enquiries`)).rows[0].revision,2);
});
test('enrollment is idempotent and date changes suppress pre-arrival reminders',async t=>{
  const db=await fixture(t);
  const {rows:[booking]}=await db.query(`insert into hotel_booking_enquiries(organization_id,customer_id,status) values ('${a}','${c}','confirmed') returning id`);
  const insert=`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message) values ('${a}','${c}','${booking.id}',1,'pre_arrival',now(),'${d}','Hello')`;
  await db.exec(insert); await assert.rejects(db.exec(insert),/unique/);
  await db.exec(`update hotel_booking_enquiries set arrival_date='2026-12-01' where id='${booking.id}'`);
  assert.equal((await db.query('select status from hotel_followups')).rows[0].status,'cancelled');
});
test('guest opt-out cancels queued follow-ups and cross-tenant booking links are rejected',async t=>{
  const db=await fixture(t);
  const {rows:[booking]}=await db.query(`insert into hotel_booking_enquiries(organization_id,customer_id) values ('${a}','${c}') returning id`);
  await db.exec(`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message) values ('${a}','${c}','${booking.id}',1,'booking_recovery',now(),gen_random_uuid(),'Hello')`);
  await db.exec(`update hotel_guest_profiles set opted_out=true where organization_id='${a}'`);
  assert.equal((await db.query('select status from hotel_followups')).rows[0].status,'cancelled');
  await assert.rejects(db.exec(`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message) values ('${b}','${d}','${booking.id}',1,'booking_recovery',now(),gen_random_uuid(),'Hello')`),/Booking changed|foreign key/);
});
