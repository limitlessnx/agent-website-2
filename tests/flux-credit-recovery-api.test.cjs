/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const org='10000000-0000-4000-8000-000000000001',id='20000000-0000-4000-8000-000000000001';
const origin=load('lib/admin-request-origin.ts',{},'',{URL});const ids=load('lib/organization-context-catalog.ts');
function fixture({session={email:'admin@example.test',userId:'30000000-0000-4000-8000-000000000001'},outcome='settled',rpcError=false,foreign=false}={}){
 const calls=[];
 const route=load('app/api/admin/billing/reservations/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/admin-auth':{getAdminSession:async()=>session},'@/lib/admin-request-origin':origin,'@/lib/organization-context-catalog':ids,
  '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:rpcError?null:{id,organization_id:foreign?'foreign':org,outcome,status:['settled','already_settled'].includes(outcome)?'settled':'needs_attention'},error:rpcError?Error('PRIVATE_PROVIDER_DIAGNOSTIC'):null};}})},
 });
 const request=(extra={},headers={origin:'https://fluxknight.space','sec-fetch-site':'same-origin'})=>({url:'https://fluxknight.space/api/admin/billing/reservations',headers:new Headers(headers),json:async()=>({organizationId:org,reservationId:id,reason:'Reviewed completed synthetic evidence',confirmed:true,...extra})});
 return {route,request,calls};
}
test('missing administrator cannot inspect or reconcile reservations',async()=>{const f=fixture({session:null});assert.equal((await f.route.POST(f.request())).status,401);assert.equal(f.calls.length,0);});
for(const headers of [{origin:'https://attacker.example','sec-fetch-site':'cross-site'},{origin:'https://attacker.example'},{origin:'https://fluxknight.space','sec-fetch-site':'same-site'}])test('cross-origin browser requests fail before RPC',async()=>{const f=fixture();assert.equal((await f.route.POST(f.request({},headers))).status,403);assert.equal(f.calls.length,0);});
for(const extra of [{organizationId:'foreign'},{reservationId:'foreign'},{reason:'short'},{reason:'x'.repeat(501)},{confirmed:false}])test('invalid target, missing reason or confirmation blocks mutation',async()=>{const f=fixture();assert.equal((await f.route.POST(f.request(extra))).status,400);assert.equal(f.calls.length,0);});
test('authorized reconciliation forwards server identity and exact tenant/reservation only',async()=>{
 const f=fixture(),r=await f.route.POST(f.request({actorEmail:'attacker@example.test',outcome:'released'}));assert.equal(r.status,200);assert.equal(f.calls.length,1);
 const {name,args}=f.calls[0];assert.equal(name,'reconcile_flux_credit_capacity');assert.equal(args.p_actor_email,'admin@example.test');assert.equal(args.p_organization_id,org);assert.equal(args.p_reservation_id,id);assert.ok(!('p_outcome'in args));
});
for(const outcome of ['blocked','needs_attention'])test(outcome+' remains explicit review without invented success',async()=>{const f=fixture({outcome}),r=await f.route.POST(f.request());assert.equal(r.status,409);assert.ok(!r.body.ok);});
test('repeat settlement is reported without asking for another provider execution',async()=>{const f=fixture({outcome:'already_settled'}),r=await f.route.POST(f.request());assert.equal(r.status,200);assert.equal(r.body.duplicate,true);});
for(const options of [{rpcError:true},{foreign:true}])test('unavailable or foreign RPC evidence is sanitized and never accepted',async()=>{const f=fixture(options),r=await f.route.POST(f.request());assert.equal(r.status,503);assert.ok(!JSON.stringify(r.body).includes('PRIVATE_PROVIDER_DIAGNOSTIC'));});
