const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const source = (file, mocks, globals) => load(path.resolve(__dirname, '..', file), mocks, '', globals);
const normalizer = source('lib/whatsapp-message-normalizer.ts');
const message = source('lib/whatsapp-promotion-message.ts', {
  '@/lib/whatsapp-message-normalizer': normalizer,
});
const contactId = '00000000-0000-4000-8000-000000000001';
const contact = { id: contactId, full_name: 'Ada', phone: '+2348000000000', whatsapp_consent: 'opted_in' };
const draft = 'Hi {{customer_name}}! Offer: Studio portraits. Book: Reply today.';
const config = { template_name: 'xposure_studio_promotion', language_code: 'en', purpose: 'campaign_promotion', variable_keys: ['customer_name', 'offer_title', 'booking_action'] };
const template = {
  name: config.template_name, language: config.language_code, status: 'APPROVED', category: 'MARKETING',
  components: [{ type: 'BODY', text: 'Hi {{1}}! Offer: {{2}}. Book: {{3}}.' }, { type: 'FOOTER', text: 'Xposure Studios' }],
};
const json = (body, { status = 200 } = {}) => ({ body, status });

function harness(options = {}) {
  const state = { filters: [], sent: [], audit: [], inventory: 0, reads: 0 };
  const admin = {
    from(table) {
      let key;
      return {
        select() { return this; },
        eq(column, value) { state.filters.push([table, column, value]); return this; },
        in(column, values) { key = column; state.filters.push([table, column, Array.from(values)]); return this; },
        single: async () => ({ data: { status: 'active', slug: options.slug ?? 'xposure' } }),
        maybeSingle: async () => ({ data: { configuration: { waba_id: '123' } } }),
        insert: async row => {
          if (options.auditFailure) return { error: { code: '500' } };
          if (state.audit.some(previous => previous.id === row.id)) return { error: { code: '23505' } };
          state.audit.push(row);
          return { error: null };
        },
        then(resolve) {
          if (table === 'whatsapp_template_configs') return Promise.resolve({ data: options.configs ?? [config] }).then(resolve);
          const selected = options.missing ? [] : [{ ...contact, whatsapp_consent: options.consent ?? 'opted_in' }];
          if (key === 'id') return Promise.resolve({ data: selected }).then(resolve);
          state.reads++;
          if (options.conflict || (options.withdrawAt && state.reads >= options.withdrawAt)) {
            selected.push({ ...contact, id: 'other', phone: '2348000000000', whatsapp_consent: 'opted_out' });
          }
          return Promise.resolve({ data: selected }).then(resolve);
        },
      };
    },
    rpc: async () => ({ data: { access_token: 'fixture-secret', waba_id: '123' } }),
  };
  const common = {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/whatsapp-delivery': { sendWhatsAppMessage: async input => {
      assert.equal(state.audit.length, 1);
      state.sent.push(input);
      if (options.deliveryThrows) throw Error('network timeout');
      return options.noReceipt ? {} : { providerMessageId: 'fixture-message' };
    } },
  };
  const inventory = source('lib/portal-campaign-templates.ts', {
    ...common, '@/lib/whatsapp-promotion-message': message,
  }, { URL, AbortSignal, fetch: async () => {
    state.inventory++;
    if (options.inventoryError) throw new TypeError('private transport information');
    return { ok: true, json: async () => ({ data: options.templates ?? [template] }) };
  } });
  const promotion = source('lib/portal-whatsapp-promotion.ts', {
    ...common, '@/lib/portal-campaign-templates': inventory,
    '@/lib/whatsapp-promotion-message': message,
    '@/lib/whatsapp-message-normalizer': normalizer,
    '@/lib/supabase-server-rest': { getServerSupabaseConfig: () => ({ key: 'fixture-signing-key' }) },
  });
  const route = source('app/api/portal/campaigns/send/route.ts', {
    ...common, 'next/server': { NextResponse: { json } },
    '@/lib/client-auth': { getClientSession: async () => options.anonymous ? null : { organizationId: 'tenant-a', userId: 'user-a' } },
    '@/lib/portal-access': { requirePortalPermission: async () => { if (options.denied) throw Error('denied'); } },
    '@/lib/flux-credits': { assertFluxFeatureAccess: async () => {} },
    '@/lib/portal-whatsapp-promotion': promotion,
    '@/lib/hotel-communication-policy': {},
    '@/lib/hotel-communications': {},
  });
  const request = (extra = {}) => route.POST({ json: async () => ({
    action: 'review', message: draft, contactIds: [contactId], whatsappConsentConfirmed: true, organizationId: 'tenant-b', ...extra,
  }) });
  const send = (review, extra = {}) => request({ action: 'send', campaignId: review.campaignId, reviewFingerprint: review.reviewFingerprint, ...extra });
  return { state, request, send, inventory };
}

