const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const normalizer = load(path.resolve('lib/whatsapp-message-normalizer.ts'));
const contract = { name: 'reminder', language: 'en_US', body: 'Hello {{1}}, {{2}} {{3}} {{4}} — Realty', keys: ['customer_name', 'followup_context', 'property_details', 'next_step'] };
const valid = { followup_context: 'Checking in about your enquiry.', property_details: 'The estate offer is 25% off.', next_step: 'Reply to discuss your options.' };
function service(options = {}) {
  const state = { models: [], credits: [], calls: [] };
  const api = load(path.resolve('lib/campaign-ai-writeup.ts'), {
    '@/lib/ai-runtime/model-router': { routeRuntimeModel: async input => { state.models.push(input); return { provider: 'openai', modelKey: 'test' }; } },
    '@/lib/flux-credits': { reserveFluxCredits: async input => { state.credits.push(input); if (options.noCredits) throw Error('denied'); } },
    '@/lib/ai-runtime/provider': { generateRuntimeStructuredOutput: async input => { state.calls.push(input); return { parsed: options.parsed || { variables: options.variables || valid } }; } },
    '@/lib/whatsapp-message-normalizer': normalizer,
  });
  return { api, state };
}
const input = { mode: 'improve', brief: 'Tell them about the offer: 25% off.', variables: {} };

test('AI writes only editable values under the authenticated tenant, with a credit reservation and strict schema', async () => {
  const h = service();
  const result = await h.api.createCampaignWriteup('tenant-a', contract, input);
  assert.equal(result.status, 'draft'); assert.equal(result.variables.property_details, valid.property_details);
  assert.equal(h.state.models[0].identity.organizationId, 'tenant-a'); assert.equal(h.state.models[0].identity.scope, 'tenant');
  assert.equal(h.state.credits[0].organizationId, 'tenant-a'); assert.equal(h.state.credits[0].action, 'web_ai');
  const request = h.state.calls[0]; assert.equal(request.outputSchema.properties.variables.additionalProperties, false);
  assert.ok(!request.outputSchema.properties.variables.required.includes('customer_name'));
  assert.equal(request.input.template.fixedBody, contract.body); assert.match(request.systemPrompt, /Never modify fixed template wording/);
});
test('estate facts cannot be rewritten and forged customer names never reach existing text', async () => {
  const h = service({ variables: { selling_point: 'Reply to learn more.' } });
  await h.api.createCampaignWriteup('a', { name: 'estate', language: 'en', body: '{{1}} {{2}} {{3}} {{4}} {{5}}', keys: ['customer_name', 'property_name', 'property_location', 'property_price', 'selling_point'] }, { mode: 'generate', brief: 'Invite an enquiry.', variables: { customer_name: 'Forged', property_price: 'Fake' } }, { property_name: 'Verified estate', property_location: 'Benin', property_price: 'N650,000' });
  assert.deepEqual(Object.keys(h.state.calls[0].input.existing), ['selling_point']);
  assert.equal(h.state.calls[0].input.verifiedFacts.property_price, 'N650,000');
});
test('invalid input and broken template contracts fail before model usage or billing', async () => {
  const h = service();
  for (const body of [null, {}, { mode: 'send', brief: 'Hi' }, { mode: 'generate', brief: '' }, { mode: 'generate', brief: 'x'.repeat(4001) }, { mode: 'generate', brief: 'Hi', variables: { message: 1 } }]) assert.throws(() => h.api.parseWriteupInput(body));
  for (const body of ['', '{{8}}', '{{1}} {{2}}']) await assert.rejects(h.api.createCampaignWriteup('a', { ...contract, body }, input), /template/);
  assert.equal(h.state.calls.length, 0); assert.equal(h.state.credits.length, 0);
});
test('unknown, missing, empty, non-string, oversized and unfilled AI fields are rejected', async () => {
  for (const variables of [{ ...valid, customer_name: 'Ada' }, { followup_context: 'Hi' }, { ...valid, next_step: '' }, { ...valid, next_step: 12 }, { ...valid, next_step: 'x'.repeat(1025) }, { ...valid, next_step: '{{response}}' }]) {
    await assert.rejects(service({ variables }).api.createCampaignWriteup('a', contract, input), /AI returned/);
  }
});
test('AI cannot add a numeric offer or remove the author’s discount', async () => {
  for (const variables of [{ ...valid, property_details: 'Offer is 50% off.' }, { ...valid, property_details: 'A property offer is available.' }])
    await assert.rejects(service({ variables }).api.createCampaignWriteup('a', contract, input), /changed a number or offer/);
  const h = service({ noCredits: true }); await assert.rejects(h.api.createCampaignWriteup('a', contract, input)); assert.equal(h.state.calls.length, 0);
});
test('line breaks and extra spaces normalize without silent truncation', async () => {
  const h = service({ variables: { ...valid, next_step: ' Reply\n  to discuss\toptions. ' } });
  assert.equal((await h.api.createCampaignWriteup('a', contract, input)).variables.next_step, 'Reply to discuss options.');
});
test('Xposure business name is filled from server facts, not invented or rewritten by AI', async () => {
  const h = service({ variables: { enquiry_type: 'your portrait session' } });
  const result = await h.api.createCampaignWriteup('a', { name: 'studio', language: 'en', body: 'Hello {{1}}, about {{2}} at {{3}}.', keys: ['customer_name', 'enquiry_type', 'business_name'] }, { mode: 'generate', brief: 'Follow up about their portrait session.', variables: { business_name: 'Forged business' } }, { business_name: 'Xposure Studios' });
  assert.equal(result.variables.business_name, 'Xposure Studios');
  assert.deepEqual(Object.keys(h.state.calls[0].input.existing), ['enquiry_type']);
});

