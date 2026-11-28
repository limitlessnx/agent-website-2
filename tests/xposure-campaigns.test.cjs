/* eslint-disable @typescript-eslint/no-require-imports */
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
const studioValues = {
  offer_title: 'Family Portrait Weekend', offer_details: 'Get a 30-minute studio session with five edited photos.',
  availability: 'Available on 28 November.', booking_action: 'Reply to book.',
};
const studioCopy = Object.values(studioValues).join('\n');
const studioConfig = { ...config, variable_keys: ['customer_name', ...Object.keys(studioValues)] };
const studioTemplate = {
  ...template,
  components: [{ type: 'BODY', text: 'Hi {{1}}! Explore {{2}}\nDetails: {{3}}\nAvailability: {{4}}\nNext: {{5}}' }],
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
        single: async () => ({ data: { status: options.inactive ? 'inactive' : 'active', slug: options.slug ?? 'xposure', metadata:{industry:options.industry || (options.slug==='hotel'?'hotel':'photography-studio')} } }),
        maybeSingle: async () => ({ data: { configuration: { waba_id: '123' } } }),
        insert: async row => {
          if (options.auditFailure) return { error: { code: '500' } };
          if (state.audit.some(previous => previous.id === row.id)) return { error: { code: '23505' } };
          state.audit.push(row);
          return { error: null };
        },
        then(resolve) {
          if (table === 'whatsapp_template_configs') return Promise.resolve({ data: options.configs ?? [options.fiveFields ? studioConfig : config] }).then(resolve);
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
    '@/lib/whatsapp-credentials': source('lib/whatsapp-credentials.ts'),
  }, { URL, AbortSignal, fetch: async () => {
    state.inventory++;
    if (options.inventoryError) throw new TypeError('private transport information');
    return { ok: true, json: async () => ({ data: options.templates ?? [options.fiveFields ? studioTemplate : template] }) };
  } });
  const promotion = source('lib/portal-whatsapp-promotion.ts', {
    ...common, '@/lib/portal-campaign-templates': inventory,
    '@/lib/campaign-ai-writeup': {
      CampaignWriteupError: Error,
      createCampaignWriteup: async (...args) => { (state.writer ??= []).push(args); return {variables: studioValues}; },
    },
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
    '@/lib/portal-campaign-templates': inventory,
    '@/lib/hotel-communication-policy': source('lib/hotel-communication-policy.ts'),
    '@/lib/hotel-communications': {},
  });
  const inventoryRoute = source('app/api/portal/campaigns/meta-templates/route.ts', {
    ...common, 'next/server': { NextResponse: { json } },
    '@/lib/client-auth': { getClientSession: async () => options.anonymous ? null : { organizationId: 'tenant-a', userId: 'user-a' } },
    '@/lib/portal-access': { requirePortalPermission: async () => { if (options.denied) throw Error('denied'); } },
    '@/lib/portal-campaign-templates': inventory,
    '@/lib/hotel-communication-policy': source('lib/hotel-communication-policy.ts'),
  });
  const request = (extra = {}) => route.POST({ json: async () => ({
    action: 'review', message: draft, contactIds: [contactId], whatsappConsentConfirmed: true, organizationId: 'tenant-b', ...extra,
  }) });
  const send = (review, extra = {}) => request({ action: 'send', campaignId: review.campaignId, reviewFingerprint: review.reviewFingerprint, ...extra });
  return { state, request, send, inventory, inventoryRoute };
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

test('freeform copy is formatted into the approved promotion without changing fixed wording', async () => {
  const h = harness();
  const result = await h.request({ message: 'Studio portraits this weekend. Reply today to book.' });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, 'Hi Ada! Offer: Studio portraits this weekend. Book: Reply today to book.');
  assert.equal(h.state.sent.length, 0);
});

