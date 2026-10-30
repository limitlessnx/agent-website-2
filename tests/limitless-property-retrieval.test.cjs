const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

function fixture(rows, error = null) {
  const calls = [];
  const q = { select(v) { calls.push(['select',v]); return this; }, eq(k,v) { calls.push(['eq',k,v]); return this; }, order() { return this; }, limit() { return Promise.resolve({ data: rows, error }); } };
  const module = load('lib/ai/limitless-realty-maia.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => ({ from: table => { calls.push(['from',table]); return q; } }) },
    '@/lib/whatsapp-delivery': { sendWhatsAppMessage: () => { throw new Error('Must not send'); } },
    '@/lib/flux-credits': { assertFluxFeatureAccess: async () => {} },
    '@/lib/limitless-followup-contract': {},
    '@/lib/follow-up-policy': {},
    '@/lib/canonical-customer': {},
    '@/lib/human-operations': {},
  });
  return { module, calls };
}

test('property preflight binds live lookup to the explicit tenant', async () => {
  const { module, calls } = fixture([{ id:'p1',organization_id:'tenant-a',title:'Verified duplex',status:'active',price:'N10,000,000' }, { id:'p2',organization_id:'tenant-b',title:'Other tenant',status:'active' }]);
  const result = await module.searchLimitlessProperties('duplex', 'tenant-a');
  assert.deepEqual(calls.find(c => c[0] === 'eq'), ['eq','organization_id','tenant-a']);
  assert.deepEqual(Array.from(result.matches, x => x.id), ['p1']);
});

test('inactive, sold, unknown and missing statuses are not available listings', async () => {
  const statuses = ['inactive','sold','unknown',undefined,'available',' ACTIVE ','for sale','ready'];
  const { module } = fixture(statuses.map((status,i) => ({id:String(i),organization_id:'tenant-a',title:'Property '+i,status})));
  const result = await module.searchLimitlessProperties('property', 'tenant-a');
  assert.deepEqual(Array.from(result.matches,x=>x.id), ['4','5','6','7']);
});

test('database failures are surfaced rather than replaced by seed listings', async () => {
  const { module } = fixture([], new Error('Database unavailable'));
  await assert.rejects(module.searchLimitlessProperties('property', 'tenant-a'), /Database unavailable/);
});

test('missing tenant fails before database lookup', async () => {
  const { module, calls } = fixture([]);
  await assert.rejects(module.searchLimitlessProperties('property', ''), /explicit organization/);
  assert.equal(calls.length, 0);
});
