const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const load=require('./helpers/load-typescript.cjs');
const A='b15f21b4-5697-4d21-9421-8a34eae3476d',B='7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
function harness({auth=true,due=[A],rpcError=null,worker=async()=>({processed:1,results:[{status:'sent'}]})}={}){
 const calls=[],seen=[];const admin={rpc:async(name,args)=>{calls.push([name,args]);if(name==='verify_maia_scheduler_secret')return{data:auth,error:null};return{data:rpcError?null:due.map(organization_id=>({organization_id})),error:rpcError?{message:rpcError}:null};}};
 const route=load('app/api/cron/real-estate-inspections/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/runtime/auth':{secureEqual:(a,b)=>a===b},
  '@/lib/supabase/admin':{createAdminClient:()=>admin},
  '@/lib/real-estate-inspection-worker':{processDueRealEstateInspectionJobs:async(input)=>{seen.push(input);return worker(input.organizationId);}},
 });return{route,calls,seen};
}
const req=(headers={})=>({headers:{get:key=>headers[key.toLowerCase()]||null}});
test('reminder scheduler rejects unauthenticated requests before querying work',async()=>{const h=harness({auth:false});const result=await h.route.GET(req());assert.equal(result.status,401);assert.equal(h.calls.length,0);assert.equal(h.seen.length,0);});
test('reminder scheduler requires an explicit due-tenant opt-in list and bounded per-tenant processing',async()=>{const h=harness({due:[A,B]});const result=await h.route.GET(req({'x-maia-scheduler-token':'scheduler-token'}));assert.equal(result.status,200);assert.deepEqual(h.calls.map(x=>x[0]),['verify_maia_scheduler_secret','list_due_real_estate_inspection_organizations']);assert.equal(JSON.stringify(h.calls[1][1]),JSON.stringify({p_limit:25}));assert.equal(JSON.stringify(h.seen),JSON.stringify([{organizationId:A,limit:5},{organizationId:B,limit:5}]));assert.equal(result.body.tenants,2);assert.equal(JSON.stringify(result.body.results[0].counts),JSON.stringify({sent:1,failed:0,cancelled:0,unknown:0}));});
test('reminder scheduler returns unavailable when opt-in migration is not present and sends nothing',async()=>{const h=harness({rpcError:'missing function'});const result=await h.route.GET(req({'x-maia-scheduler-token':'scheduler-token'}));assert.equal(result.status,503);assert.equal(h.seen.length,0);});
test('daily CRON_SECRET cannot select tenants itself; only IDs from the opted-in due query are processed',async()=>{const prior=process.env.CRON_SECRET;process.env.CRON_SECRET='secret';try{const h=harness({due:[]});const result=await h.route.GET(req({authorization:'Bearer secret'}));assert.equal(result.status,200);assert.deepEqual(h.seen,[]);assert.equal(result.body.tenants,0);}finally{if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}});
test('existing safety-net dispatches inspection reminders only with a verified external scheduler token',async()=>{
 const paths=[],prior=process.env.CRON_SECRET;process.env.CRON_SECRET='daily-secret';
 const mocks={
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async()=>({data:true,error:null})})},
 };
 const route=load('app/api/cron/maia-safety-net/route.ts',mocks,'',{URL,fetch:async url=>{paths.push(new URL(url).pathname);return{ok:true,status:200};}});
 const request=(headers={})=>({url:'https://local.example/api/cron/maia-safety-net',headers:{get:key=>headers[key.toLowerCase()]||null}});
 try{await route.GET(request({authorization:'Bearer daily-secret'}));assert.equal(paths.includes('/api/cron/real-estate-inspections'),false);paths.length=0;await route.GET(request({'x-maia-scheduler-token':'external-token'}));assert.equal(paths.includes('/api/cron/real-estate-inspections'),true);assert.equal(paths.length,4);}finally{if(prior===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=prior;}
});
test('reminder activation is permission-, entitlement- and confirmation-gated with an atomic settings RPC',()=>{
 const action=fs.readFileSync('app/dashboard/real-estate/actions.ts','utf8');
 assert.match(action,/requireRealEstateAccess\("appointments\.write"\)/);assert.match(action,/assertFluxFeatureAccess\(scope\.organizationId,"reminders"\)/);assert.match(action,/confirm_change/);assert.match(action,/set_real_estate_inspection_automation/);
});