test('invalid and overlong copy cannot be sent', async () => {
  const h = harness();
  for (const [value, expected] of [
    ['', /Write a promotional message/],
    ['x'.repeat(4001), /Write a promotional message/],
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

test('five-field promotion uses normal copy and personalizes the preview and exact reviewed send', async () => {
  const h = harness({ fiveFields: true });
  const review = await h.request({ message: studioCopy });
  assert.equal(review.status, 200);
  assert.equal(review.body.message, 'Hi Ada! Explore Family Portrait Weekend\nDetails: Get a 30-minute studio session with five edited photos.\nAvailability: Available on 28 November.\nNext: Reply to book.');
  assert.equal((await h.send(review.body, { message: studioCopy + ' ' })).status, 409);
  const result = await h.send(review.body, { message: studioCopy });
  assert.equal(result.body.accepted, 1);
  assert.deepEqual({ ...h.state.sent[0].variables }, { customer_name: 'Ada', ...studioValues });
  assert.deepEqual(Array.from(h.state.sent[0].expectedMetaVariableKeys), studioConfig.variable_keys);
  assert.equal(h.state.writer, undefined);
});

test('missing or competing availability blocks review and structured values cannot introduce claims or names', async () => {
  const h = harness({ fiveFields: true });
  for (const message of [studioCopy.replace(studioValues.availability, ''), studioCopy + '\nAvailable in December.']) {
    const result = await h.request({ message });
    assert.equal(result.status, 400);
    assert.match(result.body.error, /availability/);
  }
  assert.equal((await h.request({ message: studioCopy, writerValues: { ...studioValues, availability: 'Available all year.' } })).status, 400);
  assert.equal((await h.request({ message: studioCopy, writerValues: { ...studioValues, customer_name: 'Other' } })).status, 400);
  assert.equal((await h.request({ message: studioCopy, writerValues: studioValues, useAiFormatting: true })).status, 200);
  assert.equal(h.state.writer, undefined);
});

test('optional AI extraction uses stable identity and send reuses the reviewed output', async () => {
  const h = harness({ fiveFields: true, noReceipt: true });
  const message = studioCopy + '\nReply for details.';
  const failed = await h.request({ message });
  assert.equal(failed.status, 400);
  assert.equal(failed.body.canUseAiFormatting, true);
  assert.equal(h.state.writer, undefined);
  const review = await h.request({ message, useAiFormatting: true });
  const retry = await h.request({ message, useAiFormatting: true });
  assert.equal(review.status, 200);
  assert.equal(retry.status, 200);
  assert.equal(h.state.writer[0][4], h.state.writer[1][4]);
  const result = await h.send(review.body, { message, writerValues: review.body.writerValues });
  assert.equal(result.body.unknown, 1);
  assert.equal(result.body.accepted, 0);
  assert.equal((await h.send(review.body, { message, writerValues: review.body.writerValues })).status, 409);
  assert.equal(h.state.sent.length, 1);
  assert.equal(h.state.writer.length, 2);
});

test('registry discovers pending and unlinked templates but routes only eligible linked marketing templates', async () => {
  const wishesConfig = { ...config, template_name: 'wishes_template', purpose: 'campaign' };
  const wishes = { ...template, name: 'wishes_template' };
  const handoffConfig = { ...config, template_name: 'handoff', purpose: 'human_handoff_staff' };
  const h = harness({ configs: [config, wishesConfig, handoffConfig], templates: [
    template, wishes, {...template, name:'handoff', category:'UTILITY'},
    {...template, name:'pending', status:'PENDING'}, {...template, name:'unmapped'},
  ] });
  const registry = await h.inventory.loadCampaignPromotions('tenant-a');
  assert.deepEqual(Array.from(registry.promotions, item => item.name), ['wishes_template','xposure_studio_promotion']);
  assert.equal(registry.inventory.find(item => item.name === 'pending').status, 'PENDING');
  assert.equal(registry.inventory.find(item => item.name === 'unmapped').mapping_status, 'unlinked');
  assert.equal(registry.inventory.find(item => item.name === 'handoff').purpose, 'human_handoff_staff');
  assert.equal((await h.request({ campaignTemplate: {name:'handoff',language:'en'} })).status,409);
  assert.equal((await h.request({ campaignTemplate: {name:'unmapped',language:'en'} })).status,409);
  const selected = {name:'wishes_template',language:'en'};
  const review = await h.request({campaignTemplate:selected});
  assert.equal(review.status,200);
  assert.equal((await h.send(review.body,{campaignTemplate:{name:config.template_name,language:'en'}})).status,409);
  assert.equal((await h.send(review.body,{campaignTemplate:selected})).body.accepted,1);
  assert.equal(h.state.sent[0].templatePurpose,'campaign');
  assert.equal(h.state.sent[0].requestedTemplateName,'wishes_template');
  assert.equal(h.state.sent[0].organizationId,'tenant-a');
});
test('registry rejects ambiguous mapping, duplicate provider variants and forged selection', async () => {
  for (const options of [{configs:[config,config]}, {templates:[template,template]}]) {
    const h = harness(options);
    assert.equal((await h.request({campaignTemplate:{name:config.template_name,language:'en'}})).status,409);
    assert.equal(h.state.sent.length,0);
  }
  const h = harness();
  assert.equal((await h.request({campaignTemplate:{name:'../other',language:'en'}})).status,400);
  assert.equal((await h.request({campaignTemplate:{name:config.template_name,language:'fr'}})).status,409);
});

test('template discovery suggests purpose without authorizing unlinked templates', async () => {
  const h = harness({configs:[config,{...config,template_name:'missing_mapping',purpose:'campaign'}],templates:[template,
    {...template,name:'birthday_wishes'}, {...template,name:'appointment_reminder',category:'UTILITY'},
    {...template,name:'payment_reminder',category:'MARKETING'}, {...template,name:'pending_offer',status:'PENDING'}]});
  const {inventory,templates,missingMappings}=await h.inventory.loadLinkedCampaignTemplates('tenant-a',true,null);
  assert.equal(inventory.find(t=>t.name==='birthday_wishes').suggested_purpose,'campaign');
  assert.equal(inventory.find(t=>t.name==='appointment_reminder').suggested_purpose,'appointment_reminder');
  assert.equal(inventory.find(t=>t.name==='payment_reminder').suggested_purpose,null);
  assert.equal(inventory.find(t=>t.name==='pending_offer').suggested_purpose,null);
  assert.equal(templates.length,1);
  assert.equal(missingMappings[0].name,'missing_mapping');
});

test('new organization inherits reviewed campaign delivery without Xposure slug', async () => {
 for (const industry of ['beauty-spa','real-estate','retail','general','photography-studio']) {
  const h=harness({slug:'new-business-'+industry,industry});
  const selection={name:config.template_name,language:'en'};
  const review=await h.request({campaignTemplate:selection});
  assert.equal(review.status,200);
  assert.equal((await h.send(review.body,{campaignTemplate:selection})).body.accepted,1);
  assert.equal(h.state.sent[0].organizationId,'tenant-a');
  assert.equal(h.state.sent[0].templatePurpose,'campaign_promotion');
  assert.equal(h.state.audit[0].organization_id,'tenant-a');
 }
});
test('new tenant cannot bypass consent by calling the legacy bulk endpoint',async()=>{
 const h=harness({slug:'new-business',industry:'retail'});
 assert.equal((await h.request({whatsappConsentConfirmed:false})).status,400);
 assert.equal((await h.request({action:undefined,customerIds:[contactId],templateName:config.template_name,templatePurpose:'campaign'})).status,400);
 assert.equal(h.state.sent.length,0);
 const inactive=harness({slug:'new-business',inactive:true});
 assert.equal((await inactive.request()).status,409);
});

test('fresh tenant inventory returns the same marketing contract without preconfigured mappings',async()=>{
 const h=harness({slug:'new-salon',industry:'beauty-spa',configs:[]});
 const result=await h.inventoryRoute.GET();
 assert.equal(result.status,200);
 assert.equal(result.body.promotions.length,0);
 assert.equal(result.body.inventory[0].mapping_status,'unlinked');
 assert.equal((await h.request({campaignTemplate:{name:config.template_name,language:'en'}})).status,409);
 assert.equal(h.state.sent.length,0);
});
test('generic inventory uses only current tenant and respects inactive and denied sessions',async()=>{
 const h=harness({slug:'fresh-retail',industry:'retail'});
 const result=await h.inventoryRoute.GET();
 assert.equal(result.status,200);assert.equal(result.body.promotions.length,1);
 assert.ok(h.state.filters.filter(([,key])=>key==='organization_id').every(([, ,value])=>value==='tenant-a'));
 for(const [options,status] of [[{anonymous:true},401],[{denied:true},403],[{inactive:true},409]]) {
  const rejected=harness({slug:'fresh-retail',...options});assert.equal((await rejected.inventoryRoute.GET()).status,status);
  assert.equal(rejected.state.inventory,0);
 }
});

test('a new real estate tenant can review and send both actual approved starter definitions',async()=>{
 const starters=source('lib/campaign-starter-templates.ts').campaignStarters(false);
 const configs=starters.map(item=>({template_name:item.name,language_code:item.language,purpose:item.purpose,variable_keys:[...item.variable_keys]}));
 const templates=starters.map(item=>({name:item.name,language:item.language,status:'APPROVED',category:item.category,components:[{type:'BODY',text:item.body}]}));
 for(const starter of starters){
  const h=harness({slug:'new-real-estate-business',industry:'real-estate',configs,templates});
  const selection={name:starter.name,language:starter.language};
  const copy='New estate plots are available for inspection this Saturday';
  const review=await h.request({campaignTemplate:selection,message:copy});
  assert.equal(review.status,200);
  const sent=await h.send(review.body,{campaignTemplate:selection,message:copy});
  assert.equal(sent.body.accepted,1);
  assert.equal(h.state.sent[0].organizationId,'tenant-a');
  assert.equal(h.state.sent[0].requestedTemplateName,starter.name);
  assert.equal(h.state.sent[0].templatePurpose,starter.purpose);
  assert.equal(h.state.sent[0].variables[starter.variable_keys[1]],copy);
 }
});
