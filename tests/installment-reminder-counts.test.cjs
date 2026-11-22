const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

function harness(fail = false, missingCount = false) {
  const calls = [];
  const admin = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const q = { select(fields, options) { call.options = options; return q; },
      eq(key, value) { call.filters.push([key, value]); return q; }, gt(key, value) { call.filters.push([key, value]); return q; },
      then(resolve, reject) {
        const status = call.filters.find(([key]) => key === 'status')?.[1];
        const count = table === 'payment_plans' ? 5 : { pending: 2, sent: 1205, failed: 4, unknown: 1 }[status];
        return Promise.resolve({ data: null, count: missingCount ? null : count, error: fail ? { message: 'PRIVATE' } : null }).then(resolve, reject);
      } };
    return q;
  } };
  return { calls, api: load('lib/installment-reminder-counts.ts', { '@/lib/supabase/admin': { createAdminClient: () => admin } }) };
}
test('exact reminder counts remain complete beyond list limits and distinguish accepted from delivered', async () => {
  const h = harness(); const result = await h.api.getInstallmentReminderCounts('tenant-a');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { activePlans: 5, pending: 2, accepted: 1205, failed: 4, unknown: 1 });
  for (const call of h.calls) { assert.equal(call.options.count, 'exact'); assert.equal(call.options.head, true); assert.ok(call.filters.some(([key, value]) => key === 'organization_id' && value === 'tenant-a')); }
  const filters = h.calls[0].filters;
  for (const pair of [['payment_type', 'installment'], ['status', 'active'], ['reminders_enabled', true], ['outstanding_balance', 0]]) assert.ok(filters.some(([key, value]) => key === pair[0] && value === pair[1]));
});
test('missing counts, database failures and missing context never become zero', async () => {
  for (const h of [harness(true), harness(false, true)]) await assert.rejects(() => h.api.getInstallmentReminderCounts('tenant-a'), /temporarily unavailable/);
  const h = harness(); await assert.rejects(() => h.api.getInstallmentReminderCounts(''), /context/); assert.equal(h.calls.length, 0);
});
