/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
function statusService(fetch, env = { LIMITLESS_SUPABASE_URL: 'https://synthetic.invalid', LIMITLESS_SUPABASE_SERVICE_ROLE_KEY: 'synthetic' }) {
  return load('lib/whatsapp-status-log.ts', {}, '', { fetch, process: { env } });
}
for (const [name, fetch, env] of [
  ['missing configuration', async () => { throw Error('must not fetch'); }, {}],
  ['HTTP failure', async () => ({ ok: false, text: () => { throw Error('must not disclose response'); } })],
  ['network failure', async () => { throw Error('PRIVATE_NETWORK_DETAILS'); }],
  ['invalid JSON', async () => ({ ok: true, json: async () => { throw Error('PRIVATE_RESPONSE'); } })],
  ['invalid row collection', async () => ({ ok: true, json: async () => ({ message: 'PRIVATE_RESPONSE' }) })],
  ['invalid content', async () => ({ ok: true, json: async () => [{ id: 'a', content: '{invalid' }] })],
]) test(`${name} blocks cooldown evaluation with a sanitized unavailable error`, async () => {
  const service = statusService(fetch, env);
  await assert.rejects(service.getMetaCooldownPhones(['15555550123']), error => {
    assert.equal(error.message, 'WhatsApp delivery evidence is unavailable. Retry when status access is restored.');
    return true;
  });
});
test('confirmed empty data and an empty audience remain distinct from unavailable evidence', async () => {
  let calls = 0;
  const service = statusService(async () => { calls++; return { ok: true, json: async () => [] }; });
  assert.equal((await service.getMetaCooldownPhones([])).size, 0); assert.equal(calls, 0);
  assert.equal((await service.getMetaCooldownPhones(['15555550123'])).size, 0); assert.equal(calls, 1);
});
test('valid provider-block evidence retains existing cooldown behavior', async () => {
  const service = statusService(async () => ({ ok: true, json: async () => [{ id: 'a', created_at: new Date().toISOString(), content: JSON.stringify({ recipient_id: '15555550123', message_id: 'synthetic', status: 'failed', error_code: '131049' }) }] }));
  const result = await service.getMetaCooldownPhones(['+1 (555) 555-0123']);
  assert.equal(result.size, 1); assert.equal(result.get('15555550123').error_code, '131049');
});
