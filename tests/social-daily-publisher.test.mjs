import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { memoryDb } from './helpers/social-memory-db.mjs';
function load(file, dependencies, globals={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Map,Set,require:(name)=>dependencies[name],...globals});return exports;}
const ready=load('lib/social-review-readiness.ts',{});
const policy=load('lib/social-daily-policy.ts',{'@/lib/social-review-readiness':ready});
const config={enabled:true,timezone:'Africa/Lagos',local_time:'18:00',enabled_at:'2026-11-17T07:45:00Z',minimum_week_start:'2026-11-16'};
function setup({time='2026-11-17T17:01:00Z',status='scheduled',changedApproval=false,started=false,providerError=false}={}){
 const approval='2026-11-16T09:50:00Z';const calls=[];
 const db=memoryDb({social_brands:[{id:policy.DAILY_BRAND,organization_id:policy.DAILY_ORGANIZATION,metadata:{daily_publishing:config}}],organizations:[{id:policy.DAILY_ORGANIZATION,status:'active'}],
 social_posts:[{id:'post',organization_id:policy.DAILY_ORGANIZATION,brand_id:policy.DAILY_BRAND,title:'Approved carousel',caption:'Approved caption',format:'carousel',status,platforms:['instagram'],approved_at:changedApproval?'2026-11-17T10:00:00Z':approval,published_at:null,content:{week_start:'2026-11-16'},created_at:approval,metadata:{carousel_render_status:'ready',carousel_asset_ids:['slide1','slide2']}}],
 social_schedules:[{id:'schedule',organization_id:policy.DAILY_ORGANIZATION,post_id:'post',status:'claimed',scheduled_for:'2026-11-17T17:00:00Z',metadata:{source:policy.DAILY_SOURCE,publish_platforms:['instagram'],approval_snapshot:approval}}],
 social_assets:[1,2,3].map((i)=>({id:`slide${i}`,organization_id:policy.DAILY_ORGANIZATION,post_id:'post',status:'ready',asset_type:'carousel_slide',mime_type:'image/png',bucket_id:'private',storage_path:`${i}.png`,metadata:{position:i}})),social_post_platform_refs:[],
 social_publish_jobs:started?[{id:'job',schedule_id:'schedule',platform:'instagram',status:'running',attempt_count:1,max_attempts:3,metadata:{automatic_delivery_started_at:'2026-11-17T17:00:00Z'}}]:[]});
 class Clock extends Date {constructor(...args){super(...(args.length?args:[time]));}static now(){return Date.parse(time);}}
 const task=load('src/trigger/social-publisher.ts',{'@supabase/supabase-js':{createClient:()=>db},'@trigger.dev/sdk':{task:(definition)=>definition,AbortTaskRunError:class extends Error{},logger:{info(){}}},'@/lib/social-daily-policy':policy,'@/lib/social-meta-publisher':{metaPublisherConfigFromIntegration:async()=>({}),publishMetaPost:async(input)=>{calls.push(input);if(providerError)throw new Error('Ambiguous provider response');return{platform:'instagram',externalPostId:'ig-media',externalAccountId:'owned-account',publishedUrl:'https://example.invalid/post',provider:'meta-graph-api',metadata:{}};}}},{Date:Clock,process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test'}}});
 return{db,calls,run:()=>task.fluxSocialPublishPost.run({scheduleId:'schedule'})};
}
test('future slots cannot publish even if the worker is triggered early',async()=>{const app=setup({time:'2026-11-17T16:59:59Z'});assert.equal((await app.run()).reason,'not_due');assert.equal(app.calls.length,0);assert.equal(app.db.changes.length,0);});
test('due approved slides publish once and exclude superseded media',async()=>{const app=setup();await app.run();assert.equal(app.calls.length,1);assert.equal(app.calls[0].assets.length,2);assert.equal(app.db.tables.social_posts[0].status,'published');await app.run();assert.equal(app.calls.length,1);});
test('changed approval and non-scheduled posts cannot publish',async()=>{for(const options of[{changedApproval:true},{status:'draft'},{status:'review'}]){const app=setup(options);await app.run().catch(()=>{});assert.equal(app.calls.length,0);}});
test('a previous ambiguous delivery is never automatically sent twice',async()=>{const app=setup({started:true});await assert.rejects(app.run(),/reconciliation/);assert.equal(app.calls.length,0);assert.equal(app.db.tables.social_schedules[0].status,'failed');});
test('provider failures stop automatic retries rather than risking duplicate public posts',async()=>{const app=setup({providerError:true});await assert.rejects(app.run(),/Automatic delivery stopped/);assert.equal(app.calls.length,1);assert.equal(app.db.tables.social_schedules[0].status,'failed');await assert.rejects(app.run());assert.equal(app.calls.length,1);});
test('missed calendar days cannot be published as immediate catch-up',async()=>{const app=setup({time:'2026-11-18T17:00:00Z'});await assert.rejects(app.run(),/catch-up/);assert.equal(app.calls.length,0);});
