import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const url=new URL(process.env.HOTEL_TEST_DATABASE_URL||'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname)&&url.pathname==='/hotel_test','This test may run only against the disposable localhost hotel_test database.');
const args=['-X','-At','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','-h',url.hostname,'-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d','hotel_test'];
function run(extra,application='hotel_workspace_test'){
 const child=spawn('psql',[...args,...extra],{env:{...process.env,PGPASSWORD:decodeURIComponent(url.password),PGAPPNAME:application}});
 let stdout='',stderr='';child.stdout.on('data',data=>stdout+=data);child.stderr.on('data',data=>stderr+=data);
 return new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',code=>resolve({code,stdout:stdout.trim(),stderr}));});
}
const sql=(query,application)=>run(['-c',query],application);
async function expectSuccess(result,label){const value=await result;assert.equal(value.code,0,`${label}: ${value.stderr}`);return value.stdout;}
assert.equal(await expectSuccess(sql(`select count(*) from information_schema.tables where table_schema='public'`),'empty fixture database'),'0','Refusing to mutate a non-empty test database.');
for(const file of ['tests/fixtures/hotel-workspace-postgres.sql','supabase/migrations/20261105045404_hotel_shared_communications.sql','supabase/migrations/20261105064158_hotel_booking_workspace.sql','supabase/migrations/20261105085441_hotel_catalog.sql','supabase/migrations/20261105121746_hotel_overview.sql','supabase/migrations/20261105125822_hotel_workspace_refinements.sql'])await expectSuccess(run(['-1','-f',file]),'apply test schema');
const org=randomUUID(),customer=randomUUID(),type=randomUUID(),room=randomUUID();
await expectSuccess(sql(`insert into organizations values('${org}');insert into crm_customers(id,organization_id) values('${customer}','${org}');insert into hotel_guest_profiles(organization_id,customer_id) values('${org}','${customer}');insert into hotel_room_types(id,organization_id,name,capacity,nightly_rate_minor,currency) values('${type}','${org}','Double',2,10000,'NGN');insert into hotel_rooms(id,organization_id,room_type_id,name) values('${room}','${org}','${type}','101');`),'seed synthetic fixture');
function insert(start,end){return `insert into hotel_booking_enquiries(organization_id,customer_id,room_id,status,arrival_date,departure_date) values('${org}','${customer}','${room}','confirmed','${start}','${end}');`;}
async function overlapScenario(start,end,isolation){
 const holder=sql(`begin;${insert(start,end)}select pg_sleep(5);commit;`,'hotel_booking_holder');
 let locked=false;
 for(let attempt=0;attempt<30;attempt++){
  const state=await sql(`select count(*) from pg_stat_activity where application_name='hotel_booking_holder' and wait_event='PgSleep'`);
  if(state.stdout==='1'){locked=true;break;}await delay(100);
 }
 assert.ok(locked,'The first writer must hold its allocation before starting the contender.');
 const contender=sql(`begin isolation level ${isolation};select count(*) from hotel_booking_enquiries;${insert(start,end)}commit;`,'hotel_booking_contender');
 const [first,second]=await Promise.all([holder,contender]);
 assert.equal(first.code,0,first.stderr);assert.notEqual(second.code,0,'Two simultaneous confirmed allocations must never both commit.');
 assert.match(second.stderr,isolation==='repeatable read'?/23P01|40001/:/already reserved|23P01|40001/);
 assert.equal(await expectSuccess(sql(`select count(*) from hotel_booking_enquiries where room_id='${room}' and arrival_date='${start}' and status='confirmed'`),'committed allocation count'),'1');
 console.log(`PASS: concurrent ${isolation} allocation produced exactly one confirmed reservation`);
}
await overlapScenario('2026-12-01','2026-12-03','read committed');
await overlapScenario('2026-12-10','2026-12-12','repeatable read');
await expectSuccess(sql(insert('2026-12-03','2026-12-04')),'adjacent checkout-exclusive stay');
console.log('PASS: adjacent stay is permitted; no external provider or production database was used');

const concurrent=await Promise.all(Array.from({length:8},()=>sql(`insert into hotel_booking_enquiries(organization_id,customer_id,status) values('${org}','${customer}','enquiry');`)));for(const result of concurrent)assert.equal(result.code,0,result.stderr);assert.equal(await expectSuccess(sql(`select count(*)=count(distinct number) from hotel_booking_references where organization_id='${org}'`),'unique concurrent references'),'t');console.log('PASS: concurrent hotel enquiries receive distinct tenant references');
