import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('src/trigger/social-reel-preparation.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({ status = 'review', ready = false, active = true, renderOk = true } = {}) {
  const writes = [], renders = [], filters = [];
  let storyboards = 0;
  const post = { id: 'post', organization_id: 'organization', brand_id: 'brand', format: 'reel', status, metadata: ready ? { reel_render_status: 'ready', reel_asset_id: 'asset' } : { retained: true } };
  const db = { from(table) { let update;
    const q = { select() { return q; }, eq(key, value) { filters.push({ table, key, value }); return q; }, in() { return q; },
      update(value) { update = value; writes.push(value); return q; },
      async single() { return { data: table === 'social_posts' ? post : table === 'organizations' ? { status: active ? 'active' : 'suspended' } : { id: 'brand' }, error: null }; },
      async maybeSingle() { return { data: update ? { id: 'post' } : post, error: null }; },
      then(resolve, reject) { return Promise.resolve({ data: null, error: null }).then(resolve, reject); },
    }; return q;
  } };
  const exports = {};
  vm.runInNewContext(source, { exports, Date, require(name) {
    if (name === '@trigger.dev/sdk') return { task: (definition) => definition, AbortTaskRunError: class extends Error {} };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => db };
    if (name === '@/lib/social-video-plan-core') return { async generateReelStoryboard() { storyboards++; return { plan: { scenes: [{ voiceover: 'Narration' }] }, model: 'test' }; } };
    if (name === './social-reel-renderer') return { fluxSocialRenderReel: { async triggerAndWait(payload) { renders.push(payload); return renderOk ? { ok: true } : { ok: false, error: 'Renderer offline' }; } } };
    throw new Error(name);
  } });
  return { run: () => exports.fluxSocialPrepareReel.run({ organizationId: 'organization', postId: 'post' }), writes, renders, filters, get storyboards() { return storyboards; } };
}
test('unapproved weekly videos receive storyboards then the existing narrated renderer', async () => {
  const app = setup();
  assert.equal((await app.run()).rendered, true);
  assert.equal(app.storyboards, 1);
  assert.equal(app.renders.length, 1);
  assert.equal(app.renders[0].organizationId, 'organization');
  assert.equal(app.writes[0].approved_at, null);
  assert.equal(app.writes[0].metadata.reel_voice_review_status, 'pending');
  assert.equal(app.writes[0].metadata.reel_audio_verified, false);
  assert.equal(app.writes[0].metadata.retained, true);
  assert.ok(app.filters.some((filter) => filter.table === 'social_brands' && filter.key === 'organization_id'));
});
test('scheduled, published, approved and suspended posts are never rendered', async () => {
  for (const options of [{ status: 'scheduled' }, { status: 'published' }, { status: 'approved' }, { active: false }]) {
    const app = setup(options);
    await assert.rejects(app.run());
    assert.equal(app.renders.length, 0);
    assert.equal(app.writes.length, 0);
  }
});
test('completed videos are retained without duplicate narration or renders', async () => {
  const app = setup({ ready: true });
  assert.equal((await app.run()).existing, true);
  assert.equal(app.storyboards, 0);
  assert.equal(app.renders.length, 0);
});
test('renderer failure is visible in review while existing metadata is retained', async () => {
  const app = setup({ renderOk: false });
  await assert.rejects(app.run(), /Weekly video render failed/);
  assert.equal(app.writes.at(-1).metadata.reel_render_status, 'failed');
  assert.equal(app.writes.at(-1).metadata.retained, true);
});
