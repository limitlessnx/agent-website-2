/* eslint-disable @typescript-eslint/no-require-imports */
const test=require('node:test'),assert=require('node:assert/strict');
const load=require('./helpers/load-typescript.cjs');
const user={id:'verified-manager',email:'manager@example.test',email_confirmed_at:'2026-11-18'};
const next={'next/server':{NextResponse:{json:(body,{status=200}={})=>({body,status}),redirect:url=>({location:String(url)})}}};
const request=body=>({json:async()=>body});
function fixture(options={}){
 const calls={pending:[],manager:[],tenant:[],mode:[],provision:[],mail:[],provider:[],cleared:[]};
 const identity=options.user===undefined?user:options.user;
 const auth={
  signUpClient:async()=>({user:identity,...(options.confirmation?{}:{access_token:'synthetic',refresh_token:'synthetic'})}),
  signInClient:async()=>({user:identity,access_token:'synthetic',refresh_token:'synthetic'}),
  getPendingClientSetupSession:async()=>options.pending||null,
  getClientAccountMode:async()=>options.mode||null,
  setClientAccountMode:async(...args)=>calls.mode.push(args),
  setManagerSession:async x=>calls.manager.push(x),
  setPendingClientSetupSession:async x=>calls.pending.push(x),
  setClientSession:async x=>calls.tenant.push(x),
  getPrimaryMembership:async()=>options.membership||null,
  getMembershipForOrganization:async()=>options.membership||null,
  clearClientSession:async()=>calls.cleared.push('tenant'),
  clearManagerSession:async()=>calls.cleared.push('manager'),
  clearPendingClientSetupSession:async()=>calls.cleared.push('pending'),
  clearClientOAuthContext:async()=>calls.cleared.push('oauth'),
  clientAccountExists:async()=>true,
  getClientOAuthContext:async()=>options.context||null,
  setClientOAuthContext:async x=>calls.provider.push(x),
  getClientSession:async()=>calls.tenant.at(-1)||null,
 };
 const mocks={...next,'@/lib/client-auth':auth,
  '@/lib/auth-navigation':load('lib/auth-navigation.ts',{},'',{URL}),
  '@/lib/platform-admin-access':{establishAccountSession:async()=>calls.provider.push('session'),isVerifiedPlatformAdmin:async()=>false},
  '@/lib/admin-auth':{clearAdminSession:async()=>calls.cleared.push('admin')},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:identity},error:options.authError||null}),exchangeCodeForSession:async()=>({data:{user:identity},error:null}),signInWithOAuth:async input=>{calls.provider.push(input);return {data:{url:'https://provider.example.test/synthetic'},error:null};}}}),signOutAccount:async()=>calls.cleared.push('provider')},
  '@/lib/organization-membership':{acceptOrganizationInvitation:async()=>({organization_id:'invited-org'})},
  '@/lib/client-onboarding':{provisionClientOrganization:async x=>calls.provision.push(x),provisionClientWorkspace:async x=>calls.provision.push(x)},
  '@/lib/resend-events':{sendFluxknightLifecycleEvent:async x=>calls.mail.push(x),fluxknightPortalUrl:()=>'/portal'},
 };
 return {calls,route:name=>load('app/'+name+'/route.ts',mocks,'',{URL}),auth};
}
const signup={full_name:'Test Manager',email:user.email,password:'synthetic-password',password_confirmation:'synthetic-password'};
test('email signup awaits verification and preserves the account-choice/payment context without granting a role',async()=>{
 const f=fixture({confirmation:true});const r=await f.route('api/client-auth/signup').POST(request({...signup,payment_tx_ref:'paid-ref',account_mode:'manager'}));
 assert.equal(r.status,201);assert.equal(r.body.requires_email_confirmation,true);assert.equal(r.body.account_mode,'unselected');
 assert.equal(f.calls.pending[0].nextPath,'/account/choose-mode');assert.equal(f.calls.pending[0].txRef,'paid-ref');
 for(const name of ['manager','tenant','mode','provision','mail','provider'])assert.equal(f.calls[name].length,0,name);
});
test('confirmed email signup establishes provider identity and reaches the shared choice before any workspace is created',async()=>{
 const f=fixture();const r=await f.route('api/client-auth/signup').POST(request(signup));
 assert.equal(r.body.redirect_to,'/account/choose-mode');assert.equal(r.body.requires_account_choice,true);assert.equal(f.calls.provider.length,1);assert.equal(f.calls.provision.length,0);assert.equal(f.calls.manager.length,0);
});
test('invited signup still accepts the exact invitation and opens its membership',async()=>{
 const f=fixture({membership:{organizationId:'invited-org',organizationSlug:'invited',membershipId:'member',role:'manager'}});
 const r=await f.route('api/client-auth/signup').POST(request({...signup,invitation_token:'synthetic-invite'}));
 assert.equal(r.body.account_mode,'organization-member');assert.equal(f.calls.tenant[0].organizationId,'invited-org');assert.equal(f.calls.provision.length,0);
});
test('email login for an unselected account reaches choice after verification, retaining payment context',async()=>{
 const f=fixture({pending:{userId:user.id,email:user.email,txRef:'paid-ref'}});const r=await f.route('api/client-auth/login').POST(request({email:user.email,password:'synthetic'}));
 assert.equal(r.body.redirect_to,'/account/choose-mode');assert.equal(r.body.requires_workspace_setup,false);assert.equal(f.calls.pending[0].txRef,'paid-ref');assert.equal(f.calls.provision.length,0);
});
test('saved manager email login returns to manager access even with old company metadata or an existing membership',async()=>{
 for(const membership of [null,{organizationId:'approved',role:'manager'}]){
  const f=fixture({mode:'manager',membership,user:{...user,user_metadata:{company_name:'Legacy business'}}});const r=await f.route('api/client-auth/login').POST(request({email:user.email,password:'synthetic',account_mode:'organization'}));
  assert.equal(r.body.redirect_to,'/manage-organizations');assert.equal(f.calls.manager[0].userId,user.id);assert.ok(f.calls.cleared.includes('manager'));assert.equal(f.calls.provision.length,0);assert.equal(f.calls.mail.length,0);
 }
});
test('saved owner login still reaches workspace setup',async()=>{
 const f=fixture({mode:'organization'});const r=await f.route('api/client-auth/login').POST(request({email:user.email,password:'synthetic'}));assert.equal(r.body.redirect_to,'/account/setup');
});
test('Google manager login uses the same access hub and clears stale identity context',async()=>{
 const f=fixture({mode:'manager'});const r=await f.route('auth/callback').GET({url:'https://fluxknight.local/auth/callback?code=synthetic'});
 assert.equal(new URL(r.location).pathname,'/manage-organizations');assert.equal(f.calls.manager[0].userId,user.id);assert.ok(f.calls.cleared.includes('manager'));assert.equal(f.calls.provision.length,0);
});
test('Google starts on the canonical host before setting context and preserves preview hosts',async()=>{
 const f=fixture();const r=await f.route('api/client-auth/google/start').GET({url:'https://www.fluxknight.space/api/client-auth/google/start?invitation_token=synthetic&next=%2Fportal'});
 assert.equal(new URL(r.location).hostname,'fluxknight.space');assert.equal(f.calls.provider.length,0);assert.equal(new URL(r.location).searchParams.get('invitation_token'),'synthetic');
 const g=fixture();await g.route('api/client-auth/google/start').GET({url:'https://preview.example.test/api/client-auth/google/start?invitation_token=synthetic'});
 assert.equal(g.calls.provider[0].invitationToken,'synthetic');assert.equal(g.calls.provider[1].options.redirectTo,'https://preview.example.test/auth/callback');
});
test('unverified or absent live identities cannot exchange a signed setup context for manager access',async()=>{
 for(const identity of [null,{...user,email_confirmed_at:null}]){
  const f=fixture({user:identity,pending:{userId:user.id,email:user.email}});const r=await f.route('api/client-auth/account-mode').POST(request({account_mode:'manager'}));
  assert.equal(r.status,401);assert.equal(f.calls.manager.length,0);assert.equal(f.calls.mode.length,0);
 }
});
test('account choice binds to the verified identity rather than another pending account or request fields',async()=>{
 const f=fixture({pending:{userId:'other-user',email:'other@example.test'}});const r=await f.route('api/client-auth/account-mode').POST(request({account_mode:'manager',userId:'forged',email:'forged@example.test'}));
 assert.equal(r.body.redirect_to,'/manage-organizations');assert.equal(f.calls.mode[0][0],user.id);assert.equal(f.calls.manager[0].email,user.email);assert.equal(f.calls.tenant.length,0);
});
test('manager choice cannot replace an existing owner mode or an outstanding invitation',async()=>{
 for(const options of [{mode:'organization'},{pending:{userId:user.id,email:user.email,invitationToken:'synthetic'}}]){
  const f=fixture(options);const r=await f.route('api/client-auth/account-mode').POST(request({account_mode:'manager'}));assert.equal(r.status,409);assert.equal(f.calls.manager.length,0);assert.equal(f.calls.mode.length,0);
 }
});
test('owner choice preserves checkout context while manager setup cannot create a workspace',async()=>{
 const pending={userId:user.id,email:user.email,txRef:'paid-ref',nextPath:'/account/choose-mode'};
 const f=fixture({pending});const r=await f.route('api/client-auth/account-mode').POST(request({account_mode:'organization'}));assert.equal(r.body.redirect_to,'/account/setup');assert.equal(f.calls.pending.at(-1).txRef,'paid-ref');
 for(const options of [{mode:'manager'},{},{user:{...user,email_confirmed_at:null}},{user:{...user,id:'other'}}]){
  const g=fixture({...options,pending});const res=await g.route('api/client-auth/setup-workspace').POST(request({company_name:'Must not create'}));assert.ok([401,403,409].includes(res.status));assert.equal(g.calls.provision.length,0);
 }
});
test('logout clears the manager identity along with tenant/provider/setup cookies',async()=>{
 const f=fixture();await f.route('api/client-auth/logout').POST();for(const name of ['manager','tenant','provider','pending','admin','oauth'])assert.ok(f.calls.cleared.includes(name),name);
});

