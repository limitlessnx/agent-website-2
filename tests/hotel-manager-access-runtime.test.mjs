import test from 'node:test';
import assert from 'node:assert/strict';
import load from './helpers/load-typescript.cjs';
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',requestId='20000000-0000-4000-8000-000000000001';
function fixture(){
 const state={approved:false,requested:false,removed:false,rpcs:[],session:null};const manager={userId:'manager-two',email:'manager@example.invalid'};const owner={organizationId:org,userId:'owner'};
 const request=async(path,options)=>{
  if(path.startsWith('organizations?'))return[{id:org,name:'Garden Hotel'}];
  if(path.startsWith('organization_memberships?'))return state.approved&&!state.removed?[{id:'membership',status:'active'}]:[];
  if(path==='organization_access_requests'){state.requested=true;return[{id:requestId,status:'pending'}];}
  if(path.startsWith('organization_access_requests?')){if(path.includes('organization_id=eq.'+other))return[];return state.approved||!state.requested?[]:[{id:requestId,status:'pending'}];}
  if(path.startsWith('rpc/')){state.rpcs.push([path,JSON.parse(options.body)]);if(path.includes('approve_'))state.approved=true;if(path.includes('update_organization'))state.removed=true;return{};}return[];
 };
 const next={'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status})}}};
 const managerRoute=load('app/api/client-auth/manager-access/route.ts',{...next,'@/lib/client-auth':{getManagerSession:async()=>manager,getMembershipForOrganization:async(_user,organization)=>state.approved&&!state.removed&&organization===org?{organizationId:org,organizationSlug:'garden',membershipId:'membership',role:'manager'}:null,setClientSession:async session=>{state.session=session}},'@/lib/supabase-server-rest':{supabaseServerRequest:request}});
 let session=owner;const ownerRoute=load('app/api/portal/team/access-requests/route.ts',{...next,'@/lib/client-auth':{getClientSession:async()=>session},'@/lib/portal-access':{requirePortalPermission:async()=>({permissions:new Set(['members.manage'])})},'@/lib/organization-membership':{listOrganizationMembers:async()=>[{id:'membership',role:'manager'}]},'@/lib/supabase-server-rest':{supabaseServerRequest:request},'@/lib/supabase/admin':{createAdminClient:()=>({auth:{admin:{getUserById:async()=>({data:{user:{email:manager.email}}})}}})}});
 return{state,managerRoute,ownerRoute,selectOrganization:organizationId=>{session={...owner,organizationId}}};
}
const post=(route,body)=>route.POST({json:async()=>body});
test('Access ID requires approval before entry; an authorized manager can enter and removal prevents reentry',async()=>{const f=fixture();assert.equal((await post(f.managerRoute,{action:'enter',organization_id:org})).status,403);assert.equal((await post(f.managerRoute,{access_code:'FLX-ABCD1234'})).status,201);assert.equal(f.state.session,null);assert.equal((await post(f.ownerRoute,{action:'approve',request_id:requestId})).status,200);assert.equal((await post(f.managerRoute,{action:'enter',organization_id:org})).status,200);assert.equal(f.state.session.organizationId,org);assert.equal(f.state.session.role,'manager');assert.equal((await post(f.ownerRoute,{action:'remove',membership_id:'membership'})).status,200);assert.equal((await post(f.managerRoute,{action:'enter',organization_id:org})).status,403);});
test('approval and rejection cannot operate on a request from another selected organization',async()=>{const f=fixture();f.state.requested=true;f.selectOrganization(other);for(const action of ['approve','reject'])assert.equal((await post(f.ownerRoute,{action,request_id:requestId,organizationId:org})).status,404);assert.equal(f.state.rpcs.length,0);});
test('an existing signed client cookie is rejected after live membership removal',async()=>{
 let token='',active=true;const session={userId:'manager-two',email:'manager@example.invalid',organizationId:org,organizationSlug:'garden',membershipId:'membership',role:'manager',issuedAt:Date.now()};
 const auth=load('lib/client-auth.ts',{'next/headers':{cookies:async()=>({get:key=>key==='fluxknight_client_session'?{value:token}:undefined})},'@/lib/admin-auth':{getAdminSession:async()=>null},'@/lib/supabase/config':{resolveSupabaseUrl:()=> 'https://example.invalid'},'@/lib/supabase-server-rest':{supabaseServerRequest:async path=>{assert.match(path,/status=eq.active/);return active?[{id:'membership',organization_id:org,status:'active',organizations:{slug:'garden'},membership_roles:[{roles:{slug:'manager'}}]}]:[]}}});
 token=auth.createClientSessionToken(session);assert.equal((await auth.getClientSession()).organizationId,org);active=false;assert.equal(await auth.getClientSession(),null);
});
