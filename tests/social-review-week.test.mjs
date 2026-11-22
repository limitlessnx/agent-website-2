import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('src/trigger/social-review-week.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function setup({ enabled = true, active = true, metricsFail = false } = {}) {
  const filters = [], prepared = [];
  const exports = {};
  const db = { from(table) { const q = { select() { return q; }, eq(key, value) { filters.push({ table, key, value }); return q; }, async single() { return { data: table === 'social_brands' ? { metadata: { weekly_review_enabled: enabled } } : { status: active ? 'active' : 'suspended' }, error: null }; } }; return q; } };
  vm.runInNewContext(source, { exports, require(name) {
    if (name === '@trigger.dev/sdk') return { logger: { info() {}, warn() {} }, task: (definition) => definition, schedules: { task: (definition) => definition } };
    if (name === '@/lib/supabase/admin') return { createAdminClient: () => db };
    if (name === '@/lib/social-weekly-plan') return { prepareSocialReviewWeek: async (...args) => { prepared.push(args); return { postIds: ['draft'] }; } };
    if (name === '@/lib/social-realty-week-status') return {refreshRealtyWeekStatus:()=>assert.fail('Fluxknight must not update Realty status')};
    if (name === '@/lib/social-real-estate-policy') return {REALTY_SOCIAL_ORGANIZATION:'b15f21b4-5697-4d21-9421-8a34eae3476d',isRealtySocialBrand:()=>false};
    if (name === '@/lib/social-week') return { validSocialWeek:()=>true, socialWeekStart: () => '2026-11-16' };
    if (name === '@/lib/social-meta-sync') return { runMetaAnalyticsSync: async () => { if (metricsFail) throw new Error('Offline'); return { collected: {}, ingestion: { status: 'succeeded' } }; } };
    throw new Error(name);
  } });
  return { exports, filters, prepared };
}
test('disabled brands and suspended organizations create no weekly posts', async () => {
  for (const options of [{ enabled: false }, { active: false }]) {
    const app = setup(options);
    assert.equal((await app.exports.fluxSocialPrepareReviewWeek.run()).skipped, true);
    assert.equal(app.prepared.length, 0);
  }
});
test('analytics failure still prepares review drafts scoped to Fluxknight only', async () => {
  const app = setup({ metricsFail: true });
  await app.exports.fluxSocialPrepareReviewWeek.run();
  assert.equal(app.prepared.length, 1);
  assert.equal(app.prepared[0][1], '15046426-e520-438b-8694-7662a6986efb');
  assert.equal(app.prepared[0][3], 'a330b65a-d5b2-45f3-b211-451616f2fa8d');
  assert.ok(app.filters.some((f) => f.table === 'social_brands' && f.key === 'organization_id'));
  assert.equal(app.exports.fluxSocialMondayReview.cron.pattern, '0 7 * * 1');
  assert.equal(app.exports.fluxSocialMondayReview.cron.environments[0], 'PRODUCTION');
});
