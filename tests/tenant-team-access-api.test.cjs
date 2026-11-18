/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const load=require('./helpers/load-typescript.cjs');
const org='10000000-0000-4000-8000-000000000001', actor='20000000-0000-4000-8000-000000000001';
const next={'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}}};
function fixture({role='owner',revoked=false,anonymous=false,preview=false}={}){
 const calls=[];
 const membership=load(path.resolve('lib/organization-membership.ts'),{
  '@/lib/supabase/admin':{createAdminClient:()=>({auth:{admin:{getUserById:async()=>({data:{user:{email:'synthetic@example.test'}}})}}})},
  '@/lib/supabase-server-rest':{supabaseServerRequest:async(url,options)=>{
   calls.push({url,options});
   if(url.startsWith('organization_memberships?')&&url.includes('user_id='))return revoked?[]:[{id:'membership',user_id:actor,status:'active',membership_roles:[{roles:{organization_id:org,slug:role,role_permissions:[{permissions:{key:'members.manage'}},{permissions:{key:'members.view'}},{permissions:{key:'billing.manage'}}]}}]}];
   if(url.startsWith('rpc/'))return {ok:true};
   return [];
  }}
 }, "", {Error});
 const session=anonymous?null:{userId:actor,organizationId:org,isAdminPreview:preview};
 const route=load(path.resolve('app/api/organization/invitations/route.ts'),{...next,'@/lib/client-auth':{getClientSession:async()=>session},'@/lib/organization-membership':membership}, '', {Error});
 return {route,membership,calls,session};
}
test('real membership helper rejects non-owner even with stale delegated management/billing permissions',async()=>{
 for(const options of [{role:'manager'},{role:'supervisor'},{revoked:true}]){
  const f=fixture(options);const response=await f.route.POST({json:async()=>({email:'new@example.test',role:'manager',organizationId:'foreign'})});
  assert.ok([401,403].includes(response.status));assert.equal(f.calls.filter(x=>x.url.startsWith('rpc/')).length,0);
 }
});
test('owner invitation uses authenticated tenant/actor and only returns a fresh token to owner',async()=>{
 const f=fixture();const r=await f.route.POST({json:async()=>({email:'NEW@example.test',role:'manager',organizationId:'foreign',actorUserId:'foreign'})});
 assert.equal(r.status,201);const rpc=f.calls.find(x=>x.url==='rpc/create_organization_invitation');const body=JSON.parse(rpc.options.body);
 assert.equal(body.p_organization_id,org);assert.equal(body.p_actor_user_id,actor);assert.equal(body.p_email,'new@example.test');assert.equal(body.p_token_hash.length,64);assert.ok(r.body.invitation.invitation_path.startsWith('/join?invitation='));
});
test('anonymous and admin preview cannot create invitations',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{preview:true},403]]){const f=fixture(options);assert.equal((await f.route.POST({json:async()=>({email:'new@example.test'})})).status,status);assert.equal(f.calls.length,0);}
});
test('customized manager role cannot gain billing or team administration',async()=>{
 const f=fixture();for(const permission of ['members.manage','billing.manage','organization.owner.transfer'])await assert.rejects(f.membership.setOrganizationRolePermissions({organizationId:org,actorUserId:actor,role:'manager',permissions:[permission]}),/reserved/);
 assert.equal(f.calls.filter(x=>x.url==='rpc/set_organization_role_permissions').length,0);
});
test('all live checkout routes deny manager before provider, wallet or database mutations',async()=>{
 for(const file of ['app/api/payments/create/route.ts','app/api/checkout/route.ts','app/api/portal/billing/top-up/route.ts','app/api/client-auth/start-trial/route.ts']){
   const f=fixture({role:'manager'});const route=load(path.resolve(file),{...next,'crypto':require('node:crypto'),
    '@/lib/client-auth':{getClientSession:async()=>f.session},'@/lib/organization-membership':f.membership,
    '@/lib/supabase/admin':{createAdminClient:()=>{throw Error('unexpected database mutation')}},
    '@/lib/supabase-server-rest':{supabaseRest:()=>{throw Error('unexpected database mutation')}},
    '@/lib/flux-credits':{getFluxWalletSummary:()=>{throw Error('unexpected wallet read')}},
    '@/lib/flux-topups':{},'@/lib/payments/region':{},'@/lib/payments/flutterwave':{},'@/lib/payments/catalog':{},
   });
   const response=await route.POST({headers:new Headers(),json:async()=>({planSlug:'test',amountUsd:10})});assert.equal(response.status,403,file);
 }
});
test('trial activation requires live ownership and binds the RPC to the session organization',async()=>{
 for(const [options,status] of [[{anonymous:true},401],[{preview:true},403],[{revoked:true},403],[{},200]]){
  const f=fixture(options),writes=[];
  const route=load(path.resolve('app/api/client-auth/start-trial/route.ts'),{...next,'@/lib/client-auth':{getClientSession:async()=>f.session},'@/lib/organization-membership':f.membership,'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{writes.push({name,args});return {data:{ok:true},error:null};}})}});
  assert.equal((await route.POST()).status,status);
  assert.equal(writes.length,status===200?1:0);
  if(writes.length)assert.equal(writes[0].args.target_organization_id,org);
 }
});