function routeHarness(kind, options = {}) {
  const s = service(); const state = { filters: [], loads: [], drafts: [], gates: [] };
  const template = { name: 'limitless_realty_reminder', language: 'en_US', purpose: kind === 'portal' ? 'customer_follow_up' : 'follow_up_outside_24h', body: contract.body, variable_keys: contract.keys };
  const shared = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
    '@/lib/campaign-ai-writeup': { ...s.api, createCampaignWriteup: async (...args) => { state.drafts.push(args); return { status: 'draft', variables: valid }; } },
    '@/lib/flux-credits': { assertFluxFeatureAccess: async org => { state.gates.push(org); if (options.noPlan) throw Error('denied'); } },
    '@/lib/portal-campaign-templates': { CampaignTemplateError: class extends Error {}, loadLinkedCampaignTemplates: async (...args) => { state.loads.push(args); return { templates: options.noTemplate ? [] : [{ ...template, ...(options.template || {}) }] }; } },
    '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) { return { select() { return this; }, eq(k, v) { state.filters.push([table, k, v]); return this; }, single: async () => ({ data: { slug: options.otherTenant ? 'hotel' : 'xposure', status: options.inactive ? 'inactive' : 'active' } }), maybeSingle: async () => ({ data: options.missingProperty ? null : { title: 'Estate', location_city: 'Benin', price: 'N650,000' } }) }; } }) },
  };
  const mocks = kind === 'portal' ? {
    '@/lib/client-auth': { getClientSession: async () => options.anonymous ? null : { organizationId: 'tenant-a' } },
    '@/lib/portal-access': { requirePortalPermission: async (_session, permissions) => { assert.deepEqual(Array.from(permissions), ['conversations.reply']); if (options.denied) throw Error('denied'); } },
  } : {
    '@/lib/admin-auth': { getAdminSession: async () => options.anonymous ? null : { email: 'admin@example.test' } },
    '@/lib/admin-organization-scope': { resolveAdminOrganizationScope: async () => ({ organizationId: options.otherTenant ? 'other' : 'tenant-a', slug: 'limitless-realty', status: options.inactive ? 'inactive' : 'active' }) },
    '@/lib/limitless-followup-contract': { LIMITLESS_REALTY_ORGANIZATION_ID: 'tenant-a' },
  };
  const route = load(path.resolve(`app/api/${kind === 'portal' ? 'portal' : 'limitless'}/campaigns/writeup/route.ts`), { ...shared, ...mocks });
  const request = extra => ({ json: async () => ({ ...input, campaignType: 'limitless_realty_reminder', templateName: template.name, language: template.language, templatePurpose: template.purpose, organizationId: 'forged', body: 'forged template', ...extra }) });
  return { route, state, request };
}
for (const kind of ['limitless']) {
  test(`${kind}: anonymous, inactive, and other workspaces cannot draft`, async () => {
    for (const [options, status] of [[{ anonymous: true }, 401], [{ inactive: true }, 403], [{ otherTenant: true }, 403], ...(kind === 'portal' ? [[{ denied: true }, 403]] : [])]) {
      const h = routeHarness(kind, options); assert.equal((await h.route.POST(h.request())).status, status); assert.equal(h.state.drafts.length, 0);
    }
  });
  test(`${kind}: uses server tenant and approved template, ignores forged scope/body and returns an unsent draft`, async () => {
    const h = routeHarness(kind); const result = await h.route.POST(h.request());
    assert.equal(result.status, 200); assert.equal(result.body.status, 'draft'); assert.match(result.headers['Cache-Control'], /no-store/);
    assert.equal(h.state.loads[0][0], 'tenant-a'); assert.equal(h.state.drafts[0][0], 'tenant-a'); assert.equal(h.state.drafts[0][1].body, contract.body);
  });
  test(`${kind}: missing template, invalid input and plan failures never call AI`, async () => {
    for (const [options, extra, status] of [[{ noTemplate: true }, {}, 409], [{ noPlan: true }, {}, 503], [{}, { brief: 'x'.repeat(4001) }, 400]]) {
      const h = routeHarness(kind, options); assert.equal((await h.route.POST(h.request(extra))).status, status); assert.equal(h.state.drafts.length, 0);
    }
  });
}
test('Limitless property lookup is tenant scoped, rejects missing properties and changed field order', async () => {
  const h = routeHarness('limitless'); assert.equal((await h.route.POST(h.request({ propertyId: '10000000-0000-4000-8000-000000000001' }))).status, 200);
  assert.ok(h.state.filters.some(([table, key, value]) => table === 'properties' && key === 'organization_id' && value === 'tenant-a'));
  assert.equal(h.state.drafts[0][3].property_price, 'N650,000');
  const missing = routeHarness('limitless', { missingProperty: true }); assert.equal((await missing.route.POST(missing.request({ propertyId: '10000000-0000-4000-8000-000000000001' }))).status, 404);
  const changed = routeHarness('limitless', { template: { variable_keys: ['customer_name', 'wrong'] } }); assert.equal((await changed.route.POST(changed.request())).status, 409);
});
