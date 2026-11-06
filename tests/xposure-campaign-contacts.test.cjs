const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');
const root = path.resolve(__dirname, '..');
const validation = load(path.join(root, 'lib/campaign-phone-contacts.ts'));
const vcard = load(path.join(root, 'lib/campaign-vcard.ts'), {}, '', { TextDecoder });

function harness(options = {}) {
  const state = { permissions: [], rows: [], filters: [] };
  const route = load(path.join(root, 'app/api/portal/campaigns/contacts/route.ts'), {
    'next/server': { NextResponse: { json: (body, { status = 200 } = {}) => ({ body, status }) } },
    '@/lib/xposure-tenant-authorization': { authorizeXposureTenantAccess: async permission => {
      state.permissions.push(permission);
      return options.denied ? { ok: false, response: { status: 403 } } : { ok: true, organizationId: 'xposure-a' };
    } },
    '@/lib/campaign-phone-contacts': validation,
    '@/lib/supabase/admin': { createAdminClient: () => ({ from(table) { assert.equal(table, 'tenant_customer_contacts'); return {
      insert(rows) { state.rows = rows; return this; }, select() { return this; },
      eq(key, value) { state.filters.push([key, value]); return this; }, order() { return this; }, limit() { return this; },
      then(resolve) { return Promise.resolve({ data: state.rows.map((row, i) => ({ ...row, id: String(i) })), error: options.error }).then(resolve); }
    }; } }) },
  });
  return { route, state, request: body => ({ json: async () => body }) };
}

test('manual and imported phones normalize country code and deduplicate before inserting', () => {
  const result = validation.validateCampaignContacts([{ name: 'Ada', phone: '+234 (800) 000-0000' }, { name: 'Ada', phone: '002348000000000' }]);
  assert.equal(result.contacts.length, 1); assert.equal(result.contacts[0].phone, '+2348000000000'); assert.equal(result.duplicates, 1);
  for (const phone of ['08000000000', '+012345678', '+2348000000000 ext 1', '+234;drop', '']) assert.equal(validation.normalizeCampaignPhone(phone), null);
});
test('empty, oversized, unnamed and malformed batches fail before a database write', async () => {
  for (const contacts of [[], Array(501).fill({ name: 'Ada', phone: '+2348000000000' }), [{ name: '', phone: '+2348000000000' }], [{ name: 'Ada', phone: '08000000000' }]]) {
    const h = harness(); assert.equal((await h.route.POST(h.request({ contacts }))).status, 400); assert.equal(h.state.rows.length, 0);
  }
});
test('only explicit boolean permission opts a new contact in; tenant input is ignored', async () => {
  for (const [value, expected] of [[true, 'opted_in'], [false, 'unknown'], ['true', 'unknown'], [undefined, 'unknown']]) {
    const h = harness(); const result = await h.route.POST(h.request({ contacts: [{ name: 'Ada', phone: '+2348000000000', organization_id: 'other', whatsapp_consent: 'opted_in' }], whatsappConsentConfirmed: value, organizationId: 'other' }));
    assert.equal(result.status, 201); assert.equal(h.state.rows[0].organization_id, 'xposure-a');
    assert.equal(h.state.rows[0].whatsapp_consent, expected); assert.equal(Boolean(h.state.rows[0].consent_recorded_at), value === true);
    assert.equal(h.state.permissions[0], 'customers.manage');
  }
});
test('existing contact conflicts never overwrite opt-outs, and database failures are not successes', async () => {
  for (const [error, status] of [[{ code: '23505' }, 409], [{ code: 'offline' }, 503]]) {
    const h = harness({ error }); assert.equal((await h.route.POST(h.request({ contacts: [{ name: 'Ada', phone: '+2348000000000' }], whatsappConsentConfirmed: true }))).status, status);
  }
});
test('read and write permission failures cannot reach the contact store; reads scope to tenant', async () => {
  const denied = harness({ denied: true }); assert.equal((await denied.route.GET()).status, 403); assert.equal((await denied.route.POST(denied.request({}))).status, 403); assert.equal(denied.state.rows.length, 0);
  const h = harness(); assert.equal((await h.route.GET()).status, 200); assert.equal(h.state.permissions[0], 'customers.view');
  assert.ok(h.state.filters.some(([key, value]) => key === 'organization_id' && value === 'xposure-a'));
});
test('iPhone grouped vCards and folded names remain readable for review', () => {
  const rows = vcard.parseVCard('BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Studio\r\n Client\r\nitem1.TEL;TYPE=CELL:+2348000000000\r\nEND:VCARD\r\n');
  assert.equal(rows.length, 1); assert.equal(rows[0].name, 'StudioClient'); assert.equal(rows[0].phone, '+2348000000000');
});
