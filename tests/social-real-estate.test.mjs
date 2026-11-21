import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import {memoryDb} from './helpers/social-memory-db.mjs';

function load(overrides={}) {
  const cache=new Map();
  const request=(name)=>{
    if(name==='node:crypto')return crypto;
    if(overrides[name])return overrides[name];
    if(!name.startsWith('@/lib/'))throw Error('Unexpected dependency '+name);
    if(cache.has(name))return cache.get(name);
    const exports={};cache.set(name,exports);
    const source=ts.transpileModule(readFileSync(name.replace('@/', '')+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(source,{exports,require:request,URL,Date,Map,Set,AbortSignal,process:{env:{OPENAI_API_KEY:'synthetic-test-key'}},fetch:overrides.fetch||(()=>{throw Error('External network forbidden')})});
    return exports;
  };
  return {core:request('@/lib/social-real-estate'),policy:request('@/lib/social-real-estate-policy')};
}
const input={mode:'idea',idea:'Questions to ask before a land inspection',requestId:'12345678-1234-4123-8123-123456789abc',actor:'admin@example.test'};
const post=(sources=[])=>({title:'Inspect before deciding',hook:'Ask these questions before buying land',caption:'Check the available documents and arrange an inspection. #NigerianRealEstate',cta:'Message Limitless Realty to discuss an inspection.',visual_brief:'An illustrative checklist, not a property photo.',source_urls:sources});
const response=(value)=>({ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]})});
function setup(fetch){const app=load({fetch});return {...app,brand:{id:'realty-brand',...app.policy.realtySocialBrandDefaults()}};}

