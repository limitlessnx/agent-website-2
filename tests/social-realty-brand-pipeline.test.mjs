import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from 'node:crypto';
import {memoryDb} from './helpers/social-memory-db.mjs';
const org='b15f21b4-5697-4d21-9421-8a34eae3476d',logo='88888888-1111-4111-8111-111111111111';
const identity={approved:true,background:'#081b18',surface:'#102923',accent:'#e8c767',text:'#ffffff',muted:'#d4e2dc',font:'geist',footer:'Know the property. Make an informed decision.',website:'https://realty.example.test',logoAssetId:logo};
function setup({queueFails=false}={}){
 let db;const calls=[],queued=[],rendered=[],uploads=[],cache=new Map();
 const fetch=async(_url,options)=>{const b=JSON.parse(options.body);calls.push(b);if(b.tools)return{ok:true,json:async()=>({output:[{type:'web_search_call',status:'completed',action:{sources:[{url:'https://official.example.test/report',title:'Synthetic property report'}]}},{type:'message',content:[{type:'output_text',text:'Synthetic reported property context; not actual current news.'}]}]})};
  if(b.text.format.name==='flux_social_carousel')return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({title:'Property guide',slides:Array.from({length:5},(_,i)=>({type:i===0?'hook':i===4?'cta':'insight',headline:'Verify property facts',body:'Ask qualified advisers and review the available documents.'}))})}]}]})};
  const posts=Array.from({length:b.text.format.schema.properties.posts.minItems},(_,i)=>({title:`Property topic ${i}`,hook:`Inspection question ${i}`,caption:'Review documents and ask your adviser. #Property',cta:'Message Limitless Realty.',visual_brief:'Illustrative property checklist.',source_urls:['https://official.example.test/report']}));return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({posts})}]}]})};};
 const load=name=>{if(name==='react/jsx-runtime')return{jsx:()=>null,jsxs:()=>null};if(name==='node:crypto')return crypto;if(name==='@/lib/supabase/admin')return{createAdminClient:()=>db};if(name==='@/lib/social-meta-sync')return{runMetaAnalyticsSync:()=>assert.fail('Realty must not query Fluxknight account metrics')};if(name==='@trigger.dev/sdk')return{logger:{info(){},warn(){},error(){}},task:definition=>({...definition,trigger:async payload=>{queued.push({id:definition.id,payload});return{id:'fake-run'};}}),schedules:{task:definition=>definition},tasks:{trigger:async(id,payload)=>{queued.push({id,payload});if(queueFails)throw Error('Synthetic queue outage');return{id:'fake-run'};}}};if(cache.has(name))return cache.get(name);if(!name.startsWith('@/lib/')&&!name.startsWith('@/worker/'))throw Error(name);const exports={};cache.set(name,exports);const file=name.startsWith('@/worker/')?'src/trigger/'+name.slice('@/worker/'.length)+(name.endsWith('social-carousel-renderer')?'.tsx':'.ts'):name.replace('@/','')+(name==='@/lib/social-carousel-core'?'.tsx':'.ts');vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:load,URL,Date,Map,Set,AbortSignal,Uint8Array,crypto,process:{env:{OPENAI_API_KEY:'synthetic'}},fetch});return exports;};
 const policy=load('@/lib/social-real-estate-policy'),brand={id:'realty-brand',...policy.realtySocialBrandDefaults(),visual_rules:{identity}};db=memoryDb({organizations:[{id:org,status:"active"}],social_brands:[brand],social_brand_assets:[{organization_id:org,brand_id:brand.id,asset_role:'logo_primary',social_asset_id:logo,is_active:true}],social_assets:[{id:logo,organization_id:org,brand_id:brand.id,status:'ready',mime_type:'image/png',bucket_id:'flux-social-assets',storage_path:org+'/brand/logo.png'}],social_content_plans:[],social_posts:[],social_post_metrics:[]});
 db.storage={from:bucket=>({createSignedUrl:async path=>({data:{signedUrl:'https://storage.example.test/'+bucket+'/'+path},error:null}),upload:async path=>{uploads.push(path);return{error:null};},remove:async()=>({error:null})})};
 const worker=()=>{const core=load('@/lib/social-carousel-core');core.renderSlide=async input=>{rendered.push(input);return{arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer};};return load('@/worker/social-carousel-renderer');};
 return{load,brand,db,calls,queued,rendered,uploads,worker};
}
test('media identity requires approval, a logo snapshot, safe URLs and readable brand colors',()=>{
 const app=setup(),validate=app.load('@/lib/social-media-identity').validateSocialMediaIdentity;
 assert.equal(validate(identity).accent,'#e8c767');
 for(const value of [{...identity,approved:false},{...identity,logoAssetId:''},{...identity,text:identity.background},{...identity,website:'https://user:secret@example.test'},{...identity,footer:'Talk to Leo at fluxknight.space'}])assert.throws(()=>validate(value));
 assert.equal(app.load('@/lib/social-media-identity').socialMediaIdentity({organization_id:'another-org'}),undefined);
});
test('missing, foreign, changed or unavailable logos block paid weekly preparation',async()=>{
 for(const kind of ['missing','foreign','changed','failed','foreign-storage']){
  const app=setup();if(kind==='missing')app.db.tables.social_brand_assets=[];if(kind==='foreign')app.db.tables.social_assets[0].organization_id='another-org';if(kind==='changed')app.brand.visual_rules.identity={...identity,logoAssetId:'99999999-1111-4111-8111-111111111111'};if(kind==='failed')app.db.tables.social_assets[0].status='failed';if(kind==='foreign-storage')app.db.tables.social_assets[0].storage_path='another-org/logo.png';
  // memoryDb clones seed data, so mutate the stored row for the approval change.
  if(kind==='changed')app.db.tables.social_brands[0].visual_rules.identity=app.brand.visual_rules.identity;
  await assert.rejects(app.load('@/lib/social-weekly-plan').prepareSocialReviewWeek(app.db,org,'2026-11-23'));
  assert.equal(app.calls.length,0);assert.equal(app.queued.length,0);
 }
});
test('weekly research saves seven cited, unapproved carousels and queues the existing renderer only',async()=>{
 const app=setup(),prepare=app.load('@/lib/social-weekly-plan').prepareSocialReviewWeek;
 const result=await prepare(app.db,org,'2026-11-23');assert.equal(result.postIds.length,7);assert.equal(app.calls.length,2);assert.equal(app.queued.length,7);
 assert.ok(app.queued.every(q=>q.id==='flux-social-render-carousel'&&q.payload.organizationId===org));
 for(const post of app.db.tables.social_posts){assert.equal(post.format,'carousel');assert.equal(post.status,'review');assert.equal(post.approved_at,undefined);assert.equal(post.content.source_links.length,1);assert.equal(post.metadata.popularity_verified,false);assert.equal(post.metadata.requires_human_review,true);}
 assert.equal(app.db.tables.social_schedules,undefined);assert.equal(app.db.tables.social_publish_jobs,undefined);
 const retry=await prepare(app.db,org,'2026-11-23');assert.equal(retry.existing,true);assert.equal(app.calls.length,2);assert.equal(app.db.tables.social_posts.length,7);
});
test('queue failure preserves the weekly batch and exposes recoverable media failures',async()=>{
 const app=setup({queueFails:true});await app.load('@/lib/social-weekly-plan').prepareSocialReviewWeek(app.db,org,'2026-11-23');assert.equal(app.db.tables.social_posts.length,7);assert.equal(app.db.tables.social_content_plans.length,1);assert.ok(app.db.tables.social_posts.every(p=>p.metadata.carousel_render_status==='queue_failed'&&p.status==='review'));
});
test('the existing Fluxknight planner does not receive the Realty editorial prompt',async()=>{
 const app=setup(),brain=app.load('@/lib/social-ai');await brain.generateWeeklySocialPlan(app.brand);assert.match(app.calls[0].input[0].content,/Nigerian real estate/);assert.doesNotMatch(app.calls[0].input[0].content,/senior content strategist.*AI automation company/);
});
test('the shared task exposes weekly failures and only marks media-ready batches review-ready',async()=>{
 const app=setup(),worker=app.load('@/worker/social-review-week');
 await worker.fluxSocialPrepareReviewWeek.run({organizationId:org,brandId:app.brand.id,weekStart:'2026-11-23',manual:true});
 assert.equal(app.db.tables.social_weekly_runs[0].status,'generating');assert.equal(app.db.tables.social_weekly_runs[0].post_ids.length,7);
 app.db.tables.social_posts.forEach(p=>p.metadata.carousel_render_status='ready');
 await app.load('@/lib/social-realty-week-status').refreshRealtyWeekStatus(app.db,org,app.brand.id,'2026-11-23');assert.equal(app.db.tables.social_weekly_runs[0].status,'review_ready');
 const blocked=setup();blocked.db.tables.social_brands[0].visual_rules={};await assert.rejects(blocked.load('@/worker/social-review-week').fluxSocialPrepareReviewWeek.run({organizationId:org,brandId:blocked.brand.id,weekStart:'2026-11-23',manual:true}));assert.equal(blocked.db.tables.social_weekly_runs[0].status,'failed');assert.equal(blocked.calls.length,0);
});
test('the existing Monday schedule respects Realty opt-in and retains Fluxknight dispatch',async()=>{
 const app=setup(),worker=app.load('@/worker/social-review-week');const skipped=await worker.fluxSocialPrepareReviewWeek.run({organizationId:org,brandId:app.brand.id});assert.equal(skipped.reason,'weekly_review_disabled');assert.equal(app.calls.length,0);await worker.fluxSocialMondayReview.run();assert.equal(app.queued.length,1);assert.equal(app.queued[0].id,'flux-social-prepare-review-week');assert.equal(app.calls.length,0);
 app.db.tables.social_brands[0].metadata.weekly_review_enabled=true;await worker.fluxSocialMondayReview.run();assert.equal(app.queued.length,3);assert.equal(app.queued[2].payload.organizationId,org);assert.equal(app.calls.length,0);
 const prepared=await worker.fluxSocialPrepareReviewWeek.run({organizationId:org,brandId:app.brand.id});assert.equal(prepared.skipped,undefined); // enabled batch prepares through the shared implementation
});
test('the shared carousel worker uses the approved Realty logo and palette without publication',async()=>{
 const app=setup();await app.load('@/worker/social-review-week').fluxSocialPrepareReviewWeek.run({organizationId:org,brandId:app.brand.id,weekStart:'2026-11-23',manual:true});
 const post=app.db.tables.social_posts[0];await app.worker().fluxSocialRenderCarousel.run({organizationId:org,postId:post.id});
 assert.equal(app.rendered.length,5);assert.ok(app.rendered.every(frame=>frame.identity.accent===identity.accent&&frame.brandName==='Limitless Realty'&&frame.logoUrl.includes(org)));
 assert.ok(app.uploads.every(path=>path.startsWith(org+'/'+post.id+'/')));assert.equal(post.metadata.carousel_render_status,'ready');assert.equal(post.approved_at,null);assert.equal(app.db.tables.social_weekly_runs[0].status,'generating');assert.equal(app.db.tables.social_schedules,undefined);
});
test('changed logo approval blocks the carousel worker before a model or upload and preserves prior media',async()=>{
 const app=setup();app.db.tables.social_brands[0].visual_rules.identity.logoAssetId='99999999-1111-4111-8111-111111111111';app.db.tables.social_posts.push({id:'post',organization_id:org,brand_id:app.brand.id,format:'carousel',status:'review',content:{},metadata:{media_assets:['prior-asset']}});
 await assert.rejects(app.worker().fluxSocialRenderCarousel.run({organizationId:org,postId:'post'}),/logo/);assert.equal(app.calls.length,0);assert.equal(app.uploads.length,0);assert.deepEqual(app.db.tables.social_posts[0].metadata.media_assets,['prior-asset']);assert.equal(app.db.tables.social_posts[0].metadata.carousel_render_status,'failed');
});