function accessFixture(options={}){
 const calls=[],sessions=[];const session=options.anonymous?null:{userId:user.id,email:user.email};
 const route=load('app/api/client-auth/manager-access/route.ts',{...next,
  '@/lib/client-auth':{getManagerSession:async()=>session,getMembershipForOrganization:async()=>options.approved?{organizationId:'org',membershipId:'member',role:'manager'}:null,getActiveManagerOrganizations:async()=>options.approved&&!options.inactive?[{organizationId:'org',organizationName:'Approved organization'}]:[],setClientSession:async x=>sessions.push(x)},
  '@/lib/supabase-server-rest':{supabaseServerRequest:async(url,init)=>{
   calls.push({url,init});if(url.startsWith('organizations?'))return options.unknown?[]:[{id:'org',name:'Organization'}];
   if(url.startsWith('organization_memberships?'))return [];
   if(url==='organization_access_requests')return [{id:'request',status:'pending'}];
   return options.pending?[{id:'request',organization_id:'org',status:'pending'}]:[];
  }},
 });return {route,calls,sessions};
}
test('Access ID creates only a pending request for the authenticated manager, never a membership',async()=>{
 const f=accessFixture();const r=await f.route.POST(request({access_code:' flx-test1234 ',requester_user_id:'forged',organization_id:'foreign'}));
 assert.equal(r.status,201);assert.equal(r.body.status,'pending');assert.equal(f.sessions.length,0);
 const write=f.calls.find(x=>x.init?.method==='POST');const data=JSON.parse(write.init.body);assert.equal(data.requester_user_id,user.id);assert.equal(data.organization_id,'org');assert.equal(write.url,'organization_access_requests');assert.match(f.calls[0].url,/status=eq.active/);
});
test('repeated pending Access ID requests do not create duplicates',async()=>{
 const f=accessFixture({pending:true});const r=await f.route.POST(request({access_code:'FLX-TEST1234'}));assert.equal(r.status,200);assert.equal(r.body.status,'pending');assert.equal(f.calls.filter(x=>x.init?.method==='POST').length,0);
});
test('unknown/malformed codes and anonymous requests fail without membership writes',async()=>{
 for(const [options,body,status] of [[{anonymous:true},{access_code:'FLX-TEST1234'},401],[{},null,400],[{}, {access_code:'invalid'},400],[{unknown:true},{access_code:'FLX-TEST1234'},404]]){
  const f=accessFixture(options);assert.equal((await f.route.POST(request(body))).status,status);assert.equal(f.calls.filter(x=>x.init?.method==='POST').length,0);assert.equal(f.sessions.length,0);
 }
});
test('workspace entry requires active membership and active organization, and ignores forged actor fields',async()=>{
 for(const [options,status] of [[{},403],[{approved:true,inactive:true},403],[{approved:true},200]]){
  const f=accessFixture(options);const r=await f.route.POST(request({action:'enter',organization_id:'org',userId:'forged',role:'owner'}));assert.equal(r.status,status);if(status===200){assert.equal(f.sessions[0].userId,user.id);assert.equal(f.sessions[0].role,'manager');}else assert.equal(f.sessions.length,0);
 }
});
test('manager hub lists only the authenticated manager\'s requests and active memberships',async()=>{
 const f=accessFixture({approved:true});const r=await f.route.GET();assert.equal(r.body.organizations[0].organizationId,'org');assert.ok(f.calls.every(x=>x.url.includes('requester_user_id=eq.'+user.id)));
});