test('manual ideas use the realty strategy and one structured draft without searching or publishing',async()=>{
  const calls=[];const app=setup(async(url,options)=>{calls.push(JSON.parse(options.body));return response({posts:[post()]});});
  const result=await app.core.generateRealtyDraftCopy(app.brand,input);
  assert.equal(result.posts.length,1);assert.equal(calls.length,1);assert.equal(calls[0].store,false);
  assert.match(calls[0].input[0].content,/Limitless Realty/);assert.match(calls[0].input[0].content,/NOT Fluxknight/);
  assert.equal(calls[0].tools,undefined);assert.match(calls[0].input[1].content,/Questions to ask/);
});
test('research requires completed web search and binds every citation to retrieved public HTTPS sources',async()=>{
  const calls=[],url='https://example.test/property-report';
  const app=setup(async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(body.tools)return {ok:true,json:async()=>({output:[{type:'web_search_call',status:'completed',action:{sources:[{url,title:'Synthetic property report'}]}},{type:'message',content:[{type:'output_text',text:'Synthetic recent coverage for review, not popularity data.'}]}]})};return response({posts:[post([url]),post([url]),post([url])]});});
  const result=await app.core.generateRealtyDraftCopy(app.brand,{...input,mode:'research',idea:''});
  assert.equal(result.posts.length,3);assert.equal(calls[0].tool_choice,'required');assert.equal(calls[0].tools[0].user_location.country,'NG');
  assert.match(calls[1].input[1].content,/Synthetic property report/);assert.equal(result.sources[0].url,url);
});
test('failed or unsourced research stops without a drafting call',async()=>{
  let calls=0;const app=setup(async()=>{calls++;return response({posts:[post()]});});
  await assert.rejects(app.core.generateRealtyDraftCopy(app.brand,{...input,mode:'research'}),/no usable sourced coverage/);assert.equal(calls,1);
});
test('invented citations and overlong captions fail before persistence',async()=>{
  const app=setup(async()=>response({posts:[post(['https://invented.test/report'])]}));
  await assert.rejects(app.core.generateRealtyDraftCopy(app.brand,input),/citations/);
  const long=setup(async()=>response({posts:[{...post(),caption:'x'.repeat(2201)}]}));
  await assert.rejects(long.core.generateRealtyDraftCopy(long.brand,input),/fields need correction/);
});
test('provider failures are actionable and do not echo upstream secrets',async()=>{
  const app=setup(async()=>({ok:false,status:503,json:async()=>({error:'secret upstream body'})}));
  await assert.rejects(app.core.generateRealtyDraftCopy(app.brand,input),error=>error.message.includes('503')&&!error.message.includes('secret'));
});
test('untrusted source schemes, credentials and private addresses are discarded',()=>{
  const app=setup();const result=app.core.realtyResearchSources({output:[{type:'web_search_call',status:'completed',action:{sources:['http://example.test','javascript:alert(1)','https://127.0.0.1/x','https://user:pass@example.test/x','https://example.test/report'].map(url=>({url}))}}]});
  assert.equal(result.length,1);assert.equal(result[0].url,'https://example.test/report');
});
test('saved drafts stay in review with no approvals, schedules, jobs or other-tenant writes',async()=>{
  const app=setup();const db=memoryDb({social_brands:[app.brand,{...app.brand,id:'other',organization_id:'another-org'}],social_posts:[],audit_logs:[]});
  let called=0;const generate=async()=>{called++;return {posts:[post()],sources:[]};};
  const first=await app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate);
  const stored=db.tables.social_posts[0];assert.equal(stored.status,'review');assert.equal(stored.approved_at,null);assert.equal(stored.published_at,null);assert.equal(stored.organization_id,app.brand.organization_id);assert.equal(stored.metadata.popularity_verified,false);assert.equal(stored.content.manual_idea,input.idea);
  stored.status='approved';stored.approved_at='2026-11-21T00:00:00Z';
  const retry=await app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate);
  assert.equal(retry.existing,true);assert.equal(first.postIds[0],retry.postIds[0]);assert.equal(called,1);assert.equal(db.tables.social_posts.length,1);assert.equal(stored.status,'approved');
  assert.ok(db.changes.every(c=>['social_posts','audit_logs'].includes(c.table)));
});
test('concurrent draft saves use stable IDs and cannot overwrite a winning draft',async()=>{
  const app=setup(),db=memoryDb({social_brands:[app.brand],social_posts:[],audit_logs:[]});
  const generate=async()=>({posts:[post()],sources:[]});
  await Promise.all([app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate),app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate)]);
  assert.equal(db.tables.social_posts.length,1);assert.ok(db.changes.filter(c=>c.table==='social_posts').every(c=>c.kind==='upsert'));
});
test('audit failures preserve drafts and retry repairs the audit without generating twice',async()=>{
  const app=setup(),db=memoryDb({social_brands:[app.brand],social_posts:[],audit_logs:[]});let fail=true,calls=0;
  const from=db.from;db.from=table=>{const q=from(table);if(table==='audit_logs'&&fail)q.insert=()=>Promise.resolve({error:new Error('Synthetic audit outage')});return q;};
  const generate=async()=>{calls++;return {posts:[post()],sources:[]};};
  await assert.rejects(app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate),/Drafts were saved/);
  assert.equal(db.tables.social_posts.length,1);fail=false;
  const retry=await app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate);
  assert.equal(retry.existing,true);assert.equal(calls,1);assert.equal(db.tables.audit_logs.length,1);
});
test('wrong organizations, brands and invalid input are rejected before model calls or writes',async()=>{
  const app=setup(),db=memoryDb({social_brands:[{...app.brand,metadata:{}}],social_posts:[]});let called=0;
  const generate=async()=>{called++;throw Error('should not run');};
  await assert.rejects(app.core.prepareRealtySocialDrafts(db,'another-org',input,generate),/administrator/);
  await assert.rejects(app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,{...input,idea:''},generate),/post idea/);
  await assert.rejects(app.core.prepareRealtySocialDrafts(db,app.brand.organization_id,input,generate),/Set up/);
  assert.equal(called,0);assert.equal(db.changes.length,0);
});
test('brand defaults do not copy Fluxknight daily publishing, weekly jobs, accounts or product CTAs',()=>{
  const {brand}=setup();assert.equal(brand.metadata.daily_publishing.enabled,false);assert.equal(brand.metadata.weekly_review_enabled,false);assert.equal(brand.name,'Limitless Realty');assert.doesNotMatch(JSON.stringify(brand.ctas),/Leo|trial|fluxknight\.space/i);
});
test('legacy brand CTAs are rejected rather than leaking into a realty draft',async()=>{
  const app=setup(async()=>response({posts:[{...post(),cta:'Talk to Leo at fluxknight.space'}]}));await assert.rejects(app.core.generateRealtyDraftCopy(app.brand,input),/another brand/);
});
test('the existing Fluxknight weekly planner rejects a realty brand before provider access',async()=>{
  const app=setup(),exports={};const source=ts.transpileModule(readFileSync('lib/social-ai.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>name==='@/lib/social-real-estate-policy'?app.policy:{socialWeeklyPostCount:()=>assert.fail('Should reject before planning')},fetch:()=>assert.fail('Provider should not run'),process:{env:{}}});
  await assert.rejects(exports.generateWeeklySocialPlan(app.brand),/instead of Fluxknight/);
});
test('admin access guard checks the active server context and blocks cross-workspace provider administration',async()=>{
  let session=null,organizationId='another-org';
  const app=load({'@/lib/admin-auth':{getAdminSession:async()=>session},'@/lib/tenant':{requireTenant:async()=>({organizationId,organization:{status:'active'}})}});
  // Load the actual access module with the same isolated dependency loader.
  const exports={};const source=ts.transpileModule(readFileSync('lib/social-real-estate-access.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(source,{exports,require:name=>name==='@/lib/admin-auth'?{getAdminSession:async()=>session}:name==='@/lib/tenant'?{requireTenant:async()=>({organizationId,organization:{status:'active'}})}:app.policy});
  await assert.rejects(exports.requireRealtySocialAdmin(),/sign-in/);session={email:'admin@example.test'};
  await assert.rejects(exports.requireRealtySocialAdmin(),/Select/);organizationId=app.policy.REALTY_SOCIAL_ORGANIZATION;
  await exports.requireRealtySocialAdmin();await assert.rejects(exports.requireFluxSocialProviderWorkspace(),/Fluxknight workspace/);
});
