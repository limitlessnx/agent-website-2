/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const org = '05737e03-f8f0-4202-8e9b-0a8982a1091c';
const batch = 'bbbbbbbb-1111-4111-8111-111111111111';
const senders = ['marketing@first.example.test', 'news@second.example.test'];
const env = {
  GENCOUV_BREVO_API_KEY: 'synthetic',
  GENCOUV_BREVO_SENDING_ENABLED: 'true',
  GENCOUV_BREVO_DELIVERY_VERIFIED: 'true',
  GENCOUV_BREVO_WEBHOOK_SECRET: 'synthetic-secret-'.repeat(3),
  GENCOUV_UNSUBSCRIBE_SECRET: 'synthetic',
  GENCOUV_BREVO_RECONCILE_SECRET: 'synthetic-cron-'.repeat(3),
};

function brevo(fetch) {
  return load(path.resolve('lib/gencouv-brevo.ts'), { 'server-only': {} }, '', {
    fetch, AbortSignal, URL, process: { env },
  });
}

function readiness(fetch, overrides = {}) {
  return load(path.resolve('lib/gencouv-brevo-readiness.ts'), {
    'server-only': {},
    '@/lib/gencouv-admin': { GENCOUV_CAMPAIGN_KEY: 'gencouv_long_form_copy_trading', GENCOUV_EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    '@/lib/gencouv-brevo': brevo(fetch),
  }, '', { fetch, AbortSignal, URL, process: { env: { ...env, ...overrides } } });
}

const db = {
  from(table) {
    return {
      select() { return this; },
      eq(column, value) {
        if (column === 'organization_id') assert.equal(value, org);
        return this;
      },
      gte() { return this; },
      not() { return { data: [{ provider: 'brevo', recipient_count: 50 }, { provider: 'resend', recipient_count: 25 }] }; },
      maybeSingle() { return { data: { metadata: { brevo_approved_senders: [...senders, 'info@gencouv.com'] } } }; },
    };
  },
};

test('Brevo readiness intersects tenant approval, active senders and verified domains and budgets across domains', async () => {
  const fetch = async url => {
    if (url.endsWith('/account')) return Response.json({ relay: { enabled: true }, plan: [{ creditsType: 'sendLimit', credits: 190 }] });
    if (url.endsWith('/senders')) return Response.json({ senders: [...senders, 'unrelated@first.example.test'].map(email => ({ email, active: true })) });
    assert.match(url, /\/senders\/domains$/);
    return Response.json({ domains: [
      { domain_name: 'first.example.test', authenticated: true, verified: true },
      { domain_name: 'second.example.test', authenticated: false, verified: true },
    ] });
  };
  const result = await readiness(fetch).readGencouvBrevoReadiness(db, org);
  assert.deepEqual([...result.verifiedSenders], [senders[0]]);
  assert.equal(result.sendingAvailable, true);
  assert.equal(result.remaining, 140);
  assert.equal(result.resendUsed, 25);
  assert.equal((await readiness(fetch, { GENCOUV_BREVO_SENDING_ENABLED: 'false' }).readGencouvBrevoReadiness(db, org)).sendingAvailable, false);
  const controlled = await readiness(fetch, {
    GENCOUV_BREVO_DELIVERY_VERIFIED: 'false', GENCOUV_BREVO_TEST_RECIPIENTS: 'authorized@example.test',
  }).readGencouvBrevoReadiness(db, org);
  assert.equal(controlled.testOnly, true);
  assert.equal(controlled.sendingAvailable, true);
  const refused = await readiness(async () => new Response(null, { status: 401 })).readGencouvBrevoReadiness(db, org);
  assert.equal(refused.note, 'Authentication failed');
  const disconnected = await readiness(() => assert.fail('should not fetch'), { GENCOUV_BREVO_API_KEY: '' }).readGencouvBrevoReadiness(db, org);
  assert.equal(disconnected.note, 'Disconnected');
});

test('Brevo batch uses recipient-specific HTTPS links and leaves returned IDs unbound', async () => {
  let calls = 0;
  const api = brevo(async (_url, init) => {
    calls++;
    const payload = JSON.parse(init.body);
    assert.equal(payload.headers.idempotencyKey, batch);
    assert.deepEqual(payload.tags, ['gencouv-' + batch]);
    assert.equal(payload.messageVersions.length, 2);
    payload.messageVersions.forEach((version, index) => {
      assert.match(version.htmlContent, /Hello &lt;test&gt;/);
      assert.match(version.htmlContent, /<a href="https:/);
      assert.ok(version.htmlContent.includes('message=synthetic' + index + '&amp;token=mock'));
    });
    return Response.json({ messageIds: ['second', 'first'] }, { status: 201 });
  });
  const emails = [0, 1].map(index => ({
    from: senders[0], to: `synthetic${index}@example.test`, subject: 'Synthetic',
    text: 'Hello <test>', unsubscribeUrl: `https://example.test/api/gencouv/unsubscribe?message=synthetic${index}&token=mock`,
  }));
  const result = await api.submitGencouvBrevoBatch(emails, batch);
  assert.equal(result.outcome, 'unknown');
  assert.deepEqual([...result.receiptIds], [null, null]);
  assert.match(result.summary, /accepted batch/);
  await api.submitGencouvBrevoBatch([{ ...emails[0], unsubscribeUrl: 'javascript:alert(1)' }], batch);
  assert.equal(calls, 1);
});
