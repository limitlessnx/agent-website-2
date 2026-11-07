const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const json = (body, { status = 200 } = {}) => ({ body, status });

function harness(options = {}) {
  const filters = []; const sent = [];
  const admin = { from(table) {
    const query = { select() { return this; }, eq(key, value) { filters.push([table, key, value]); return this; }, in() { return this; },
      single: async () => ({ data: { status: 'active', slug: 'xposure', metadata: {} } }),
      maybeSingle: async () => table === 'tenant_customer_contacts'
        ? { data: { whatsapp_consent: options.consent || 'opted_in' }, error: options.consentError }
        : { data: { industry: 'photography-studio' } },
      then(resolve) { return Promise.resolve({ data: table === 'crm_customers' ? options.crm || [] : [{ id: 'contact-a', full_name: 'Ada', phone: '+2348000000000' }] }).then(resolve); }
    }; return query;
  } };
  const route = load(path.join(root, 'app/api/portal/campaigns/send/route.ts'), {
    'next/server': { NextResponse: { json } },
    '@/lib/client-auth': { getClientSession: async () => options.anonymous ? null : { organizationId: 'tenant-a', userId: 'user-a' } },
    '@/lib/portal-access': { requirePortalPermission: async () => { if (options.denied) throw Error('denied'); } },
    '@/lib/flux-credits': { assertFluxFeatureAccess: async () => {} },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/whatsapp-delivery': { sendWhatsAppMessage: async input => { sent.push(input); if(options.deliveryThrows) throw Error('network timeout'); return { providerMessageId: options.noReceipt ? null : 'fixture-message' }; } },
    '@/lib/portal-campaign-templates': { loadLinkedCampaignTemplates: async () => {
      if (options.inventoryError) throw Error('Meta offline');
      return { templates: options.unapproved ? [] : [{ name: 'follow_up', language: 'en', purpose: 'customer_follow_up', variable_keys: ['customer_name', 'business_name'] }] };
    } },
    '@/lib/hotel-communication-policy': { isHotelOrganization: () => false },
    '@/lib/hotel-communications': {},
  });
  const request = extra => ({ json: async () => ({ templateName: 'follow_up', templatePurpose: 'customer_follow_up', languageCode: 'en', contactIds: ['contact-a'], variables: { customer_name: 'Forged name', 2: 'Xposure' }, organizationId: 'tenant-b', ...extra }) });
  return { route, request, filters, sent };
}

test('Xposure sends opted-in tenant contacts using the linked purpose and configured variable order', async () => {
  const h = harness(); const result = await h.route.POST(h.request());
  assert.equal(result.body.accepted, 1);
  assert.equal(h.sent[0].organizationId, 'tenant-a');
  assert.equal(h.sent[0].templatePurpose, 'customer_follow_up');
  assert.equal(h.sent[0].variables.customer_name, 'Ada');
  assert.equal(h.sent[0].variables.business_name, 'Xposure');
  assert.ok(h.filters.filter(([table]) => table === 'tenant_customer_contacts').some(([,key,value]) => key === 'organization_id' && value === 'tenant-a'));
  assert.ok(!h.filters.some(([,key,value]) => key === 'organization_id' && value === 'tenant-b'));
});
test('unknown, withdrawn or unreadable consent never dispatches a campaign', async () => {
  for (const options of [{ consent: 'unknown' }, { consent: 'opted_out' }, { consentError: true }]) {
    const h = harness(options); const result = await h.route.POST(h.request());
    assert.equal(result.body.skipped, 1); assert.equal(h.sent.length, 0);
  }
});
test('unapproved, unavailable, wrong-language and staff templates fail closed', async () => {
  for (const [options, extra] of [[{ unapproved: true }, {}], [{ inventoryError: true }, {}], [{}, { languageCode: 'fr' }], [{}, { templatePurpose: 'human_handoff_staff' }]]) {
    const h = harness(options); assert.ok((await h.route.POST(h.request(extra))).status >= 400); assert.equal(h.sent.length, 0);
  }
});
test('duplicate CRM and imported contact phones dispatch once', async () => {
  const h = harness({ crm: [{ id: 'crm-a', full_name: 'Ada', phone: '+2348000000000' }] });
  const result = await h.route.POST(h.request({ customerIds: ['crm-a'] }));
  assert.equal(result.body.accepted, 1); assert.equal(result.body.skipped, 1); assert.equal(h.sent.length, 1);
});
test('anonymous and revoked members cannot send', async () => {
  for (const [options, status] of [[{ anonymous: true }, 401], [{ denied: true }, 403]]) {
    const h = harness(options); assert.equal((await h.route.POST(h.request())).status, status); assert.equal(h.sent.length, 0);
  }
});
test('a missing provider receipt is unknown and never reported accepted', async () => {
  const h = harness({ noReceipt: true }); const result = await h.route.POST(h.request());
  assert.equal(result.body.accepted, 0); assert.equal(result.body.unknown, 1); assert.equal(result.body.results[0].status, 'unknown'); assert.equal(h.sent.length, 1);
});
test('an uncertain submission failure is not labelled safe to retry', async () => {
  const h = harness({ deliveryThrows: true }); const result = await h.route.POST(h.request());
  assert.equal(result.body.accepted, 0); assert.equal(result.body.failed, 0); assert.equal(result.body.unknown, 1); assert.equal(h.sent.length, 1);
});
test('missing template values and non-object requests are rejected before submission', async () => {
  const h = harness(); assert.equal((await h.route.POST(h.request({ variables: {} }))).status, 400);
  assert.equal((await h.route.POST({ json: async () => null })).status, 400); assert.equal(h.sent.length, 0);
});

test('inventory exposes only linked approved campaign templates with their message text', async () => {
  const filters = [];
  const admin = { from(table) { return { select() { return this; }, eq(k,v) { filters.push([table,k,v]); return this; }, in() { return this; },
    maybeSingle: async () => ({ data: { configuration: { waba_id: '123' } } }),
    then(resolve) { return Promise.resolve({ data: [{ template_name: 'follow_up', language_code: 'en', purpose: 'customer_follow_up', variable_keys: ['customer_name'] }] }).then(resolve); }
  }; }, rpc: async () => ({ data: { access_token: 'fixture-only', waba_id: '123' } }) };
  const service = load(path.join(root, 'lib/portal-campaign-templates.ts'), { '@/lib/supabase/admin': { createAdminClient: () => admin } }, '', {
    URL, AbortSignal, fetch: async () => ({ ok: true, json: async () => ({ data: [
      { name: 'follow_up', language: 'en', status: 'APPROVED', components: [{ type: 'BODY', text: 'Hello {{1}}' }] },
      { name: 'unlinked', language: 'en', status: 'APPROVED' },
      { name: 'follow_up', language: 'fr', status: 'APPROVED' },
      { name: 'follow_up', language: 'en', status: 'REJECTED' },
    ] }) })
  });
  const inventory = await service.loadLinkedCampaignTemplates('tenant-a');
  assert.equal(inventory.templates.length, 1); assert.equal(inventory.templates[0].body, 'Hello {{1}}');
  assert.equal(inventory.templates[0].purpose, 'customer_follow_up');
  assert.ok(filters.some(([,k,v]) => k === 'organization_id' && v === 'tenant-a'));
  assert.ok(!JSON.stringify(inventory).includes('fixture-only'));
});
