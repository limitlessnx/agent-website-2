import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const ca='20000000-0000-4000-8000-000000000001',cb='20000000-0000-4000-8000-000000000002';
const ta='30000000-0000-4000-8000-000000000001',tb='30000000-0000-4000-8000-000000000002',usd='30000000-0000-4000-8000-000000000003';
const ra='40000000-0000-4000-8000-000000000001',rb='40000000-0000-4000-8000-000000000002',ru='40000000-0000-4000-8000-000000000003';
const actor='50000000-0000-4000-8000-000000000001';
async function fixture(t){
 const db=new PGlite({extensions:{btree_gist}});t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role;
  create table organizations(id uuid primary key);
  create table crm_customers(id uuid primary key,organization_id uuid not null references organizations(id),unique(organization_id,id));
  create function has_organization_permission(uuid,text) returns boolean language sql stable as $$ select $1::text=current_setting('test.org',true) and current_setting('test.manager',true) in ('one','two') and (left($2,7)<>'billing' or current_setting('test.billing',true)='yes') $$;
  insert into organizations values('${a}'),('${b}');insert into crm_customers values('${ca}','${a}'),('${cb}','${b}');`);
 await db.exec(readFileSync('supabase/migrations/20261105045404_hotel_shared_communications.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261105064158_hotel_booking_workspace.sql','utf8'));
 await db.exec(`insert into hotel_guest_profiles(organization_id,customer_id,service_consent) values('${a}','${ca}','opted_in'),('${b}','${cb}','opted_in');
  insert into hotel_room_types(id,organization_id,name,capacity,nightly_rate_minor,currency) values('${ta}','${a}','Double',2,10000,'NGN'),('${tb}','${b}','Double',2,10000,'NGN'),('${usd}','${a}','Suite',4,20000,'USD');
  insert into hotel_rooms(id,organization_id,room_type_id,name) values('${ra}','${a}','${ta}','101'),('${rb}','${b}','${tb}','101'),('${ru}','${a}','${usd}','201');`);
 return db;
}
async function booking(db,values={}){
 const v={id:randomUUID(),room:ra,org:a,customer:ca,arrival:'2026-12-01',departure:'2026-12-03',status:'confirmed',guests:2,...values};
 return (await db.query(`insert into hotel_booking_enquiries(id,organization_id,customer_id,room_id,status,arrival_date,departure_date,guest_count,updated_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,[v.id,v.org,v.customer,v.room,v.status,v.arrival,v.departure,v.guests,actor])).rows[0];
}
async function payment(db,bookingId,values={}){
 const v={amount:5000,currency:'NGN',request:randomUUID(),...values};
 return (await db.query(`insert into hotel_offline_payments(organization_id,booking_id,customer_id,amount_minor,currency,method,recorded_by,request_id,request_fingerprint) values($1,$2,$3,$4,$5,'bank_transfer',$6,$7,'test') returning *`,[a,bookingId,ca,v.amount,v.currency,actor,v.request])).rows[0];
}
test('real migration blocks overlapping physical-room allocations and permits adjacent stays',async t=>{
 const db=await fixture(t);const first=await booking(db);
 assert.equal(first.currency,'NGN');assert.equal(Number(first.nightly_rate_minor),10000);
 await assert.rejects(booking(db,{arrival:'2026-12-02',departure:'2026-12-04'}),/already reserved/);
 await booking(db,{arrival:'2026-12-03',departure:'2026-12-04'});
 await booking(db,{room:ru});
 assert.equal((await db.query(`select available from hotel_room_availability($1,'2026-12-02','2026-12-03',1) where room_id=$2`,[a,ra])).rows[0].available,false);
 await db.query(`update hotel_booking_enquiries set status='cancelled' where id=$1`,[first.id]);
 assert.equal((await db.query(`select available from hotel_room_availability($1,'2026-12-01','2026-12-03',1) where room_id=$2`,[a,ra])).rows[0].available,true);
});
test('capacity, lifecycle, tenant foreign keys and inactive-room rules are enforced below the API',async t=>{
 const db=await fixture(t);
 await assert.rejects(booking(db,{guests:3}),/capacity/);
 await assert.rejects(booking(db,{room:rb}),/unavailable in this organization/);
 await assert.rejects(booking(db,{room:null}),/Choose a room/);
 await assert.rejects(booking(db,{arrival:'2026-12-03',departure:'2026-12-03'}),/1 and 365 nights/);
 const row=await booking(db);
 await assert.rejects(db.query(`update hotel_booking_enquiries set status='checked_out' where id=$1`,[row.id]),/transition/);
 await assert.rejects(db.query(`update hotel_rooms set active=false where id=$1`,[ra]),/active reservations/);
 await db.query(`update hotel_booking_enquiries set status='checked_in' where id=$1`,[row.id]);
 await db.query(`update hotel_booking_enquiries set status='checked_out' where id=$1`,[row.id]);
 await assert.rejects(db.query(`update hotel_booking_enquiries set departure_date='2026-12-04' where id=$1`,[row.id]),/Closed reservation/);
 await db.query(`update hotel_rooms set active=false where id=$1`,[ra]);
 await assert.rejects(booking(db),/inactive/);
});
test('stay amendments invalidate follow-ups and preserve audit history and optimistic revisions',async t=>{
 const db=await fixture(t);const row=await booking(db);
 await db.query(`insert into hotel_followups(organization_id,customer_id,booking_id,booking_revision,purpose,scheduled_at,request_id,message) values($1,$2,$3,1,'pre_arrival',now(),$4,'Unsent')`,[a,ca,row.id,randomUUID()]);
 await db.query(`update hotel_booking_enquiries set departure_date='2026-12-04' where id=$1 and revision=1`,[row.id]);
 assert.equal((await db.query('select status from hotel_followups')).rows[0].status,'cancelled');
 assert.equal((await db.query(`select revision from hotel_booking_enquiries where id=$1`,[row.id])).rows[0].revision,2);
 assert.equal((await db.query(`update hotel_booking_enquiries set notes='stale edit' where id=$1 and revision=1 returning id`,[row.id])).rows.length,0);
 assert.ok((await db.query(`select * from hotel_booking_events where booking_id=$1`,[row.id])).rows.length>=2);
});
test('offline records require manual verification and preserve corrections without collecting payment',async t=>{
 const db=await fixture(t);const row=await booking(db);const receipt=await payment(db,row.id);
 const totals=async()=>(await db.query(`select * from hotel_booking_payment_totals($1,$2)`,[a,[row.id]])).rows[0];
 assert.equal((await totals()).verified_minor,'0');assert.equal((await totals()).pending_minor,'5000');
 await assert.rejects(db.query(`update hotel_offline_payments set amount_minor=9000 where id=$1`,[receipt.id]),/immutable/);
 await assert.rejects(db.query(`update hotel_offline_payments set status='verified' where id=$1`,[receipt.id]),/verifying manager/);
 await db.query(`update hotel_offline_payments set status='verified',verified_by=$1,verified_at='2001-01-01',verification_note='Bank reference checked' where id=$2`,[actor,receipt.id]);
 assert.equal((await totals()).verified_minor,'5000');assert.equal((await totals()).pending_minor,'0');
 assert.ok(new Date((await db.query(`select verified_at from hotel_offline_payments where id=$1`,[receipt.id])).rows[0].verified_at).getUTCFullYear()>2001);
 await assert.rejects(db.query(`update hotel_offline_payments set status='verified',verified_by=$1 where id=$2`,[actor,receipt.id]),/transition/);
 await assert.rejects(db.query(`update hotel_offline_payments set status='voided',voided_by=$1 where id=$2`,[actor,receipt.id]),/reason/);
 await db.query(`update hotel_offline_payments set status='voided',voided_by=$1,void_reason='Duplicate record entered manually' where id=$2`,[actor,receipt.id]);
 assert.equal((await totals()).verified_minor,'0');
 assert.deepEqual((await db.query(`select review_history from hotel_offline_payments where id=$1`,[receipt.id])).rows[0].review_history.map(r=>r.note),['Bank reference checked','Duplicate record entered manually']);
 assert.deepEqual((await db.query(`select event_type from hotel_booking_events where booking_id=$1 and event_type like 'payment_%' order by created_at,id`,[row.id])).rows.map(r=>r.event_type).sort(),['payment_pending','payment_verified','payment_voided'].sort());
});
test('currency mismatches, replayed request IDs and unauthorized finance reads fail closed',async t=>{
 const db=await fixture(t);const row=await booking(db);const request=randomUUID();await payment(db,row.id,{request});
 await assert.rejects(payment(db,row.id,{request}),/unique/);
 await assert.rejects(payment(db,row.id,{currency:'USD'}),/currency/);
 await assert.rejects(db.query(`update hotel_booking_enquiries set room_id=$1,nightly_rate_minor=null where id=$2`,[ru,row.id]),/Resolve existing payment/);
 await db.exec(`set role authenticated;set test.org='${a}';set test.manager='one';set test.billing='no';`);
 assert.equal((await db.query('select * from hotel_offline_payments')).rows.length,0);
 assert.equal((await db.query('select * from hotel_rooms')).rows.length,2);
 await db.exec(`set test.billing='yes'`);assert.equal((await db.query('select * from hotel_offline_payments')).rows.length,1);
 await assert.rejects(db.exec(`insert into hotel_rooms(organization_id,room_type_id,name) values('${a}','${ta}','999')`),/permission denied/);
 await db.exec(`set test.org='${b}'`);assert.equal((await db.query('select * from hotel_offline_payments')).rows.length,0);
 await db.exec('reset role');
 for(const table of ['hotel_room_types','hotel_rooms','hotel_offline_payments','hotel_booking_events']) assert.equal((await db.query(`select relrowsecurity from pg_class where oid=$1::regclass`,[table])).rows[0].relrowsecurity,true);
 assert.equal((await db.query(`select has_function_privilege('anon','hotel_booking_payment_totals(uuid,uuid[])','execute') as permitted`)).rows[0].permitted,false);
});
