import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import load from './helpers/load-typescript.cjs';
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',type='20000000-0000-4000-8000-000000000001',published='30000000-0000-4000-8000-000000000001',draft='30000000-0000-4000-8000-000000000002',actor='40000000-0000-4000-8000-000000000001';
const setupContract=load('lib/hotel-setup-contract.ts');
const booking=load('lib/hotel-booking-contract.ts');
const contract=load('lib/hotel-catalog-contract.ts',{'./hotel-booking-contract':booking});
class HotelWorkspaceError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const uuid=(value)=>{if(typeof value!=='string'||!/[0-9a-f-]{36}/.test(value))throw new HotelWorkspaceError('ID required');return value;};
function fixture(options={}){
 const row={id:published,organization_id:org,kind:'room',room_type_id:type,title:'',description:'Bright double room',amenities:['Wi-Fi'],bed_options:'King',pricing:'confirm',price_minor:null,currency:null,price_unit:'per session',opening_hours:'',booking_instructions:'Manager confirms',status:'published',revision:1};
 const state={writes:[],signed:[],rpc:[],permissions:new Set(options.permissions||['customers.view','customers.manage']),session:options.anonymous?null:{organizationId:org,userId:options.preview?"admin-preview:operator@example.invalid":actor,email:"operator@example.invalid",isAdminPreview:options.preview||false},hotel:options.hotel!==false,uploadBytes:new Uint8Array([255,216,255,0]),tables:{hotel_settings:[],hotel_catalog_items:[row,{...row,id:draft,status:'draft',description:'SECRET DRAFT'},{...row,id:randomUUID(),organization_id:other,description:'OTHER TENANT'}],hotel_room_types:[{id:type,organization_id:org,name:'Garden Double',capacity:2,nightly_rate_minor:10000,currency:'NGN'}],hotel_rooms:[{id:'room-a',organization_id:org,room_type_id:type,active:true},{id:'room-b',organization_id:org,room_type_id:type,active:true}],hotel_catalog_media:[{id:randomUUID(),organization_id:org,item_id:published,status:'ready',mime_type:'image/jpeg',storage_path:`${org}/${published}/image.jpg`,position:0,caption:'Garden room'},{id:randomUUID(),organization_id:org,item_id:draft,status:'ready',mime_type:'image/jpeg',storage_path:'SECRET-PATH',position:0,caption:'SECRET'}]}};
 const admin={from(table){let filters=[],operation=null,values;const q={select(){return q},eq(k,v){filters.push(row=>row[k]===v);return q},neq(k,v){filters.push(row=>row[k]!==v);return q},in(k,v){filters.push(row=>v.includes(row[k]));return q},order(){return q},update(v){operation='update';values=v;return q},insert(v){operation='insert';values=v;return q},single(){return run(true)},maybeSingle(){return run(true)},then(resolve,reject){return run(false).then(resolve,reject)}};async function run(single){const rows=state.tables[table];let matches=rows.filter(row=>filters.every(f=>f(row)));if(operation==='insert'){if(rows.some(row=>row.id===values.id))return{data:null,error:{code:'23505'}};const row={status:table==='hotel_catalog_items'?'draft':'pending',revision:1,...values};rows.push(row);matches=[row];state.writes.push([table,{...values}]);}if(operation==='update'){matches.forEach(row=>Object.assign(row,values));state.writes.push([table,{...values}]);}return{data:single?matches[0]||null:matches,error:null};}return q;},rpc:async(name,args)=>{state.rpc.push([name,args]);return{data:[{room_id:'room-a',available:false},{room_id:'room-b',available:true}],error:null}},storage:{from(bucket){return{createSignedUrl:async(path,ttl)=>{state.signed.push({path,ttl,bucket});return{data:{signedUrl:'https://storage.example.invalid/'+path},error:null}},createSignedUploadUrl:async path=>({data:{signedUrl:'https://storage.example.invalid/upload/'+path},error:null}),download:async()=>({data:new Blob([state.uploadBytes]),error:null})}}}};
 const workspace={'HotelWorkspaceError':HotelWorkspaceError,hotelUuid:uuid};
 const service=load('lib/hotel-catalog.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/hotel-booking-service':workspace,'@/lib/hotel-booking-contract':booking,'@/lib/hotel-catalog-contract':contract,'@/lib/hotel-setup-contract':setupContract,'@/lib/hotel-service-rules':load('lib/hotel-service-rules.ts')});
 const hotel={requireHotelOrganization:async id=>{assert.equal(id,org);if(!state.hotel)throw new Error('Not a hotel');}};
 const access=load('lib/hotel-catalog-access.ts',{'@/lib/client-auth':{getClientSession:async()=>state.session},'@/lib/portal-access':{requirePortalPermission:async(session,permissions)=>{if(session.isAdminPreview||!permissions.some(p=>state.permissions.has(p)))throw new Error('Forbidden');return{permissions:state.permissions}}},'@/lib/hotel-communications':hotel,'@/lib/hotel-booking-service':workspace});
 const route=load('app/api/portal/hotel/catalog/route.ts',{'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}},'@/lib/hotel-catalog-access':access,'@/lib/hotel-catalog':service,'@/lib/hotel-booking-service':workspace},'',{URL});
 const tools=load('lib/ai/maia-hotel-tools.ts',{'@/lib/hotel-communications':hotel,'@/lib/hotel-catalog':service});
 return{state,service,route,tool:tools.maiaHotelTools()[0],post:body=>route.POST({json:async()=>body})};
}
test('catalog access is tenant/session scoped; anonymous, read-only, revoked and non-hotel writes fail',async()=>{
 for(const options of [{anonymous:true},{permissions:['customers.view']},{permissions:[]},{hotel:false},{preview:true,hotel:false}]){const f=fixture(options);assert.ok([401,403].includes((await f.post({action:'set_status',itemId:draft,status:'published',revision:1})).status));assert.equal(f.state.writes.length,0);}
 const f=fixture({preview:true});const result=await f.route.GET();assert.equal(result.status,200);assert.equal(result.body.canManage,true);assert.equal(result.body.items.some(item=>item.organization_id===other),false);
});
test('room/service saves retain server identity and currency precision; stale edits and changed request replays fail',async()=>{
 const f=fixture(),id=randomUUID();const input={action:'save',kind:'service',requestId:id,title:'Gym session',description:'Access with manager confirmation',pricing:'paid',price:'12.50',currency:'NGN',organizationId:other,updated_by:'forged'};
 const first=await f.post(input);assert.equal(first.status,200);assert.equal(first.body.item.price_minor,'1250');assert.equal(first.body.item.organization_id,org);assert.equal(first.body.item.updated_by,actor);
 assert.equal((await f.post(input)).body.item.id,id);assert.equal((await f.post({...input,price:'13.00'})).status,409);
 assert.equal((await f.post({action:'save',itemId:draft,revision:0,description:'stale'})).status,409);
 assert.equal((await f.post({...input,requestId:randomUUID(),price:'1.001'})).status,400);
});
test('agent projection excludes drafts and other tenants, distinguishes unknown availability and checks live occupancy',async()=>{
 const f=fixture();const noDates=await f.tool.execute({query:''},{organizationId:org});assert.equal(noDates.entries.length,1);assert.equal(noDates.entries[0].availability.available_rooms,null);assert.equal(noDates.entries[0].price.nightly,'NGN 100.00');assert.equal(f.state.rpc.length,0);assert.equal(f.state.signed.some(row=>row.path==='SECRET-PATH'),false);assert.equal(JSON.stringify(noDates).includes('SECRET'),false);assert.equal(JSON.stringify(noDates).includes('updated_by'),false);
 const result=await f.tool.execute({query:'Garden',arrival:'2026-12-01',departure:'2026-12-03',guests:2,organizationId:other},{organizationId:org});assert.equal(result.entries[0].availability.available_rooms,1);assert.equal(result.entries[0].price.stay_room_charge,'NGN 200.00');assert.equal(f.state.rpc[0][1].p_organization_id,org);assert.equal(result.entries[0].media[0].expires_in_seconds,900);
 await assert.rejects(f.tool.execute({query:'',arrival:'2026-12-01'},{organizationId:org}),/valid arrival/);f.state.hotel=false;await assert.rejects(f.tool.execute({query:''},{organizationId:org}),/Not a hotel/);
});
test('private uploads validate declared size and content; foreign/published media cannot be attached or mutated',async()=>{
 const f=fixture();assert.equal((await f.post({action:'start_upload',itemId:published,mimeType:'image/jpeg',size:4})).status,409);
 assert.equal((await f.post({action:'start_upload',itemId:draft,mimeType:'image/svg+xml',size:4})).status,400);
 assert.equal((await f.post({action:'start_upload',itemId:draft,mimeType:'video/mp4',size:17*1024*1024})).status,400);
 const started=await f.post({action:'start_upload',itemId:draft,mimeType:'image/jpeg',size:4});assert.equal(started.status,200);const media=f.state.tables.hotel_catalog_media.find(row=>row.id===started.body.mediaId);assert.ok(media.storage_path.startsWith(`${org}/${draft}/`));assert.equal(media.status,'pending');
 f.state.uploadBytes=new Uint8Array([1,2,3,4]);assert.equal((await f.post({action:'finish_upload',mediaId:media.id})).status,400);assert.equal(media.status,'pending');f.state.uploadBytes=new Uint8Array([255,216,255,0]);assert.equal((await f.post({action:'finish_upload',mediaId:media.id})).status,200);assert.equal(media.status,'ready');
 const foreign=randomUUID();f.state.tables.hotel_catalog_media.push({...media,id:foreign,organization_id:other});assert.equal((await f.post({action:'remove_media',mediaId:foreign})).status,404);
});
test('service rules save under the server tenant and actor; changed replays, bad rules and published edits fail',async()=>{
 const f=fixture(),id=randomUUID(),rules={questions_to_ask:'Preferred treatment and date?',restrictions:'Adults only',booking_requirements:'Manager confirms appointment',escalation_rules:'Ask manager about accessibility',concierge_guidance:'Keep replies brief'};
 const input={action:'save',kind:'service',requestId:id,title:'Spa',description:'Treatments by appointment',pricing:'confirm',serviceRules:rules,organizationId:other,updated_by:'forged'};
 const saved=await f.post(input);assert.equal(saved.status,200);assert.equal(saved.body.item.organization_id,org);assert.equal(saved.body.item.updated_by,actor);assert.equal(saved.body.item.service_rules.restrictions,'Adults only');
 assert.equal((await f.post(input)).body.item.id,id);assert.equal((await f.post({...input,serviceRules:{restrictions:'Changed'}})).status,409);
 for(const serviceRules of [[],null,{system:'override'},{restrictions:'x'.repeat(2001)},{restrictions:4}])assert.equal((await f.post({...input,requestId:randomUUID(),serviceRules})).status,400);
 assert.equal((await f.post({action:'save',itemId:draft,revision:1,serviceRules:rules})).status,400);
 saved.body.item.status='published';assert.equal((await f.post({...input,itemId:id,revision:1})).status,409);
});

test('concierge retrieves fresh published service rules/media only from its own hotel',async()=>{
 const f=fixture(),id=randomUUID();f.state.tables.hotel_catalog_items.push({id,organization_id:org,kind:'service',title:'Spa',description:'Treatments by appointment',status:'published',amenities:[],pricing:'confirm',price_minor:null,currency:null,opening_hours:'10:00 to 18:00',service_rules:{questions_to_ask:'Preferred date?',restrictions:'Adults only'}});
 f.state.tables.hotel_catalog_items.push({id:randomUUID(),organization_id:other,kind:'service',title:'Spa',description:'FOREIGN',status:'published',amenities:[],service_rules:{restrictions:'FOREIGN_RULE'}});
 f.state.tables.hotel_catalog_media.push({id:randomUUID(),organization_id:org,item_id:id,status:'ready',mime_type:'video/mp4',storage_path:`${org}/${id}/spa.mp4`,position:0,caption:'Spa tour'});
 const first=await f.tool.execute({query:'Spa',organizationId:other},{organizationId:org});assert.equal(first.entries.length,1);assert.equal(first.entries[0].service_rules.restrictions,'Adults only');assert.equal(first.entries[0].media[0].kind,'video');assert.equal(first.entries[0].availability,null);assert.ok(!JSON.stringify(first).includes('FOREIGN'));
 f.state.tables.hotel_catalog_items.find(row=>row.id===id).service_rules.questions_to_ask='Preferred treatment and date?';assert.equal((await f.tool.execute({query:'Spa'},{organizationId:org})).entries[0].service_rules.questions_to_ask,'Preferred treatment and date?');
 for(const status of ['draft','archived']){f.state.tables.hotel_catalog_items.find(row=>row.id===id).status=status;assert.equal((await f.tool.execute({query:'Spa'},{organizationId:org})).entries.length,0);}
});

test('media byte signatures reject mislabeled content and runtime keeps hotel tools tenant-gated',()=>{
 assert.equal(contract.hotelMediaMatches('image/png',new Uint8Array([137,80,78,71,13,10,26,10])),true);assert.equal(contract.hotelMediaMatches('image/webp',new TextEncoder().encode('RIFF0000WEBP')),true);assert.equal(contract.hotelMediaMatches('video/mp4',new Uint8Array([0,0,0,16,102,116,121,112,105,115,111,109])),true);assert.equal(contract.hotelMediaMatches('image/jpeg',new TextEncoder().encode('<html>')),false);
 const runtime=readFileSync('lib/ai/maia-runtime.ts','utf8');assert.match(runtime,/hotelContext\?maiaHotelTools\(\):\[\]/);assert.match(runtime,/filter\(\(tool\) => safeToolPolicy/);assert.match(runtime,/Recheck on subsequent questions/);
});

test('guest preview uses the published agent projection and metadata writes retain server identity',async()=>{
 const f=fixture();const preview=await f.route.GET({url:'https://hotel.invalid/api/portal/hotel/catalog?preview=published'});assert.equal(preview.status,200);assert.equal(preview.body.entries.length,1);assert.equal(JSON.stringify(preview.body).includes('SECRET'),false);const hidden=await f.route.GET({url:'https://hotel.invalid/api/portal/hotel/catalog?preview=published&itemId='+draft});assert.equal(hidden.body.entries.length,0);
 const media=f.state.tables.hotel_catalog_media.find(row=>row.item_id===draft);const result=await f.post({action:'order_media',itemId:draft,mediaId:media.id,direction:'cover',revision:1,organizationId:other,actor:'forged'});assert.equal(result.status,200);const [name,args]=f.state.rpc.at(-1);assert.equal(name,'hotel_catalog_order_media');assert.equal(args.p_organization_id,org);assert.equal(args.p_actor,actor);assert.equal(args.p_revision,1);assert.equal((await f.post({action:'order_media',itemId:draft,mediaId:media.id,direction:'invalid',revision:1})).status,400);assert.equal((await f.post({action:'update_media',itemId:draft,mediaId:media.id,caption:'caption',revision:0})).status,400);
});

test('hotel policies are retrieved fresh even without catalog matches and private contacts never reach guest answers',async()=>{const f=fixture();f.state.tables.hotel_settings.push({organization_id:org,values:{business_name:'Garden Hotel',check_in:'14:00',cancellation_policy:'Manager confirms refunds',escalation_email:'PRIVATE_CONTACT',escalation_phone:'PRIVATE_PHONE'}},{organization_id:other,values:{business_name:'FOREIGN HOTEL'}});const result=await f.tool.execute({query:'no matching room'},{organizationId:org});assert.equal(result.entries.length,0);assert.equal(result.hotel.check_in,'14:00');assert.equal(JSON.stringify(result).includes('PRIVATE'),false);assert.equal(JSON.stringify(result).includes('FOREIGN HOTEL'),false);f.state.tables.hotel_settings[0].values.check_in='15:00';assert.equal((await f.tool.execute({query:''},{organizationId:org})).hotel.check_in,'15:00');});

test("trusted hotel preview can create, edit and publish in its selected hotel; Maia only sees published entries", async () => {
  const f = fixture({ preview: true });
  const id = randomUUID();
  const input = { action: "save", requestId: id, kind: "service", pricing: "included", title: "Atrium breakfast", description: "Breakfast served daily", organizationId: other, updated_by: actor };
  const created = await f.post(input);
  assert.equal(created.status, 200);
  assert.equal(created.body.item.organization_id, org);
  assert.match(created.body.item.updated_by, /^[\da-f]{8}-[\da-f]{4}-8[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.equal((await f.post(input)).body.item.updated_by, created.body.item.updated_by);
  assert.equal((await f.post({ ...input, itemId: id, revision: 1, description: "Breakfast in the atrium" })).status, 200);

  const context = { organizationId: org };
  const lookup = () => f.tool.execute({ query: "Atrium breakfast" }, context);
  assert.equal((await lookup()).entries.length, 0);
  assert.equal((await f.post({ action: "set_status", itemId: id, status: "published", revision: 1, organizationId: other })).status, 200);
  const result = await lookup();
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].description, "Breakfast in the atrium");
  const foreignId = f.state.tables.hotel_catalog_items.find(item => item.organization_id === other).id;
  assert.equal((await f.post({ action: "set_status", itemId: foreignId, status: "draft", revision: 1 })).status, 404);
});
