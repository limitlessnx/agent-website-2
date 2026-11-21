import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {test} from 'node:test';
import ts from 'typescript';
import {memoryDb} from './helpers/social-memory-db.mjs';
function load(file,deps={},globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,JSON,require:name=>{if(!(name in deps))throw Error('Unexpected dependency '+name);return deps[name];},...globals});return exports;}
const policy=load('lib/social-real-estate-policy.ts'),ready=load('lib/social-review-readiness.ts'),daily=load('lib/social-daily-policy.ts',{'@/lib/social-review-readiness':ready});
const service=load('lib/social-realty-dispatch.ts',{'@/lib/social-real-estate-policy':policy,'@/lib/social-review-readiness':ready});
const now=new Date('2026-11-21T18:00:00Z'),approval='2026-11-21T15:00:00Z',org=policy.REALTY_SOCIAL_ORGANIZATION;
function setup(){return memoryDb({organizations:[{id:org,status:'active'}],social_brands:[{id:'own-brand',...policy.realtySocialBrandDefaults()}],organization_integrations:[{organization_id:org,provider:'meta',status:'connected',configuration:{instagram_login_user_id:'own-ig'}}],social_posts:[{id:'post',organization_id:org,brand_id:'own-brand',status:'scheduled',title:'Inspection checklist',caption:'Approved caption',format:'image',platforms:['instagram'],approved_at:approval,published_at:null,metadata:{primary_asset_id:'own-image'},content:{}}],social_schedules:[{id:'schedule',organization_id:org,post_id:'post',status:'pending',scheduled_for:'2026-11-21T17:00:00Z',metadata:{source:policy.REALTY_SOCIAL_SCHEDULE_SOURCE,publish_platforms:['instagram'],approval_snapshot:approval,instagram_account_id:'own-ig'}}],social_assets:[{id:'own-image',organization_id:org,post_id:'post',status:'ready',asset_type:'image',mime_type:'image/png',bucket_id:'private',storage_path:'own.png',metadata:{}}],social_publish_jobs:[],social_post_platform_refs:[],audit_logs:[]});}
test('explicit due intent is claimed once and does not create a daily slot or change Fluxknight records',async()=>{
  const db=setup(),calls=[];db.tables.social_schedules.push({id:'flux',organization_id:daily.DAILY_ORGANIZATION,status:'pending',scheduled_for:'2026-11-21T17:00:00Z',metadata:{source:daily.DAILY_SOURCE}});
  await service.dispatchRealtySocialSchedules(db,now,async(...args)=>calls.push(args));await service.dispatchRealtySocialSchedules(db,now,async(...args)=>calls.push(args));
  assert.equal(calls.length,1);assert.equal(calls[0][0],'schedule');assert.equal(db.tables.social_schedules.find(s=>s.id==='flux').status,'pending');assert.equal(db.tables.social_schedules.length,2);
});
test('future times, unrelated queue labels and suspended organizations are never dispatched',async()=>{
  for(const mutate of [db=>db.tables.social_schedules[0].scheduled_for='2026-11-22T18:00:00Z',db=>db.tables.social_schedules[0].metadata.source='unrelated',db=>db.tables.organizations[0].status='suspended']){
    const db=setup();mutate(db);await service.dispatchRealtySocialSchedules(db,now,async()=>assert.fail('Unexpected dispatch'));assert.equal(db.changes.length,0);
  }
});
test('changed approval, missing media, different brand and wrong destinations cancel the intent',async()=>{
  for(const mutate of [db=>db.tables.social_posts[0].approved_at='2026-11-21T16:00:00Z',db=>db.tables.social_posts[0].metadata={},db=>db.tables.social_posts[0].brand_id='other-brand',db=>db.tables.social_schedules[0].metadata.publish_platforms=['facebook']]){
    const db=setup();mutate(db);await service.dispatchRealtySocialSchedules(db,now,async()=>assert.fail('Unexpected dispatch'));assert.equal(db.tables.social_schedules[0].status,'cancelled');
  }
});
test('concurrent dispatchers cannot both claim an explicit schedule',async()=>{
  const db=setup(),calls=[];await Promise.all([service.dispatchRealtySocialSchedules(db,now,async id=>calls.push(id)),service.dispatchRealtySocialSchedules(db,now,async id=>calls.push(id))]);assert.equal(calls.length,1);
});
test('queue outages are recoverable, but an unknown stale claim requires reconciliation',async()=>{
  const db=setup();await service.dispatchRealtySocialSchedules(db,now,async()=>{throw Error('Synthetic queue outage');});assert.equal(db.tables.social_schedules[0].status,'pending');assert.equal(db.tables.social_schedules[0].claimed_at,null);
  Object.assign(db.tables.social_schedules[0],{status:'claimed',claimed_at:'2026-11-21T17:00:00Z'});await service.dispatchRealtySocialSchedules(db,now,async()=>assert.fail());assert.equal(db.tables.social_schedules[0].status,'failed');assert.match(db.tables.social_schedules[0].last_error,/unknown/);
});
function worker(db,{providerError=false,account='own-ig'}={}){
  const calls=[];class Clock extends Date{constructor(value){super(value===undefined?now:value);}static now(){return now.getTime();}}
  const mod=load('src/trigger/social-publisher.ts',{'@supabase/supabase-js':{createClient:()=>db},'@trigger.dev/sdk':{task:x=>x,AbortTaskRunError:class extends Error{},logger:{info(){},warn(){},error(){}}},'@/lib/social-daily-policy':daily,'@/lib/social-real-estate-policy':policy,'@/lib/social-meta-publisher':{metaPublisherConfigFromIntegration:async(_db,id)=>{assert.equal(id,org);return {instagramBusinessAccountId:account};},publishMetaPost:async input=>{calls.push(input);if(providerError)throw Error('Ambiguous provider response');return {platform:'instagram',externalPostId:'synthetic-media',externalAccountId:'own-ig',publishedUrl:'https://example.test/post',provider:'meta-graph-api',metadata:{}};}}},{Date:Clock,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'synthetic-key'}}});
  return {calls,run:()=>mod.fluxSocialPublishPost.run({scheduleId:'schedule'})};
}
test('existing publisher delivers approved own-brand media and retains its real outcome',async()=>{
  const db=setup();db.tables.social_schedules[0].status='claimed';const app=worker(db);await app.run();assert.equal(app.calls.length,1);assert.equal(app.calls[0].post.organizationId,org);assert.equal(app.calls[0].assets[0].id,'own-image');assert.equal(db.tables.social_schedules[0].status,'completed');
});
test('publisher revalidates the approval and account target rather than trusting an old queue claim',async()=>{
  const db=setup();db.tables.social_schedules[0].status='claimed';db.tables.social_posts[0].approved_at='2026-11-21T16:00:00Z';const app=worker(db);await assert.rejects(app.run(),/unchanged human approval/);assert.equal(app.calls.length,0);
  const other=setup();other.tables.social_schedules[0].status='claimed';const changed=worker(other,{account:'new-account'});await assert.rejects(changed.run(),/account changed/);assert.equal(changed.calls.length,0);assert.equal(other.tables.social_schedules[0].status,'failed');
});
test('ambiguous delivery does not automatically create a second public post',async()=>{
  const db=setup();db.tables.social_schedules[0].status='claimed';const app=worker(db,{providerError:true});await assert.rejects(app.run(),/Check Instagram/);assert.equal(db.tables.social_schedules[0].status,'failed');const retried=await app.run();assert.equal(retried.skipped,true);assert.equal(app.calls.length,1);
});
test('explicit scheduling requires own connection and records actor and account snapshot before writing',async()=>{
  const db=setup();db.tables.social_posts[0].status='approved';db.tables.social_schedules=[];
  const social=load('lib/social.ts',{'@/lib/social-real-estate-policy':policy,'@/lib/tenant':{requireTenant:async()=>({supabase:db,organizationId:org,user:{email:'admin@example.test'}})}},{Date:class extends Date{static now(){return now.getTime();}}});
  await social.scheduleSocialPost({postId:'post',scheduledFor:'2026-11-22T17:00:00Z',platforms:['instagram']});const s=db.tables.social_schedules[0];assert.equal(s.metadata.source,policy.REALTY_SOCIAL_SCHEDULE_SOURCE);assert.equal(s.metadata.approval_snapshot,approval);assert.equal(s.metadata.instagram_account_id,'own-ig');assert.equal(db.tables.audit_logs[0].metadata.actor_id,'admin@example.test');
});
test('missing connection or audit outage prevents schedule creation',async()=>{
  for(const kind of ['connection','audit']){
    const db=setup();db.tables.social_posts[0].status='approved';db.tables.social_schedules=[];
    if(kind==='connection')db.tables.organization_integrations=[];
    else{const from=db.from;db.from=table=>{const q=from(table);if(table==='audit_logs')q.insert=()=>Promise.resolve({error:new Error('Synthetic audit outage')});return q;};}
    const social=load('lib/social.ts',{'@/lib/social-real-estate-policy':policy,'@/lib/tenant':{requireTenant:async()=>({supabase:db,organizationId:org,user:{email:'admin@example.test'}})}},{Date:class extends Date{static now(){return now.getTime();}}});
    await assert.rejects(social.scheduleSocialPost({postId:'post',scheduledFor:'2026-11-22T17:00:00Z',platforms:['instagram']}));assert.equal(db.tables.social_schedules.length,0);
  }
});
