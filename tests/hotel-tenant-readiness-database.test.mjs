import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import load from './helpers/load-typescript.cjs';
const {HOTEL_SETUP_FIELDS}=load('lib/hotel-setup-contract.ts');
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',manager1=randomUUID(),manager2=randomUUID();
async function fixture(t){const db=new PGlite({extensions:{btree_gist}});t.after(()=>db.close());await db.exec(`create role anon;create role authenticated;create role service_role;create table organizations(id uuid primary key);create table crm_customers(id uuid primary key,organization_id uuid,full_name text,phone text,email text,unique(organization_id,id));create table client_onboarding_profiles(organization_id uuid,business_name text,business_email text,phone text,country text,timezone text,human_contact_name text,human_contact_email text);create function has_organization_permission(uuid,text) returns boolean language sql stable as $$select $1::text=current_setting('test.org',true)$$;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text);insert into organizations values('${a}'),('${b}');insert into client_onboarding_profiles(organization_id,business_name,timezone) values('${a}','Garden Hotel','Africa/Lagos'),('${b}','Harbour Hotel','Europe/London');`);for(const name of ['20261105045404_hotel_shared_communications.sql','20261105064158_hotel_booking_workspace.sql','20261105085441_hotel_catalog.sql','20261105121746_hotel_overview.sql','20261105125822_hotel_workspace_refinements.sql','20261105134815_hotel_setup_settings.sql','20261105163133_hotel_tenant_readiness.sql'])await db.exec(readFileSync('supabase/migrations/'+name,'utf8'));return db;}
const readiness=async(db,org)=>(await db.query('select hotel_tenant_inventory_readiness($1) value',[org])).rows[0].value;
async function roomType(db,org,name,currency,capacity){return(await db.query(`insert into hotel_room_types(organization_id,name,currency,capacity,nightly_rate_minor) values($1,$2,$3,$4,10000) returning id`,[org,name,currency,capacity])).rows[0].id;}
async function publish(db,org,type,description){const id=(await db.query(`insert into hotel_catalog_items(organization_id,kind,room_type_id,description,creation_hash,updated_by) values($1,'room',$2,$3,'fixture',$4) returning id`,[org,type,description,manager1])).rows[0].id;await db.query(`update hotel_catalog_items set status='published' where id=$1`,[id]);return id;}
function values(name,timezone,currency,policy){return{...Object.fromEntries(Object.keys(HOTEL_SETUP_FIELDS).map(key=>[key,''])),business_name:name,timezone,currency,cancellation_policy:policy};}
test('two hotels retain independent setup, currencies, policies, managers, catalog coverage and inventory',async t=>{
 const db=await fixture(t),typeA=await roomType(db,a,'Garden Double','NGN',2),typeB=await roomType(db,b,'Harbour Family','GBP',4);
 assert.deepEqual(await readiness(db,b),{roomTypes:1,activeRooms:0,activeRoomTypes:0,publishedRoomTypes:0,unpublishedRoomTypes:0,publishedServices:0});
 await db.query(`insert into hotel_rooms(organization_id,room_type_id,name) values($1,$2,'101')`,[a,typeA]);await publish(db,a,typeA,'Garden features only');
 assert.equal((await readiness(db,a)).publishedRoomTypes,1);assert.equal((await readiness(db,b)).publishedRoomTypes,0);
 await db.query('select hotel_save_settings($1,$2,0,$3::jsonb)',[a,manager1,JSON.stringify(values('Garden Hotel','Africa/Lagos','NGN','Garden cancellation terms'))]);
 assert.equal((await db.query('select count(*) n from hotel_settings where organization_id=$1',[b])).rows[0].n,0);
 assert.equal((await db.query('select business_name from client_onboarding_profiles where organization_id=$1',[b])).rows[0].business_name,'Harbour Hotel');
 await db.query('select hotel_save_settings($1,$2,0,$3::jsonb)',[b,manager2,JSON.stringify(values('Harbour Hotel','Europe/London','GBP','Harbour cancellation terms'))]);
 await db.query('select hotel_save_settings($1,$2,1,$3::jsonb)',[a,manager2,JSON.stringify(values('Garden Hotel','Africa/Lagos','NGN','Reviewed Garden terms'))]);
 const saved=(await db.query('select organization_id,"values",updated_by from hotel_settings order by organization_id')).rows;
 assert.equal(saved[0].values.currency,'NGN');assert.equal(saved[1].values.currency,'GBP');assert.equal(saved[1].values.cancellation_policy,'Harbour cancellation terms');assert.equal(saved[1].values.timezone,'Europe/London');
 await db.query(`insert into hotel_rooms(organization_id,room_type_id,name) values($1,$2,'Family 1')`,[b,typeB]);assert.equal((await readiness(db,b)).unpublishedRoomTypes,1);
 const entry=await publish(db,b,typeB,'Harbour features only');assert.equal((await readiness(db,b)).unpublishedRoomTypes,0);
 await db.query(`update hotel_catalog_items set status='draft' where id=$1`,[entry]);assert.equal((await readiness(db,b)).unpublishedRoomTypes,1);assert.equal((await readiness(db,a)).unpublishedRoomTypes,0);
 await assert.rejects(db.query(`insert into hotel_catalog_items(organization_id,kind,room_type_id,description,creation_hash,updated_by) values($1,'room',$2,'Foreign','foreign',$3)`,[b,typeA,manager2]),/foreign key/);
 await db.query(`insert into hotel_rooms(organization_id,room_type_id,name) select $1,$2,'Garden '||n from generate_series(1,1005)n`,[a,typeA]);assert.equal((await readiness(db,a)).activeRooms,1006);assert.equal((await readiness(db,b)).activeRooms,1);
 await db.exec(`set role authenticated;select set_config('test.org','${b}',false);`);const visible=await db.query('select organization_id,"values" from hotel_settings');assert.equal(visible.rows.length,1);assert.equal(visible.rows[0].values.business_name,'Harbour Hotel');await assert.rejects(readiness(db,a),/permission denied/);
 await db.exec('reset role;set role anon');await assert.rejects(readiness(db,a),/permission denied/);
});
