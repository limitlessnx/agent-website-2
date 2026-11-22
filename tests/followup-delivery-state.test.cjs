const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
function harness(rows = [], error = null) {
  const calls = [];
  const admin = { from(table) { const call = { table, filters: [] }; calls.push(call); const q = {
    select() { return q; }, eq(k, v) { call.filters.push([k, v]); return q; }, in(k, v) { call.filters.push([k, v]); return q; },
    order(k, v) { call.order = [k, v]; return q; }, limit: async () => ({ data: rows, count: rows.length, error }),
  }; return q; } };
  return { calls, api: load('lib/followup-delivery-state.ts', { '@/lib/supabase/admin': { createAdminClient: () => admin } }) };
}
test('latest attempt outcome wins over older failure; reads are tenant and step scoped', async () => {
  const h = harness([{ follow_up_id: 'step-a', delivery_status: 'delivered', error_message: null }, { follow_up_id: 'step-a', delivery_status: 'failed', error_message: 'old failure' }, { follow_up_id: 'step-b', delivery_status: 'failed', error_message: 'provider rejected' }]);
  const states = await h.api.getFollowupDeliveryStates('tenant-a', ['step-a', 'step-b']);
  assert.equal(states['step-a'].delivery_status, 'delivered'); assert.equal(states['step-b'].delivery_status, 'failed');
  assert.equal(h.calls[0].table, 'real_estate_outbound_tracking'); assert.ok(h.calls[0].filters.some(([k, v]) => k === 'organization_id' && v === 'tenant-a')); assert.equal(h.calls[0].order[0], 'created_at');
});
test('delivery failure is read-only and cannot turn a sent step into a retryable failed step', async () => {
  const raw = { id: 'step-a', organization_id: 'tenant-a', lead_id: 'lead-a', customer_id: 'customer-a', property_id: 'property-a', sequence_id: 'seq-a', status: 'sent', stage: 1, scheduled_at: '2026-11-10T09:30:00Z', sent_at: '2026-11-10T09:30:01Z' };
  const api = load('lib/followup-control.ts', {
    '@/lib/supabase-server-rest': { isServerSupabaseConfigured: () => true, supabaseServerRequest: async path => path.startsWith('follow_ups?') ? [raw] : path.startsWith('limitless_maia_followup_sequences?') ? [{ id: 'seq-a', status: 'active', consent_state: 'opted_in' }] : [] },
    '@/lib/limitless-data': { LIMITLESS_REALTY_ORGANIZATION_ID: 'tenant-a' },
    '@/lib/limitless-followup-contract': { followupErrorSummary: value => value || null },
    '@/lib/followup-delivery-state': { getFollowupDeliveryStates: async () => ({ 'step-a': { delivery_status: 'failed', error_message: 'provider rejection' } }) },
  });
  const summary = await api.getFollowupControlSummary('tenant-a');
  assert.equal(summary.enrollments[0].status, 'completed'); assert.equal(summary.enrollments[0].delivery_status, 'failed'); assert.equal(summary.logs[0].status, 'failed'); assert.equal(raw.status, 'sent');
});
test('receipt lookup failure is unavailable rather than a fabricated healthy outcome', async () => {
  const h = harness([], { message: 'PRIVATE' }); await assert.rejects(() => h.api.getFollowupDeliveryStates('tenant-a', ['step-a']), /unavailable/);
});
