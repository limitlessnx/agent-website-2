/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),load=require('./helpers/load-typescript.cjs');
const f=require('./helpers/runtime-completion-database.cjs');
function route(rpc,authorized=true){return load('app/api/internal/runtime/actions/complete/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status||200})}},'@/lib/runtime/auth':{assertRuntimeSecret:()=>{if(!authorized)throw Error('Unauthorized.')}},'@/lib/supabase/admin':{createAdminClient:()=>({rpc})}},'',{Error});}
const body={organization_id:f.org,agent_id:f.agent,execution_id:f.execution,status:'succeeded',output:{queued:true}};
const req=data=>({headers:{get:()=>null},json:async()=>data});
test('unauthorized or malformed requests never reach the database',async()=>{
 let calls=0;const rpc=()=>{calls++;throw Error('database must not be called')};assert.equal((await route(rpc,false).POST(req(body))).status,401);
 for(const extra of [{organization_id:'invalid'},{status:'processing'},{output:[]},{output:null}])assert.equal((await route(rpc).POST(req({...body,...extra}))).status,400);assert.equal(calls,0);
});
test('API uses actual atomic SQL and preserves completion/retry response',async t=>{
 const db=await f.fixture(t);const r=route(async(name,args)=>{assert.equal(name,'complete_runtime_execution');try{return{data:await f.complete(db,args),error:null}}catch(error){return{data:null,error}}});
 const a=await r.POST(req(body)),b=await r.POST(req(body));assert.equal(a.status,200);assert.deepEqual(b.body,{...a.body,duplicate:true});assert.equal(a.body.output.queued,true);
});
test('database errors are explicit needs-attention responses without private diagnostics',async()=>{
 for(const message of ['legacy_completion_requires_review','completion_input_conflict','completion_evidence_unavailable','private database diagnostic']){const r=await route(async()=>({error:{message}})).POST(req(body));assert.equal(r.status,409);assert.equal(r.body.needs_attention,true);assert.equal(r.body.do_not_redispatch,true);assert.ok(!JSON.stringify(r).includes('private database diagnostic'));}
 assert.equal((await route(async()=>({error:{message:'completion_scope_mismatch'}})).POST(req(body))).status,404);
 assert.equal((await route(async()=>({data:null,error:null})).POST(req(body))).status,409);
});
