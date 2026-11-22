import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('lib/social-weekly-plan.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const week = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/social-week.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: week });
function setup({ existing = false, queueFails = false, format = 'carousel', formats, metadata = {}, weekStart = '2026-11-16' } = {}) {
  const writes = [], queued = [];
  const brand = { id: 'a330b65a-d5b2-45f3-b211-451616f2fa8d', visual_rules: {}, metadata, name: 'Fluxknight' };
  const plan = { strategy_summary: 'Strategy', weekly_objective: 'Bookings', audience_angle: 'Owners', posts: (formats || Array(5).fill(format)).map((format, i) => ({ title: `Post ${i}`, hook: 'Hook', caption: 'Caption', cta: 'Talk to Leo', content_pillar: 'Industry', objective: 'Bookings', creative_brief: 'Brief', format, platforms: ['instagram'] })) };
  let planned = 0;
  const db = { from(table) {
    let mutation, values;
    const q = {
      select() { return q; }, eq() { return q; }, order() { return q; }, limit() { return q; }, in() { return q; },
      insert(v) { mutation = 'insert'; values = v; writes.push({ table, mutation, values }); return q; },
      update(v) { mutation = 'update'; values = v; writes.push({ table, mutation, values }); return q; },
      delete() { mutation = 'delete'; writes.push({ table, mutation }); return q; },
      maybeSingle: async () => ({ data: table === 'social_brands' ? brand : existing ? { id: 'existing-plan' } : null, error: null }),
      single: async () => ({ data: { id: 'new-plan' }, error: null }),
      then(resolve, reject) { return Promise.resolve({ data: table === 'social_posts' && mutation === 'insert' ? values.map((post, i) => ({ id: `post-${i}`, format: post.format })) : [], error: null }).then(resolve, reject); },
    }; return q;
  } };
  const exports = {};
  vm.runInNewContext(source, { exports, Date, Map, require(name) {
    if (name === '@/lib/social-week') return week;
    if (name === '@/lib/social-real-estate-policy') return {isRealtySocialBrand:brand=>brand.organization_id==='b15f21b4-5697-4d21-9421-8a34eae3476d'};
    if (name === '@/lib/social-realty-brand') return {realtyBrandReadiness:()=>assert.fail('Fluxknight must not use Realty brand readiness')};
    if (name === '@trigger.dev/sdk') return { tasks: { async trigger(id, payload) { queued.push({ id, payload }); if (queueFails) throw new Error('Provider unavailable'); } } };
    if (name === '@/lib/social-ai') return { async generateWeeklySocialPlan() { planned++; return { plan, model: 'test' }; } };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { run: () => exports.prepareSocialReviewWeek(db, '15046426-e520-438b-8694-7662a6986efb', weekStart), writes, queued, get planned() { return planned; } };
}
test('weekly preparation saves five unapproved drafts and only queues carousel rendering', async () => {
  const app = setup();
  const result = await app.run();
  assert.equal(result.postIds.length, 5);
  const rows = app.writes.find((w) => w.table === 'social_posts' && w.mutation === 'insert').values;
  for (const row of rows) {
    assert.equal(row.status, 'review');
    assert.equal(row.content.week_start, '2026-11-16');
    assert.equal(row.approved_at, undefined);
  }
  assert.equal(app.queued.length, 5);
  assert.ok(app.queued.every((job) => job.id === 'flux-social-render-carousel'));
});
test('an existing week is preserved without more model calls or renders', async () => {
  const app = setup({ existing: true });
  assert.equal((await app.run()).existing, true);
  assert.equal(app.planned, 0);
  assert.equal(app.writes.length, 0);
  assert.equal(app.queued.length, 0);
});
test('queue outages preserve all saved drafts and mark each failure for manual retry', async () => {
  const app = setup({ queueFails: true });
  assert.equal((await app.run()).postIds.length, 5);
  const failures = app.writes.filter((w) => w.mutation === 'update');
  assert.equal(failures.length, 5);
  assert.ok(failures.every((w) => w.values.metadata.carousel_render_status === 'queue_failed'));
  assert.equal(app.writes.some((w) => w.mutation === 'delete'), false);
});
test('unsupported weekly formats fail before saving a plan', async () => {
  const app = setup({ format: 'reel' });
  await assert.rejects(app.run(), /Instagram carousels/);
  assert.equal(app.writes.length, 0);
});

const mixedMetadata = { weekly_post_count: 7, weekly_format_mix: { effective_week_start: '2026-11-23', carousel: 4, reel: 3 } };
test('next week creates four carousels and three videos using the right media tasks', async () => {
  const app = setup({ metadata: mixedMetadata, weekStart: '2026-11-23', formats: ['carousel', 'reel', 'carousel', 'reel', 'carousel', 'reel', 'carousel'] });
  assert.equal((await app.run()).postIds.length, 7);
  assert.equal(app.queued.filter((job) => job.id === 'flux-social-render-carousel').length, 4);
  assert.equal(app.queued.filter((job) => job.id === 'flux-social-prepare-reel').length, 3);
  const posts = app.writes.find((row) => row.table === 'social_posts' && row.mutation === 'insert').values;
  for (const post of posts.filter((post) => post.format === 'reel')) {
    assert.equal(post.status, 'review');
    assert.equal(post.metadata.reel_audio_verified, false);
    assert.equal(post.metadata.reel_voice_review_status, 'pending');
  }
});
test('next week rejects seven carousels rather than silently dropping the video requirement', async () => {
  const app = setup({ metadata: mixedMetadata, weekStart: '2026-11-23', formats: Array(7).fill('carousel') });
  await assert.rejects(app.run(), /four carousels and three narrated Reels/);
  assert.equal(app.writes.length, 0);
});
test('effective date keeps this week unchanged and preserves its existing plan', async () => {
  const app = setup({ metadata: mixedMetadata, existing: true });
  assert.equal((await app.run()).existing, true);
  assert.equal(app.planned, 0);
  assert.equal(app.writes.length, 0);
});
test('failed mixed queues retain all drafts with format-specific failure states', async () => {
  const app = setup({ metadata: mixedMetadata, weekStart: '2026-11-23', formats: ['carousel', 'carousel', 'carousel', 'carousel', 'reel', 'reel', 'reel'], queueFails: true });
  assert.equal((await app.run()).postIds.length, 7);
  const updates = app.writes.filter((row) => row.mutation === 'update');
  assert.equal(updates.filter((row) => row.values.metadata.carousel_render_status === 'queue_failed').length, 4);
  assert.equal(updates.filter((row) => row.values.metadata.reel_render_status === 'failed').length, 3);
});
