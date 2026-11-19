/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs'),plans=load('lib/fluxknight-plans.ts');
const org='10000000-0000-4000-8000-000000000001';
function fixture(evidence={balance:100,reserved:40,available:60},rpcError=null){
 const calls=[];const wallet={organization_id:org,plan_code:'business',monthly_allowance:12000,balance:100,bonus_balance:0,top_up_balance:0,trial_credit_limit:null,trial_ends_at:null,current_period_end:null,status:'active'};
 const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:null,error:null})};
 const admin={from:()=>q,rpc:async(name,args)=>{calls.push({name,args});if(name==='ensure_flux_credit_wallet')return {data:wallet,error:null};if(name==='get_flux_credit_period_usage')return {data:null,error:null};assert.equal(name,'get_flux_credit_availability');return {data:evidence,error:rpcError};}};
 const credits=load('lib/flux-credits.ts',{'@/lib/supabase/admin':{createAdminClient:()=>admin},'@/lib/fluxknight-plans':plans});
 return {credits,calls,wallet};
}
test('billing separates held capacity from consumption without charging or exposing evidence',async()=>{
 const f=fixture();const r=await f.credits.getFluxBillingSummary(org);
 assert.equal(r.balance,100);assert.equal(r.used,11900);assert.equal(r.capacity.reservedCredits,40);assert.equal(r.capacity.availableCredits,60);
 assert.equal(f.calls.at(-1).args.p_organization_id,org);assert.equal(f.calls.length,3);
});
test('availability and balance use the same database observation after a concurrent debit',async()=>{
 const f=fixture({balance:60,reserved:40,available:20});const r=await f.credits.getFluxBillingSummary(org);assert.equal(r.balance,60);assert.equal(r.capacity.availableCredits,20);assert.equal(r.used,11940);
});
for(const evidence of [{balance:0,reserved:0,available:0},{balance:2,reserved:5,available:0}])test('zero availability and holds above balance remain truthful',async()=>{
 const r=await fixture(evidence).credits.getFluxBillingSummary(org);assert.equal(r.capacity.status,'available');assert.equal(r.capacity.availableCredits,0);assert.equal(r.capacity.reservedCredits,evidence.reserved);
});
for(const evidence of [null,{}, {balance:100,reserved:20,available:100},{balance:100,reserved:-1,available:101},{balance:100,reserved:NaN,available:0},{balance:'100',reserved:0,available:100}])test('invalid capacity never becomes a zero or invented available balance',async()=>{
 const r=await fixture(evidence).credits.getFluxBillingSummary(org);assert.equal(r.capacity.status,'unavailable');assert.equal(r.capacity.availableCredits,null);assert.equal(r.capacity.reservedCredits,null);assert.equal(r.balance,100);
});
test('capacity RPC errors leave wallet readable and availability explicitly unavailable',async()=>{
 const r=await fixture(null,Error('PRIVATE_PROVIDER_DIAGNOSTIC')).credits.getFluxBillingSummary(org);assert.equal(r.capacity.status,'unavailable');assert.ok(!JSON.stringify(r).includes('PRIVATE_PROVIDER_DIAGNOSTIC'));
});
function routeFixture({session={organizationId:org,userId:'member'},permissions=[],membershipError=false,failRead=false}={}){
 const reads=[];const route=load('app/api/portal/billing/route.ts',{
  'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  '@/lib/client-auth':{getClientSession:async()=>session},
  '@/lib/organization-membership':{getOrganizationAccessContext:async(organization,user)=>{reads.push(['membership',organization,user]);if(membershipError)throw Error('PRIVATE');return {permissions:new Set(permissions)};}},
  '@/lib/flux-credits':{getFluxBillingSummary:async organization=>{reads.push(['wallet',organization]);if(failRead)throw Error('PRIVATE');return {balance:100,periodUsage:{periodStart:'2026-11-01',periodEnd:'2026-12-01',usedCredits:6,usageEvents:3,providerCostCents:987654,customerValueCents:123456,grossMarginCents:999999},capacity:{status:'available',reservedCredits:40,availableCredits:60}};}},
  '@/lib/flux-commercial':{getFluxCommercialSnapshot:async organization=>{reads.push(['commercial',organization]);return {};}}
 });return {route,reads};
}
for(const options of [{session:null},{permissions:[]},{membershipError:true}])test('billing API denies missing session or permission before financial reads',async()=>{
 const f=routeFixture(options),r=await f.route.GET();assert.equal(r.status,options.session===null?401:403);assert.ok(!f.reads.some(x=>['wallet','commercial'].includes(x[0])));
});
for(const permissions of [['billing.view'],['billing.manage']])test('billing API uses authorized session organization and additive public capacity fields',async()=>{
 const f=routeFixture({permissions}),r=await f.route.GET();assert.equal(r.status,200);assert.equal(r.body.wallet.capacity.availableCredits,60);assert.equal(f.reads.find(x=>x[0]==='wallet')[1],org);assert.ok(!JSON.stringify(r.body).includes('request_fingerprint'));assert.equal(r.body.wallet.periodUsage.usedCredits,6);for(const internal of ['providerCostCents','customerValueCents','grossMarginCents'])assert.ok(!(internal in r.body.wallet.periodUsage));
});
test('billing read errors are explicit and sanitized',async()=>{const f=routeFixture({permissions:['billing.view'],failRead:true}),r=await f.route.GET();assert.equal(r.status,500);assert.ok(!r.body.error.includes('PRIVATE'));});
test('existing trusted admin preview stays read-only without conflating tenant membership',async()=>{const f=routeFixture({session:{organizationId:org,userId:'preview',isAdminPreview:true}});assert.equal((await f.route.GET()).status,200);assert.ok(!f.reads.some(x=>x[0]==='membership'));});

test('unexpected wallet identity fails before reading another organization capacity',async()=>{const f=fixture();f.wallet.organization_id='foreign';await assert.rejects(f.credits.getFluxBillingSummary(org),/inside the organization/);assert.equal(f.calls.length,1);});
