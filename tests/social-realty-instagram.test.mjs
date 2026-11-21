import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import * as crypto from 'node:crypto';
const ORG='b15f21b4-5697-4d21-9421-8a34eae3476d',FLUX='15046426-e520-438b-8694-7662a6986efb';
function setup(){
  let session={email:'admin@example.test',issuedAt:Date.now()},organizationId=ORG;
  let result={userId:'realty-ig-id',username:'limitless_realty_test',accessToken:'synthetic-own-token',expiresIn:3600,accountType:'BUSINESS',returnedPermissions:[]};
  const calls=[],writes=[],cache=new Map(),environment={ADMIN_SESSION_SECRET:'synthetic-state-signing-key',NODE_ENV:'test'};
  const credentials={instagram_app_id:'synthetic-app',instagram_app_secret:'synthetic-app-secret',access_token:'DO-NOT-COPY-PLATFORM-TOKEN'};
  const db={rpc:async(name,args)=>{writes.push({name,args});return {data:{integration_id:'own-integration'},error:null};},from:()=>({insert:async row=>{writes.push({audit:row});return {error:null};}})};
  const next={NextResponse:{redirect(location){const cookies=[];return {status:307,location:String(location),cookies:{values:cookies,set(...args){cookies.push(args);}}};}}};
  function load(name){
    if(name==='node:crypto')return crypto;
    if(name==='next/server')return next;
    if(name==='@/lib/admin-auth')return {getAdminSession:async()=>session};
    if(name==='@/lib/tenant')return {requireTenant:async()=>({organizationId,organization:{status:'active'}})};
    if(name==='@/lib/supabase/admin')return {createAdminClient:()=>db};
    if(name==='@/lib/meta-integration')return {getMetaCredentials:async id=>{calls.push({credentialsFor:id});return id===FLUX?credentials:{};},getMetaIntegration:async id=>({id:'integration-'+id,configuration:id===FLUX?{instagram_login_user_id:'flux-ig-id',instagram_login_username:'fluxknight.space'}:{}})};
    if(name==='@/lib/instagram-login')return {INSTAGRAM_LOGIN_SCOPES:['instagram_business_basic','instagram_business_content_publish'],buildInstagramAuthorizationUrl:({appId,redirectUri,state})=>`https://www.instagram.com/oauth/authorize?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`,exchangeInstagramCode:async args=>{calls.push({exchange:args});return result;}};
    if(cache.has(name))return cache.get(name);
    const path=name.startsWith('@/')?name.slice(2)+'.ts':name;
    const exports={};cache.set(name,exports);vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:load,process:{env:environment},Buffer,URL,Date,console:{info(){},error(){}},fetch:()=>{throw Error('External network forbidden');}});return exports;
  }
  const state=load('@/lib/social-realty-instagram-state');
  return {load,state,calls,writes,environment,get session(){return session;},set session(v){session=v;},set organizationId(v){organizationId=v;},set result(v){result={...result,...v};},request(value,cookie=value){return {url:`http://localhost/api/social/realty/instagram/callback?code=synthetic-code&state=${value}`,cookies:{get:()=>({value:cookie})}};},signed(){return state.createRealtyInstagramState(session.email,session.issuedAt,'limitless_realty_test');}};
}
test('OAuth state is signed, expiring and bound to the browser, actor and exact admin session',()=>{
  const app=setup(),state=app.signed();assert.ok(app.state.verifyRealtyInstagramState(state,state,app.session.email,app.session.issuedAt));
  assert.equal(app.state.verifyRealtyInstagramState(state,'',app.session.email,app.session.issuedAt),null);
  assert.equal(app.state.verifyRealtyInstagramState(state,state,'someone-else@example.test',app.session.issuedAt),null);
  assert.equal(app.state.verifyRealtyInstagramState(state,state,app.session.email,app.session.issuedAt+1),null);
  assert.equal(app.state.verifyRealtyInstagramState(state+'x',state+'x',app.session.email,app.session.issuedAt),null);
  assert.doesNotMatch(Buffer.from(state.split('.')[0],'base64url').toString(),/admin@example/);
  const old=JSON.parse(Buffer.from(state.split('.')[0],'base64url').toString());old.issuedAt=Date.now()-601000;const body=Buffer.from(JSON.stringify(old)).toString('base64url'),expired=body+'.'+crypto.createHmac('sha256','synthetic-state-signing-key').update(body).digest('base64url');assert.equal(app.state.verifyRealtyInstagramState(expired,expired,app.session.email,app.session.issuedAt),null);
});
test('authorization start uses an HTTP-only cookie and the own organization callback without writing credentials',async()=>{
  const app=setup(),route=app.load('app/api/social/realty/instagram/connect/route.ts');const r=await route.GET({url:'http://localhost/api/social/realty/instagram/connect?account=@limitless_realty_test'});
  const target=new URL(r.location);assert.equal(target.hostname,'www.instagram.com');assert.match(target.searchParams.get('redirect_uri'),/api\/social\/realty\/instagram\/callback$/);assert.equal(r.cookies.values[0][2].httpOnly,true);assert.equal(r.cookies.values[0][2].sameSite,'lax');assert.equal(app.writes.length,0);
});
test('wrong workspace and unsigned browser callbacks stop before token exchange or writes',async()=>{
  const app=setup(),value=app.signed(),route=app.load('app/api/social/realty/instagram/callback/route.ts');
  await route.GET(app.request(value,''));app.organizationId=FLUX;await route.GET(app.request(value));
  assert.equal(app.calls.filter(c=>c.exchange).length,0);assert.equal(app.writes.length,0);
});
test('valid callback stores only own account tokens, never platform account credentials',async()=>{
  const app=setup(),value=app.signed(),r=await app.load('app/api/social/realty/instagram/callback/route.ts').GET(app.request(value));
  assert.match(r.location,/instagram=connected/);const write=app.writes.find(w=>w.name);assert.equal(write.args.p_organization_id,ORG);assert.equal(write.args.p_credentials.instagram_login_user_id,'realty-ig-id');assert.equal(write.args.p_credentials.access_token,undefined);assert.equal(write.args.p_credentials.instagram_app_secret,undefined);assert.equal(r.cookies.values[0][2].maxAge,0);assert.ok(app.writes.some(w=>w.audit?.organization_id===ORG));
});
test('account mismatch and Fluxknight identity cannot attach to Limitless Realty',async()=>{
  for(const result of [{username:'wrong_account'},{userId:'flux-ig-id'}]){
    const app=setup();app.result=result;const r=await app.load('app/api/social/realty/instagram/callback/route.ts').GET(app.request(app.signed()));assert.match(r.location,/error=/);assert.equal(app.writes.length,0);
  }
});
test('provider failures never echo tokens or secrets into the redirect',async()=>{
  const app=setup();app.result={username:''};const r=await app.load('app/api/social/realty/instagram/callback/route.ts').GET(app.request(app.signed()));assert.doesNotMatch(r.location,/synthetic-own-token|synthetic-app-secret|PLATFORM-TOKEN/);
});
test('production preview cannot initiate live provider authorization',async()=>{
  const app=setup();app.environment.NODE_ENV='production';const r=await app.load('app/api/social/realty/instagram/connect/route.ts').GET({url:'https://preview.vercel.app/api/social/realty/instagram/connect?account=test'});assert.equal(new URL(r.location).hostname,'preview.vercel.app');assert.equal(r.cookies.values.length,0);assert.equal(app.writes.length,0);
});
function publisher(credentials,configuration={},status='connected'){
  const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/social-meta-publisher.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,Date,process:{env:{}},fetch:()=>{throw Error('Provider network forbidden');}});
  const db={rpc:async(_name,args)=>{assert.equal(args.p_organization_id,ORG);return {data:credentials,error:null};},from:()=>{const q={select:()=>q,eq:(key,value)=>{if(key==='organization_id')assert.equal(value,ORG);return q;},maybeSingle:async()=>({data:{status,configuration},error:null})};return q;}};
  return {exports,db};
}
test('direct Instagram uses only its own token/account, without requiring a Facebook Page',async()=>{
  const {exports,db}=publisher({instagram_user_access_token:'own-token',instagram_login_user_id:'own-ig'},{instagram_business_account_id:'stale-facebook-ig'});const c=await exports.metaPublisherConfigFromIntegration(db,ORG);assert.equal(c.instagramBusinessAccountId,'own-ig');assert.equal(c.instagramGraphHost,'graph.instagram.com');assert.equal(c.accessToken,'');assert.equal(c.pageId,'');
  await assert.rejects(exports.publishMetaPost({supabase:db,config:c,platform:'facebook',post:{format:'image'},assets:[]}),/Page credentials/);
});
test('legacy Page publishing keeps the Page token and matching Facebook account ID',async()=>{
  const {exports,db}=publisher({access_token:'own-page-token'},{page_id:'own-page',instagram_business_account_id:'own-facebook-ig',instagram_login_user_id:'stale-direct-ig'});const c=await exports.metaPublisherConfigFromIntegration(db,ORG);assert.equal(c.accessToken,'own-page-token');assert.equal(c.pageId,'own-page');assert.equal(c.instagramBusinessAccountId,'own-facebook-ig');assert.equal(c.instagramGraphHost,'graph.facebook.com');
});
test('mismatched token family and disconnected credentials fail closed',async()=>{
  const a=publisher({instagram_user_access_token:'own-token'},{instagram_business_account_id:'facebook-id'});await assert.rejects(a.exports.metaPublisherConfigFromIntegration(a.db,ORG),/matching authorized account/);
  const b=publisher({instagram_user_access_token:'own-token',instagram_login_user_id:'own-ig'},{},'disconnected');await assert.rejects(b.exports.metaPublisherConfigFromIntegration(b.db,ORG),/not connected/);
});
