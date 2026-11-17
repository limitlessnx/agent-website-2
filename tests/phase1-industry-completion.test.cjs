/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test');const assert=require('node:assert/strict');const load=require('./helpers/load-typescript.cjs');
function inventory(error={code:'PGRST202'}){
 const calls=[];const tables={hotel_room_types:[{id:'a'},{id:'b'}],hotel_rooms:[{id:'1',room_type_id:'a',active:true},{id:'2',room_type_id:'b',active:true}],hotel_catalog_items:[{id:'3',room_type_id:'a',kind:'room',status:'published'},{id:'4',room_type_id:null,kind:'service',status:'draft'}]};
 const admin={rpc:async()=>({data:null,error}),from(table){let tenant;const q={select(){return q},eq(key,value){assert.equal(key,'organization_id');tenant=value;return q},order(){return q},range(a,b){assert.equal(tenant,'tenant-b');calls.push(table);return Promise.resolve({data:tables[table].slice(a,b+1),error:null})}};return q}};
 const api=load('lib/hotel-inventory-readiness.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}});return{api,admin,calls};
}
test('missing hotel RPC falls back to tenant-scoped inventory and excludes drafts',async()=>{const f=inventory();const r=await f.api.getHotelInventoryReadiness('tenant-b');assert.equal(r.activeRoomTypes,2);assert.equal(r.publishedRoomTypes,1);assert.equal(r.unpublishedRoomTypes,1);assert.equal(r.publishedServices,0);assert.equal(f.calls.length,3)});
test('hotel inventory does not fall back on authorization errors',async()=>{const f=inventory({code:'42501'});await assert.rejects(f.api.getHotelInventoryReadiness('tenant-b'),/could not be loaded/);assert.equal(f.calls.length,0)});
test('Photography classification preserves Xposure and rejects unrelated or suspended tenants',()=>{const api=load('lib/xposure-tenant-authorization.ts',{'@/lib/industryExperience':load('lib/industryExperience.ts'),'next/server':{NextResponse:{}},'@/lib/admin-auth':{},'@/lib/client-auth':{},'@/lib/admin-organization-scope':{},'@/lib/portal-access':{},'@/lib/supabase-server-rest':{}});for(const industry of ['Photography','photography-studio','Photography Studio'])assert.equal(api.isPhotographyOrganization({slug:'new-studio',status:'active',metadata:{industry}}),true);assert.equal(api.isPhotographyOrganization({slug:'xposure',status:'active'}),true);assert.equal(api.isPhotographyOrganization({slug:'other',status:'active',metadata:{industry:'Hotel'}}),false);assert.equal(api.isPhotographyOrganization({slug:'xposure',status:'suspended'}),false)});

test('industry labels and machine slugs select the same operational workspace',()=>{const {getIndustryExperience}=load('lib/industryExperience.ts');for(const value of ['Real Estate','real_estate','real-estate'])assert.equal(getIndustryExperience(value).slug,'real-estate');for(const value of ['Photography','Photography Studio','photography-studio'])assert.equal(getIndustryExperience(value).slug,'photography-studio');for(const value of ['Hotel','hotels','Hospitality'])assert.equal(getIndustryExperience(value).slug,'hotels');assert.equal(getIndustryExperience('unknown').slug,'general')});
test('starter registration is idempotent and preserves existing catalog configuration',async()=>{const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const db=new PGlite();try{await db.exec(`create table organization_templates(slug text unique,name text,industry text,description text,status text,modules jsonb,agents jsonb,workflows jsonb,knowledge_structure jsonb,integration_requirements jsonb,metadata jsonb);insert into organization_templates(slug,name,industry) values('real-estate-ai-suite','Existing custom name','Real Estate');`);const sql=fs.readFileSync('docs/sprint-1-production-tests/industry-template-registration.sql','utf8');await db.exec(sql);await db.exec(sql);const rows=(await db.query('select * from organization_templates order by slug')).rows;assert.equal(rows.length,3);assert.equal(rows.find(x=>x.slug==='real-estate-ai-suite').name,'Existing custom name');for(const row of rows.filter(x=>x.metadata)){assert.equal(row.metadata.customer_content_included,false);assert.equal(row.metadata.activation_required,true);assert.ok(row.agents.length>0);assert.ok(row.workflows.length>0)}}finally{await db.close()}});

test('Photography member authorization uses the authenticated tenant and enforces permissions',async()=>{
 for(const permitted of [true,false]){
  const queries=[];const permissions=[];
  const api=load('lib/xposure-tenant-authorization.ts',{
   '@/lib/industryExperience':load('lib/industryExperience.ts'),
   'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},
   '@/lib/admin-auth':{getAdminSession:async()=>{throw Error('must not fall through to admin')}},
   '@/lib/client-auth':{getClientSession:async()=>({organizationId:'studio-b',userId:'owner-b'})},
   '@/lib/admin-organization-scope':{},
   '@/lib/portal-access':{requirePortalPermission:async(session,keys)=>{permissions.push([session.organizationId,...keys]);if(!permitted)throw Error('Permission denied')}},
   '@/lib/supabase-server-rest':{supabaseServerRequest:async query=>{queries.push(query);return[{id:'studio-b',slug:'new-studio',status:'active',metadata:{industry:'Photography'}}]}}
  });
  const result=await api.authorizeXposureTenantAccess('systems.manage');assert.equal(result.ok,permitted);assert.match(queries[0],/organizations\?id=eq.studio-b&/);assert.equal(permissions[0].join(','),'studio-b,systems.manage');if(permitted)assert.equal(result.organizationId,'studio-b');else assert.equal(result.response.status,403);
 }
});
test('Photography platform admin cannot use platform scope or an unrelated tenant',async()=>{
 for(const kind of ['platform','tenant']){
  let reads=0;const api=load('lib/xposure-tenant-authorization.ts',{
   '@/lib/industryExperience':load('lib/industryExperience.ts'),'next/server':{NextResponse:{json:(body,options)=>({body,...options})}},
   '@/lib/admin-auth':{getAdminSession:async()=>({})},'@/lib/client-auth':{getClientSession:async()=>null},
   '@/lib/admin-organization-scope':{resolveAdminOrganizationScope:async()=>({kind,status:'active',organizationId:'hotel-b',organizationSlug:'xposure'})},
   '@/lib/portal-access':{},'@/lib/supabase-server-rest':{supabaseServerRequest:async()=>{reads++;return[{id:'hotel-b',slug:'hotel',status:'active',metadata:{industry:'Hotel'}}]}}
  });const result=await api.authorizeXposureTenantAccess('systems.manage');assert.equal(result.ok,false);assert.equal(result.response.status,403);assert.equal(reads,kind==='tenant'?1:0);
 }
});

test('hotel fallback reads beyond the PostgREST page limit without losing tenant scope',async()=>{
 const pages=[];const rooms=Array.from({length:1001},(_,i)=>({id:String(i),room_type_id:'type-b',active:true}));
 const admin={rpc:async()=>({error:{code:'PGRST202'}}),from(table){let tenant;const q={select(){return q},eq(key,value){assert.equal(key,'organization_id');tenant=value;return q},order(){return q},range(start,end){assert.equal(tenant,'tenant-b');pages.push([table,start]);const data=table==='hotel_rooms'?rooms:table==='hotel_room_types'?[{id:'type-b'}]:[];return Promise.resolve({data:data.slice(start,end+1),error:null})}};return q}};
 const api=load('lib/hotel-inventory-readiness.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin}});const result=await api.getHotelInventoryReadiness('tenant-b');assert.equal(result.activeRooms,1001);assert.equal(result.unpublishedRoomTypes,1);assert.ok(pages.some(([table,start])=>table==='hotel_rooms'&&start===1000));
});
