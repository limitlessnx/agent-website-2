import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import load from './helpers/load-typescript.cjs';

function client(response) {
  const requests = [];
  const api = load(fileURLToPath(new URL('../lib/limitless-data.ts', import.meta.url)), {}, '', {
    process: { env: { LIMITLESS_SUPABASE_URL: 'https://supabase.invalid', LIMITLESS_SUPABASE_SERVICE_ROLE_KEY: 'test-only' } },
    fetch: async (url, options) => { requests.push({ url, options }); return response; },
  });
  return { api, requests };
}

test('property DELETE accepts a successful empty 204 response and retains tenant scope', async () => {
  const c = client({ ok: true, status: 204, json: async () => { throw new SyntaxError('Unexpected end of JSON input'); } });
  const result = await c.api.deleteProperty('property-1', 'org-1');
  assert.equal(result.length, 0);
  assert.equal(c.requests.length, 1);
  assert.equal(c.requests[0].options.method, 'DELETE');
  const url = new URL(c.requests[0].url);
  assert.equal(url.searchParams.get('id'), 'eq.property-1');
  assert.equal(url.searchParams.get('organization_id'), 'eq.org-1');
});

test('database rejection is preserved rather than reported as a successful delete', async () => {
  const c = client({ ok: false, status: 409, text: async () => '{"code":"23503","message":"foreign key constraint"}' });
  await assert.rejects(c.api.deleteProperty('property-1', 'org-1'), /23503/);
});

test('missing property ID fails before making a request', async () => {
  const c = client({ ok: true, status: 204 });
  await assert.rejects(c.api.deleteProperty('', 'org-1'), /Property ID is missing/);
  assert.equal(c.requests.length, 0);
});

test('normal catalog reads still decode JSON', async () => {
  const c = client({ ok: true, status: 200, json: async () => [{ id: 'property-1', title: 'Estate' }] });
  const rows = await c.api.getProperties(10, 'org-1');
  assert.equal(rows[0].title, 'Estate');
});
