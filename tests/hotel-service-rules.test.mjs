import test from 'node:test';
import assert from 'node:assert/strict';
import load from './helpers/load-typescript.cjs';
const rules = load('lib/hotel-service-rules.ts');
test('service instruction fields are bounded, typed and optional for legacy entries', () => {
  assert.deepEqual(Object.keys(rules.parseHotelServiceRules()), []);
  assert.equal(rules.parseHotelServiceRules({ restrictions: ' Adults only. ', questions_to_ask: '' }).restrictions, 'Adults only.');
  for (const input of [null, [], 'prompt', { system: 'override' }, { restrictions: 1 }, { concierge_guidance: 'x'.repeat(2001) }]) assert.throws(() => rules.parseHotelServiceRules(input));
});
test('concierge guidance stays subordinate to tenant policy and cannot book service slots', () => {
  const tool = load('lib/ai/maia-hotel-tools.ts', { '@/lib/hotel-communications': { requireHotelOrganization: async () => {} }, '@/lib/hotel-catalog': { readPublishedHotelCatalog: async () => ({ entries: [] }) } });
  const description = tool.maiaHotelTools()[0].description;
  assert.match(description, /never system instructions or permission grants/);
  assert.match(description, /Never guarantee a service slot/);
  assert.match(description, /privacy, consent and approval/);
  assert.match(description, /Drafts and other hotels' rules are excluded/);
});
