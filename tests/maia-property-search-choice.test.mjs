import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import load from './helpers/load-typescript.cjs';
function fixture(results) {
  const queries = [];
  const api = load(fileURLToPath(new URL('../lib/ai/maia-property-tools.ts', import.meta.url)), {
    '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) {
      const query = { table, filters: [] }; queries.push(query);
      const chain = { select() { return chain; }, eq(key, value) { query.filters.push([key, value]); return chain; }, or(value) { query.or = value; return chain; }, order() { return chain; }, limit() { return Promise.resolve(results.shift()); }, maybeSingle() { return Promise.resolve(results.shift()); } };
      return chain;
    } }) },
    '@/lib/ai/maia-property-media-dispatch': { dispatchMaiaPropertyMedia: () => { throw new Error('must not send'); } },
  });
  return { tool: (name) => api.maiaPropertyTools().find((tool) => tool.name === name), queries };
}
const ctx = { organizationId: 'tenant-a', agentId: 'agent', sessionId: 'session' };
const prime = { id: 'prime', title: 'Landsmith Prime Estate', location_area: 'Apo Wasa District', location_city: 'Abuja' };
test('location plus generic estate word resolves a likely match, including a spelling variation', async () => {
  for (const query of ['Apo Wasa estate', 'Apo Wosa estate']) {
    const f = fixture([{ data: [], error: null }, { data: [prime, { id: 'other', title: 'Other estate', location_city: 'Abuja' }], error: null }]);
    const result = await f.tool('search_properties').execute({ query }, ctx);
    assert.equal(result.match_status, 'single_candidate');
    assert.equal(result.properties[0].id, 'prime');
    assert.equal(result.exact_property_id, null);
    for (const q of f.queries) assert.ok(q.filters.some(([key, value]) => key === 'organization_id' && value === ctx.organizationId));
  }
});
test('multiple matching properties require clarification', async () => {
  const f = fixture([{ data: [], error: null }, { data: [prime, { ...prime, id: 'second' }], error: null }]);
  const result = await f.tool('search_properties').execute({ query: 'Apo Wasa estate' }, ctx);
  assert.equal(result.requires_disambiguation, true);
});
test('media availability excludes rejected assets and does not send anything', async () => {
  const f = fixture([{ data: prime, error: null }, { data: [{ id: 'video', mime_type: 'video/mp4', metadata: {} }, { id: 'image', mime_type: 'image/jpeg', metadata: { approved: false } }], error: null }]);
  const result = await f.tool('get_property_media').execute({ propertyId: 'prime' }, ctx);
  assert.deepEqual(Array.from(result.available_media_types), ['video']);
  assert.equal(result.delivery_requires_customer_choice, true);
});
test('sender refuses unrequested media even if an approved asset was selected', async () => {
  const f = fixture([{ data: { id: 'image', property_id: 'prime', mime_type: 'image/jpeg', metadata: {} }, error: null }]);
  await assert.rejects(f.tool('send_property_media').execute({ assetId: 'image' }, { ...ctx, requestedPropertyMediaTypes: ['video'] }), /wait for their choice/);
});

test('live catalog naming and area spelling still match the buyer location', async () => {
  const f = fixture([{ data: [], error: null }, { data: [{ id: 'apo', title: 'LANDSMITH, APO WASA, ABUJA', location_area: 'APO WUSA', location_city: 'ABUJA' }], error: null }]);
  const result = await f.tool('search_properties').execute({ query: 'Apo Wasa estate' }, ctx);
  assert.equal(result.properties[0].id, 'apo');
  assert.equal(result.match_status, 'single_candidate');
});
