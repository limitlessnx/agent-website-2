import assert from 'node:assert/strict';

const hookUrl = 'https://fluxknight.space/api/gencouv/brevo-webhook';
const events = ['request', 'delivered', 'hardBounce', 'softBounce', 'blocked', 'spam',
  'invalid', 'deferred', 'click', 'opened', 'uniqueOpened', 'unsubscribed'];

function secret(name) {
  const value = process.env[name]?.trim();
  assert.ok(value && value.length >= 32, name + ' missing or too short');
  return value;
}

async function api(url, headers, method = 'GET', body) {
  const response = await fetch(url, { method, headers: { ...headers, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(method + ' ' + new URL(url).pathname + ' returned HTTP ' + response.status);
  return response.status === 204 ? null : response.json();
}

async function configureWebhook() {
  const base = 'https://api.brevo.com/v3/webhooks';
  const headers = { 'api-key': secret('GENCOUV_BREVO_API_KEY') };
  async function matchingHooks() {
    const result = await api(base + '?type=transactional', headers);
    const matches = (result.webhooks ?? []).filter(hook => hook.url === hookUrl);
    assert.ok(matches.length <= 1, 'Multiple matching Brevo webhooks require review');
    return matches;
  }
  const [existing] = await matchingHooks();
  const configuration = { url: hookUrl, events, description: 'Gencouv transactional delivery tracking',
    auth: { type: 'bearer', token: secret('GENCOUV_BREVO_WEBHOOK_SECRET') } };
  if (existing) await api(base + '/' + existing.id, headers, 'PUT', configuration);
  else await api(base, headers, 'POST', { ...configuration, type: 'transactional' });
  const [hook] = await matchingHooks();
  assert.ok(hook && events.every(event => hook.events.includes(event) ||
    (event === 'request' && hook.events.includes('sent'))), 'Brevo event subscription readback failed');
  console.log('Verified Gencouv webhook', hook.id);
}

async function configureReconciliation() {
  const name = 'GENCOUV_BREVO_RECONCILE_SECRET';
  const base = 'https://api.trigger.dev/api/v1/projects/proj_ckweruqrgwndssqpjdvg/envvars/prod';
  const headers = { Authorization: 'Bearer ' + secret('TRIGGER_SECRET_KEY') };
  const result = await api(base + '/import', headers, 'POST', {
    variables: { [name]: secret(name) }, override: true, isSecret: true
  });
  assert.ok(result.success, 'Trigger.dev variable import failed');
  const variable = await api(base + '/' + name, headers);
  assert.equal(variable.name, name);
  console.log('Verified Gencouv reconciliation variable in Trigger.dev production');
}

if (process.env.GENCOUV_CONFIGURE_TRACKING === '1') {
  assert.equal(process.env.VERCEL_PROJECT_ID, 'prj_FrGwJ3CASajEO9GKOqbrE5QDDA3T');
  assert.equal(process.env.VERCEL_ENV, 'production');
  const results = await Promise.allSettled([configureWebhook(), configureReconciliation()]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error(result.reason.message);
      process.exitCode = 1;
    }
  }
}
