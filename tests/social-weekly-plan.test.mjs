import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync('lib/social-weekly-plan.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function setup({ existing = false, queueFails = false, format = 'carousel' } = {}) {
  const writes = [], queued = [];
  const brand = { id: 'a330b65a-d5b2-45f3-b211-451616f2fa8d', visual_rules: {}, metadata: {}, name: 'Fluxknight' };
  const plan = { strategy_summary: 'Strategy', weekly_objective: 'Bookings', audience_angle: 'Owners', posts: Array.from({ length: 5 }, (_, i) => ({ title: `Post ${i}`, hook: 'Hook', caption: 'Caption', cta: 'Talk to Leo', content_pillar: 'Industry', objective: 'Bookings', creative_brief: 'Brief', format, platforms: ['instagram'] })) };
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
    if (name === '@trigger.dev/sdk') return { tasks: { async trigger(id, payload) { queued.push({ id, payload }); if (queueFails) throw new Error('Provider unavailable'); } } };
    if (name === '@/lib/social-ai') return { async generateWeeklySocialPlan() { planned++; return { plan, model: 'test' }; } };
    throw new Error(`Unexpected dependency: ${name}`);
  } });
  return { run: () => exports.prepareSocialReviewWeek(db, '15046426-e520-438b-8694-7662a6986efb', '2026-11-16'), writes, queued, get planned() { return planned; } };
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
