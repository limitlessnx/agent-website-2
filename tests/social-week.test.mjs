import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/social-week.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
test('Sunday belongs to the preceding Monday and year boundaries work', () => {
  assert.equal(exports.socialWeekStart(new Date('2026-11-22T23:59:59Z')), '2026-11-16');
  assert.equal(exports.socialWeekStart(new Date('2026-11-23T00:00:00Z')), '2026-11-23');
  assert.equal(exports.socialWeekStart(new Date('2027-01-01T12:00:00Z')), '2026-12-28');
});
test('week selectors reject non-Mondays and impossible dates', () => {
  assert.equal(exports.validSocialWeek('2026-11-16'), true);
  for (const value of ['2026-11-17', '2026-02-30', 'invalid', ['2026-11-16'], null]) assert.equal(exports.validSocialWeek(value), false);
});

test('seven is opt-in per brand and unsupported counts keep the five-post default', () => {
  assert.equal(exports.socialWeeklyPostCount({ weekly_post_count: 7 }), 7);
  for (const metadata of [{}, undefined, { weekly_post_count: 99 }, { weekly_post_count: "7" }]) assert.equal(exports.socialWeeklyPostCount(metadata), 5);
});
