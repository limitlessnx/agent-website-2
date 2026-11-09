const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const org = 'b15f21b4-5697-4d21-9421-8a34eae3476d';

function payments(accepted, receipts, explicit = []) {
  const requests = [];
  const module = load('lib/limitless-payments.ts', {
    '@/lib/supabase-server-rest': { supabaseServerRequest: async (url, options) => {
      assert.equal(options, undefined, 'evidence loading must never mutate production');
      assert.ok(url.includes(`organization_id=eq.${org}`));
      requests.push(url);
      if (url.startsWith('whatsapp_delivery_attempts?')) return receipts;
      return url.includes('status=eq.sent') ? accepted : explicit;
    } },
  });
  return { ...module, requests };
}

test('the five accepted catch-up messages expose four billing failures and exclude the delivered recipient', async () => {
  const accepted = Array.from({ length: 5 }, (_, i) => ({ id: `attempt-${i}`, status: 'sent', scheduled_for: '2026-10-31T18:30:00Z', provider_reference: `wamid.${i}+/=` }));
  const receipts = accepted.map((a, i) => ({ provider_message_id: a.provider_reference, status: i === 0 ? 'delivered' : 'failed', error_code: i === 0 ? null : '131042', error_message: 'Business eligibility payment issue' }));
  const api = payments(accepted, receipts);
  const rows = await api.getReminderAttempts(org);
  assert.equal(rows.length, 4);
  assert.ok(rows.every(row => row.id !== 'attempt-0' && row.status === 'sent' && /billing eligibility/.test(row.retry_block_reason)));
  assert.ok(rows.every(row => row.error_message.includes('131042')));
  const query = new URLSearchParams(api.requests[2].split('?')[1]);
  assert.equal(query.get('provider_message_id'), `in.(${accepted.map(a => JSON.stringify(a.provider_reference)).join(',')})`);
});

test('a positive receipt prevents a duplicate failed entry from reopening the delivered message', async () => {
  const api = payments([{ id: 'a', status: 'sent', scheduled_for: '2026-10-31', provider_reference: 'wamid.a' }], [
    { provider_message_id: 'wamid.a', status: 'failed', error_code: '131042' },
    { provider_message_id: 'wamid.a', status: 'read', error_code: null },
  ]);
  assert.equal((await api.getReminderAttempts(org)).length, 0);
});

test('accepted and unknown outcomes are never presented as confirmed failures', async () => {
  const api = payments([{ id: 'a', status: 'sent', scheduled_for: '2026-10-31', provider_reference: 'wamid.a' }], [{ provider_message_id: 'wamid.a', status: 'accepted' }]);
  assert.equal((await api.getReminderAttempts(org)).length, 0);
});

test('receipt lookup failures remain visible as unavailable evidence instead of an empty success result', async () => {
  const api = load('lib/limitless-payments.ts', { '@/lib/supabase-server-rest': { supabaseServerRequest: async url => {
    if (url.startsWith('whatsapp_delivery_attempts')) throw new Error('receipt lookup unavailable');
    return url.includes('status=eq.sent') ? [{ provider_reference: 'wamid.a' }] : [];
  } } });
  await assert.rejects(api.getReminderAttempts(org), /receipt lookup unavailable/);
});

test('other organizations retain the existing scoped query without loading Limitless receipts', async () => {
  let calls = 0;
  const api = load('lib/limitless-payments.ts', { '@/lib/supabase-server-rest': { supabaseServerRequest: async url => {
    calls++;
    assert.ok(url.includes('organization_id=eq.other-org'));
    return [{ id: 'legacy-failure' }];
  } } });
  assert.equal((await api.getReminderAttempts('other-org'))[0].id, 'legacy-failure');
  assert.equal(calls, 1);
});