test('the server previews the assigned Meta promotion, audits consent, and submits it once', async () => {
  const h = harness();
  const review = await h.request();
  assert.equal(review.status, 200);
  assert.equal(review.body.message, 'Hi Ada! Offer: Studio portraits. Book: Reply today.');
  assert.equal(review.body.footer, 'Xposure Studios');
  assert.equal(h.state.audit.length, 0);
  assert.equal(h.state.sent.length, 0);
  const result = await h.send(review.body);
  assert.equal(result.body.accepted, 1);
  assert.equal(h.state.audit[0].actor_user_id, 'user-a');
  assert.equal(h.state.audit[0].organization_id, 'tenant-a');
  assert.equal(h.state.audit[0].metadata.recipient_contact_ids[0], contactId);
  const [outbound] = h.state.sent;
  assert.equal(outbound.organizationId, 'tenant-a');
  assert.equal(outbound.templatePurpose, 'campaign_promotion');
  assert.equal(outbound.requestedTemplateName, config.template_name);
  assert.equal(outbound.requestedTemplateLanguage, 'en');
  assert.deepEqual({ ...outbound.variables }, { customer_name: 'Ada', offer_title: 'Studio portraits', booking_action: 'Reply today' });
  assert.ok(h.state.filters.filter(([, key]) => key === 'organization_id').every(([, , value]) => value === 'tenant-a'));
  assert.equal((await h.send(review.body)).status, 409);
  assert.equal(h.state.sent.length, 1);
});

test('invalid audience, missing confirmation, and template overrides cannot review or dispatch', async () => {
  for (const [options, extra, status] of [
    [{ anonymous: true }, {}, 401], [{ denied: true }, {}, 403], [{ slug: 'hotel' }, {}, 403],
    [{}, { whatsappConsentConfirmed: false }, 400], [{}, { contactIds: [] }, 400],
    [{}, { templatePurpose: 'customer_follow_up' }, 400], [{}, { templateName: 'reminder' }, 400],
    [{}, { variables: { customer_name: 'Forged' } }, 400], [{}, { customerIds: [contactId] }, 400],
    [{ missing: true }, {}, 409], [{ consent: 'unknown' }, {}, 409],
    [{ consent: 'opted_out' }, {}, 409], [{ conflict: true }, {}, 409],
  ]) {
    const h = harness(options);
    assert.equal((await h.request(extra)).status, status);
    assert.equal(h.state.sent.length, 0);
  }
});

test('unapproved, ambiguous, mismatched, and unsupported Meta templates fail closed', async () => {
  for (const options of [
    { configs: [] }, { configs: [config, config] }, { templates: [] },
    { templates: [{ ...template, language: 'fr' }] }, { templates: [{ ...template, status: 'PENDING' }] },
    { templates: [{ ...template, category: 'UTILITY' }] },
    { templates: [{ ...template, components: [...template.components, { type: 'HEADER', format: 'IMAGE' }] }] },
    { templates: [{ ...template, components: [{ type: 'BODY', text: 'Hi {{1}}! {{2}} {{3}}.' }] }] },
  ]) {
    const h = harness(options);
    assert.equal((await h.request()).status, 409);
    assert.equal(h.state.sent.length, 0);
  }
});

test('inventory transport errors stay distinct and exclude private details', async () => {
  const h = harness({ inventoryError: true });
  const result = await h.request();
  assert.equal(result.status, 503);
  assert.match(result.body.error, /failed to connect/);
  assert.doesNotMatch(result.body.error, /private transport information|fixture-secret/);
});

test('only approved body slots can change, and missing fields are named', async () => {
  const h = harness();
  for (const [value, expected] of [
    ['A totally different offer', /does not fit/],
    [draft.replace('Hi ', 'Hello '), /does not fit/],
    [draft.replace('{{customer_name}}', 'Someone else'), /each recipient/],
    [draft.replace('Studio portraits', '{{offer_title}}'), /Enter the offer title/],
    [draft.replace('Studio portraits', 'x'.repeat(1025)), /too long/],
  ]) {
    const result = await h.request({ message: value });
    assert.equal(result.status, 400);
    assert.match(result.body.error, expected);
  }
});

test('changed content, failed audit, and consent withdrawn immediately before dispatch are blocked', async () => {
  const changed = harness();
  const review = await changed.request();
  assert.equal((await changed.send(review.body, { message: draft.replace('Reply today', 'Reply now') })).status, 409);
  assert.equal((await changed.send(review.body, { reviewFingerprint: '0'.repeat(64) })).status, 409);
  for (const [options, expected] of [[{ auditFailure: true }, 503], [{ withdrawAt: 3 }, 200]]) {
    const h = harness(options);
    const result = await h.send((await h.request()).body);
    assert.equal(result.status, expected);
    if (expected === 200) assert.equal(result.body.skipped, 1);
    assert.equal(h.state.sent.length, 0);
  }
});

test('an uncertain or missing provider receipt stays unconfirmed', async () => {
  for (const options of [{ noReceipt: true }, { deliveryThrows: true }]) {
    const h = harness(options);
    const result = await h.send((await h.request()).body);
    assert.equal(result.body.accepted, 0);
    assert.equal(result.body.unknown, 1);
  }
});
