import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { memoryDb } from './helpers/social-memory-db.mjs';
const load = (file, dependencies = {}) => {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText, {exports,Date,Map,Set,require:(name)=>{if (!(name in dependencies)) throw new Error(name);return dependencies[name];}});
  return exports;
};
const readiness=load('lib/social-review-readiness.ts');
const policy=load('lib/social-daily-policy.ts',{'@/lib/social-review-readiness':readiness});
const service=load('lib/social-daily-publishing.ts',{'@/lib/social-daily-policy':policy});
const configuration={enabled:true,timezone:'Africa/Lagos',local_time:'18:00',enabled_at:'2026-11-17T07:45:00.000Z',minimum_week_start:'2026-11-16'};
function post(index, extra={}) { return {id:`post-${index}`,organization_id:policy.DAILY_ORGANIZATION,brand_id:policy.DAILY_BRAND,status:'approved',approved_at:'2026-11-16T09:50:00.000Z',published_at:null,format:'carousel',platforms:['instagram'],content:{week_start:'2026-11-16',planned_index:index},metadata:{carousel_render_status:'ready',carousel_asset_ids:['slide1','slide2']},created_at:'2026-11-16T09:00:00.000Z',...extra}; }
function setup(){return memoryDb({social_brands:[{id:policy.DAILY_BRAND,organization_id:policy.DAILY_ORGANIZATION,metadata:{daily_publishing:configuration}}],organizations:[{id:policy.DAILY_ORGANIZATION,status:'active'}],social_posts:Array.from({length:7},(_,i)=>post(i+1)),social_schedules:[],social_post_platform_refs:[]});}
const morning=new Date('2026-11-17T08:00:00Z');
test('seven approved posts get one future 18:00 WAT slot per day, never an early public call',async()=>{
  const db=setup(),sent=[];
  await service.runDailyPublishing(db,morning,false,async(id)=>sent.push(id));
  assert.equal(sent.length,0);assert.equal(db.tables.social_schedules.length,7);
  assert.equal(db.tables.social_schedules[0].scheduled_for,'2026-11-17T17:00:00.000Z');
  assert.equal(db.tables.social_schedules[6].scheduled_for,'2026-11-23T17:00:00.000Z');
  assert.ok(db.tables.social_posts.every((p)=>p.status==='scheduled'));
  await service.runDailyPublishing(db,morning,false,async(id)=>sent.push(id));
  assert.equal(db.tables.social_schedules.length,7);assert.equal(sent.length,0);
});
test('drafts, rejected posts, old approvals and other organizations are excluded',async()=>{
  const db=setup();db.tables.social_posts.push(post(8,{status:'draft',approved_at:null}),post(9,{status:'review',approved_at:null}),post(10,{content:{week_start:'2026-11-09'}}),post(11,{organization_id:'another-organization'}));
  db.tables.social_schedules.push({id:'legacy',post_id:'legacy-post',status:'pending',scheduled_for:'2026-11-14T03:30:00Z',metadata:{publish_platforms:['instagram']}});
  await service.runDailyPublishing(db,morning,true,async()=>assert.fail('scheduleOnly must not publish'));
  assert.equal(db.tables.social_schedules.length,8);
  assert.equal(db.tables.social_schedules.find((s)=>s.id==='legacy').status,'pending');
  assert.equal(db.tables.social_posts.find((p)=>p.id==='post-8').status,'draft');
});
test('future approvals join the next free day without duplicating current dates',async()=>{
  const db=setup();await service.runDailyPublishing(db,morning,true,async()=>{});
  db.tables.social_posts.push(post(8,{content:{},approved_at:'2026-11-18T09:00:00Z'}));
  await service.runDailyPublishing(db,new Date('2026-11-18T09:01:00Z'),true,async()=>{});
  const booked=db.tables.social_schedules.find((s)=>s.post_id==='post-8');
  assert.equal(booked.scheduled_for,'2026-11-25T17:00:00.000Z'); // missed 17th moves behind the existing 18-23 queue on 24th
  assert.equal(new Set(db.tables.social_schedules.map((s)=>s.scheduled_for)).size,8);
});
test('only one due item is claimed, and a repeated tick cannot dispatch again',async()=>{
  const db=setup(),sent=[];await service.runDailyPublishing(db,morning,true,async()=>{});
  await service.runDailyPublishing(db,new Date('2026-11-17T17:00:00Z'),false,async(id)=>sent.push(id));
  await service.runDailyPublishing(db,new Date('2026-11-17T17:05:00Z'),false,async(id)=>sent.push(id));
  assert.equal(sent.length,1);assert.equal(db.tables.social_schedules[0].status,'claimed');
});
test('approval revocation cancels its automatic schedule instead of publishing',async()=>{
  const db=setup(),sent=[];await service.runDailyPublishing(db,morning,true,async()=>{});
  Object.assign(db.tables.social_posts[0],{status:'draft',approved_at:null});
  await service.runDailyPublishing(db,new Date('2026-11-17T17:00:00Z'),false,async(id)=>sent.push(id));
  assert.equal(sent.length,0);assert.equal(db.tables.social_schedules[0].status,'cancelled');
});
test('turning off automatic publishing and suspended organizations produce no changes',async()=>{
  for(const suspended of [false,true]){const db=setup();if(suspended)db.tables.organizations[0].status='suspended';else db.tables.social_brands[0].metadata.daily_publishing.enabled=false;
    assert.equal((await service.runDailyPublishing(db,morning,false,async()=>assert.fail())).skipped,true);assert.equal(db.changes.length,0);
  }
});
test('Reels require verified narration, music and human audio approval before scheduling',()=>{
  const reel=post(1,{format:'reel',metadata:{reel_asset_id:'video',reel_render_status:'ready',reel_audio_verified:true,reel_music_status:'ready',reel_voice_review_status:'approved'}});
  assert.equal(policy.eligibleDailyPost(reel,configuration),true);
  for(const [key,value] of [['reel_audio_verified',false],['reel_music_status','missing_licensed_track'],['reel_voice_review_status','pending']]) assert.equal(policy.eligibleDailyPost({...reel,metadata:{...reel.metadata,[key]:value}},configuration),false);
});
test('late approvals start tomorrow and Lagos midnight is handled correctly',()=>{
  const plan=policy.planDailySlots([post(1)],[],configuration,new Date('2026-11-17T17:01:00Z'));
  assert.equal(plan[0].scheduledFor,'2026-11-18T17:00:00.000Z');
  assert.equal(policy.lagosDay(new Date('2026-11-17T23:10:00Z')),'2026-11-18');
});
test('a completed public reference prevents a second schedule for that post',async()=>{
  const db=setup();db.tables.social_post_platform_refs.push({post_id:'post-1',organization_id:policy.DAILY_ORGANIZATION,brand_id:policy.DAILY_BRAND,platform:'instagram'});
  await service.runDailyPublishing(db,morning,true,async()=>{});assert.equal(db.tables.social_schedules.length,6);assert.ok(!db.tables.social_schedules.some((s)=>s.post_id==='post-1'));
});
test('a manual cancellation stays cancelled until a fresh approval',async()=>{
  const db=setup();await service.runDailyPublishing(db,morning,true,async()=>{});
  db.tables.social_schedules[0].status='cancelled';db.tables.social_posts[0].status='approved';
  await service.runDailyPublishing(db,morning,true,async()=>{});
  assert.equal(db.tables.social_schedules[0].status,'cancelled');assert.equal(db.tables.social_posts[0].status,'approved');
  db.tables.social_posts[0].approved_at='2026-11-17T09:00:00Z';
  await service.runDailyPublishing(db,new Date('2026-11-17T09:01:00Z'),true,async()=>{});
  assert.equal(db.tables.social_schedules[0].status,'pending');assert.equal(db.tables.social_posts[0].status,'scheduled');
});
test('a publication earlier in the day reserves that day and prevents a second one',async()=>{
  const db=setup();db.tables.social_posts.push(post(20,{status:'published',published_at:'2026-11-17T08:00:00Z'}));
  await service.runDailyPublishing(db,morning,true,async()=>{});
  assert.equal(db.tables.social_schedules[0].scheduled_for,'2026-11-18T17:00:00.000Z');
});
test('competing schedule claims cannot dispatch the same slot twice',async()=>{
  const db=setup(),sent=[];await service.runDailyPublishing(db,morning,true,async()=>{});
  db.beforeUpdate=(table,values,tables)=>{if(table==='social_schedules'&&values.status==='claimed')tables.social_schedules[0].status='claimed';};
  const result=await service.runDailyPublishing(db,new Date('2026-11-17T17:00:00Z'),false,async(id)=>sent.push(id));
  assert.equal(result.reason,'already_claimed');assert.equal(sent.length,0);
});
