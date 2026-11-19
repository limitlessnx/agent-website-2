/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHmac } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const load = require('./helpers/load-typescript.cjs');
const org = 'tenant-a', other = 'tenant-b', message = 'synthetic-message';
const quiet = { info() {}, warn() {}, error() {} };
function client(db) {
  return { from(table) {
    assert.equal(table, 'whatsapp_delivery_attempts');
    const filters = []; let values, insertion = false, ignoreDuplicate = false;
    const q = { select: () => q, eq: (k, v) => { filters.push([k, '=', v]); return q; },
      in: (k, v) => { filters.push([k, 'in', v]); return q; }, order: () => q, limit: () => q,
      update: v => { values = v; return q; }, insert: v => { values = v; insertion = true; return q; },
      upsert: (v, options) => { values = v; insertion = true; ignoreDuplicate = options.ignoreDuplicates; return q; },
      async maybeSingle() { const r = await execute(); return { ...r, data: r.data?.[0] || null }; },
      then(resolve, reject) { return execute().then(resolve, reject); },
    };
    async function execute() {
      const params = []; const param = v => { params.push(v); return '$' + params.length; };
      const fields = v => Object.keys(v).map(k => { assert.match(k, /^[a-z_]+$/); return k; });
      let sql = 'SELECT * FROM whatsapp_delivery_attempts';
      if (insertion) { const keys = fields(values); sql = `INSERT INTO whatsapp_delivery_attempts (${keys.join(',')}) VALUES (${keys.map(k => param(values[k])).join(',')})`; }
      else if (values) sql = 'UPDATE whatsapp_delivery_attempts SET ' + fields(values).map(k => `${k}=${param(values[k])}`).join(',');
      if (filters.length) sql += ' WHERE ' + filters.map(([k, op, v]) => {
        assert.match(k, /^[a-z_]+$/); return op === 'in' ? `${k}=ANY(${param(v)}::text[])` : `${k}=${param(v)}`;
      }).join(' AND ');
      if (ignoreDuplicate) sql += ' ON CONFLICT(id) DO NOTHING';
      if (values) sql += ' RETURNING *';
      try { return { data: (await db.query(sql, params)).rows, error: null }; } catch (error) { return { data: null, error }; }
    }
    return q;
  } };
}
async function fixture() {
  const db = new PGlite();
  const original = fs.readFileSync('supabase/migrations/20260731140702_whatsapp_template_delivery_gateway.sql', 'utf8');
  const start = original.indexOf('create table if not exists public.whatsapp_delivery_attempts');
  await db.exec(original.slice(start, original.indexOf('\ncreate index', start)));
  await db.exec(fs.readFileSync('supabase/migrations/20260828152147_expand_whatsapp_delivery_attempt_statuses.sql', 'utf8'));
  await db.query("INSERT INTO whatsapp_delivery_attempts(organization_id,recipient,message_type,provider_message_id,status) VALUES($1,'15555550123','template',$3,'accepted'),($2,'15555550123','template',$3,'accepted')", [org, other, message]);
  const admin = client(db);
  const ledger = load('lib/whatsapp-delivery-ledger.ts', { '@/lib/supabase/admin': { createAdminClient: () => admin }, '@/lib/whatsapp-status-log': { getRecentWhatsAppStatuses: async () => [] } }, '', { process: { env: { LIMITLESS_REALTY_ORGANIZATION_ID: org } } });
  return { db, admin, ledger };
}
async function state(db, organization = org) { return (await db.query('SELECT status FROM whatsapp_delivery_attempts WHERE organization_id=$1', [organization])).rows[0].status; }
test('actual SQL updates only the verified tenant and rejects weaker/replayed receipts', async () => {
  const { db, ledger } = await fixture(); try {
    const apply = status => ledger.applyLegacyWhatsAppReceipt({ organizationId: org, providerMessageId: message, status });
    assert.equal(await apply('read'), true);
    for (const status of ['sent', 'accepted', 'failed', 'read']) assert.equal(await apply(status), false);
    assert.equal(await state(db), 'read'); assert.equal(await state(db, other), 'accepted');
    assert.equal(await ledger.applyLegacyWhatsAppReceipt({ organizationId: '', providerMessageId: message, status: 'delivered' }), false);
    assert.equal(await apply('unsupported'), false);
  } finally { await db.close(); }
});
test('interleaved SQL receipts preserve the strongest evidence and clear failure details on delivery', async () => {
  const { db, ledger } = await fixture(); try {
    await ledger.applyLegacyWhatsAppReceipt({ organizationId: org, providerMessageId: message, status: 'failed', errorCode: 'synthetic' });
    await Promise.all(['delivered', 'sent', 'read', 'accepted'].map(status => ledger.applyLegacyWhatsAppReceipt({ organizationId: org, providerMessageId: message, status })));
    assert.equal(await state(db), 'read');
    const row = (await db.query('SELECT error_code FROM whatsapp_delivery_attempts WHERE organization_id=$1', [org])).rows[0]; assert.equal(row.error_code, null);
  } finally { await db.close(); }
});
test('replaying campaign acceptance cannot overwrite a provider receipt', async () => {
  const { db, ledger } = await fixture(); try {
    await ledger.applyLegacyWhatsAppReceipt({ organizationId: org, providerMessageId: message, status: 'delivered' });
    const result = await ledger.recordLimitlessCampaignDeliveryAttempts({ organizationId: org, campaignId: 'synthetic', acceptedRecipients: [{ phone: '15555550123', messageId: message }] });
    assert.equal(result.updated, 0); assert.equal(await state(db), 'delivered');
  } finally { await db.close(); }
});
test('campaign evidence requires explicit organization scope and never falls back to the internal tenant', async () => {
  const { db, ledger } = await fixture(); try {
    await assert.rejects(ledger.recordLimitlessCampaignDeliveryAttempts({ campaignId: 'synthetic', acceptedRecipients: [] }), /Organization ID is required/);
    await ledger.recordLimitlessCampaignDeliveryAttempts({ organizationId: other, campaignId: 'synthetic', failedRecipients: [{ phone: '15555550123', messageId: message, error: 'synthetic rejection' }] });
    assert.equal(await state(db, other), 'failed'); assert.equal(await state(db), 'accepted');
  } finally { await db.close(); }
});
test('campaign report retries without provider IDs preserve one audit row per execution and recipient', async () => {
  const { db, ledger } = await fixture(); try {
    const input = { organizationId: org, campaignId: 'retry', executionId: 'synthetic-execution', failedRecipients: [{ phone: '15555550124', error: 'synthetic rejection' }] };
    const results = await Promise.all([ledger.recordLimitlessCampaignDeliveryAttempts(input), ledger.recordLimitlessCampaignDeliveryAttempts(input)]);
    assert.equal(results.reduce((sum, r) => sum + r.inserted, 0), 1);
    assert.equal(Number((await db.query("SELECT count(*) FROM whatsapp_delivery_attempts WHERE recipient='15555550124'")).rows[0].count), 1);
    await ledger.recordLimitlessCampaignDeliveryAttempts({ ...input, executionId: 'different-execution' });
    assert.equal(Number((await db.query("SELECT count(*) FROM whatsapp_delivery_attempts WHERE recipient='15555550124'")).rows[0].count), 2);
  } finally { await db.close(); }
});
test('report store forwards tenant context and does not report successful persistence after a write error', async () => {
  let input;
  const store = load('lib/campaign-report-store.ts', { '@/lib/whatsapp-delivery-ledger': { recordLimitlessCampaignDeliveryAttempts: async v => { input = v; throw Error('synthetic storage failure'); } } });
  await assert.rejects(store.saveCampaignDeliveryReport({ organization_id: other, id: 'synthetic', accepted_recipients: [] }), /synthetic storage failure/);
  assert.equal(input.organizationId, other);
});
function metaFixture({ known = true, ambiguous = false, invalidSignature = false, failWrite = false, failCanonical = false, messageKind } = {}) {
  const writes = [], canonical = [], echoes = [], taskRequests = [], calls = { dispatch: 0, agentQueries: 0 };
  const admin = { from(table) {
    const q = { select: () => q, insert: () => q, in: () => q, eq: () => q, order: () => q, maybeSingle: async () => ({ data: null, error: null }),
      then(resolve, reject) { if (table === 'agents') calls.agentQueries++; const data = table === 'organization_integrations' && known ? [{ organization_id: org, configuration: { phone_number_id: 'synthetic-number', maia_active: true } }, ...(ambiguous ? [{ organization_id: other, configuration: { phone_number_id: 'synthetic-number' } }] : [])] : table === 'agents' && messageKind ? [{ id: 'synthetic-maia', slug: 'maia' }] : []; return Promise.resolve({ data, error: null }).then(resolve, reject); },
    }; return q;
  } };
  const route = load('app/api/whatsapp/webhook/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
    '@trigger.dev/sdk': { tasks: { trigger: async (...args) => { calls.dispatch++; if (messageKind !== 'inbound') throw Error('No dispatch permitted'); taskRequests.push(args); return { id: 'synthetic-run' }; } } },
    '@/lib/supabase/admin': { createAdminClient: () => admin }, '@/lib/whatsapp-coexistence': { recordWhatsAppBusinessAppEcho: async v => echoes.push(v) },
    '@/lib/human-operations': { syncHandoffNotificationStatus: async () => {} },
    '@/lib/real-estate-provider-status': { syncRealEstateProviderStatus: async v => { canonical.push(v); if (failCanonical) throw Error('PRIVATE_STORAGE_ERROR'); } },
    '@/lib/whatsapp-delivery-ledger': { applyLegacyWhatsAppReceipt: async v => { writes.push(v); if (failWrite) throw Error('Synthetic persistence unavailable'); return true; } },
    '@/lib/limitless-installment-recovery-receipts': { syncLimitlessInstallmentRecoveryReceipt: async () => false }, '@/lib/maia-whatsapp-calling': {},
  }, '', { process: { env: { WHATSAPP_APP_SECRET: 'synthetic-secret' } }, console: quiet });
  const value = { metadata: { phone_number_id: 'synthetic-number' }, statuses: [{ id: message, status: 'delivered', timestamp: '1795052000' }] };
  if (messageKind === 'echo') value.message_echoes = [{ id: 'synthetic-echo', to: '15555550123', type: 'text', text: { body: 'Synthetic human reply' } }];
  if (messageKind === 'inbound') value.messages = [{ id: 'synthetic-inbound', from: '15555550123', type: 'text', timestamp: String(Math.floor(Date.now() / 1000)), text: { body: 'Synthetic inquiry' } }];
  const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ changes: [{ field: messageKind === 'echo' ? 'smb_message_echoes' : 'messages', value }] }] });
  const signature = 'sha256=' + createHmac('sha256', 'synthetic-secret').update(raw).digest('hex');
  return { route, writes, canonical, calls, echoes, taskRequests, request: { text: async () => raw, headers: new Headers({ 'x-hub-signature-256': invalidSignature ? 'sha256=invalid' : signature }) } };
}
test('signed Meta receipts retain verified organization without requiring a published agent', async () => {
  const f = metaFixture(); assert.equal((await f.route.POST(f.request)).status, 200);
  assert.equal(f.writes[0].organizationId, org); assert.equal(f.canonical[0].organizationId, org);
  assert.equal(f.calls.agentQueries, 0); assert.equal(f.calls.dispatch, 0);
});
test('human coexistence echoes retain tenant runtime resolution and do not dispatch an AI reply', async () => {
  const f = metaFixture({ messageKind: 'echo' }); await f.route.POST(f.request);
  assert.equal(f.echoes.length, 1); assert.equal(f.echoes[0].organizationId, org); assert.equal(f.echoes[0].agentId, 'synthetic-maia'); assert.equal(f.calls.dispatch, 0);
});
test('ordinary inbound messages retain tenant-agent routing and queue idempotency', async () => {
  const f = metaFixture({ messageKind: 'inbound' }); await f.route.POST(f.request);
  assert.equal(f.calls.dispatch, 1); const [task, payload, options] = f.taskRequests[0];
  assert.equal(task, 'maia-process-inbound-message'); assert.equal(payload.organizationId, org); assert.equal(payload.agentId, 'synthetic-maia');
  assert.equal(options.idempotencyKey, 'whatsapp-inbound:tenant-a:synthetic-maia:synthetic-inbound');
});
test('unknown and ambiguous Meta bindings cannot update legacy or canonical evidence', async () => {
  const unknown = metaFixture({ known: false }); await unknown.route.POST(unknown.request); assert.equal(unknown.writes.length, 0); assert.equal(unknown.canonical.length, 0);
  const ambiguous = metaFixture({ ambiguous: true }); await assert.rejects(ambiguous.route.POST(ambiguous.request), /ambiguous/); assert.equal(ambiguous.writes.length, 0);
});
test('invalid signatures cause no writes and persistence failure remains retryable', async () => {
  const invalid = metaFixture({ invalidSignature: true }); assert.equal((await invalid.route.POST(invalid.request)).status, 401); assert.equal(invalid.writes.length, 0);
  const failed = metaFixture({ failWrite: true }); await assert.rejects(failed.route.POST(failed.request), /persistence unavailable/); assert.equal(failed.calls.dispatch, 0);
  const canonical = metaFixture({ failCanonical: true }); await assert.rejects(canonical.route.POST(canonical.request), /canonical receipt could not be stored/); assert.equal(canonical.calls.dispatch, 0);
});
test('unverified historical logs never mutate stored delivery evidence or masquerade as a successful refresh', async () => {
  const { db, admin } = await fixture(); try {
    const ledger = load('lib/whatsapp-delivery-ledger.ts', { '@/lib/supabase/admin': { createAdminClient: () => admin }, '@/lib/whatsapp-status-log': { getRecentWhatsAppStatuses: async () => [{ message_id: message, status: 'read' }] } }, '', { process: { env: { LIMITLESS_REALTY_ORGANIZATION_ID: org } } });
    await assert.rejects(ledger.getLimitlessCampaignDeliveryLedger(), /identity is unverified/);
    assert.equal(await state(db), 'accepted');
  } finally { await db.close(); }
});

test('Twilio callback applies its signed account binding and rejects invalid signatures', async () => {
  const { db, admin, ledger } = await fixture(); try {
    const bindingAdmin = { from(table) {
      if (table !== 'whatsapp_twilio_bindings') return admin.from(table);
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { organization_id: org }, error: null }) }; return q;
    }, rpc: async () => ({ data: { twilio_auth_token: 'synthetic' }, error: null }) };
    let valid = true;
    const route = load('app/api/whatsapp/twilio/status/route.ts', {
      'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } },
      '@/lib/supabase/admin': { createAdminClient: () => bindingAdmin },
      '@/lib/twilio-whatsapp': { validateTwilioFormSignature: () => valid },
      '@/lib/real-estate-provider-status': { syncRealEstateProviderStatus: async () => {} },
      '@/lib/human-operations': { syncHandoffNotificationStatus: async () => {} },
      '@/lib/whatsapp-delivery-ledger': ledger,
    }, '', { process: { env: {} }, console: quiet, URLSearchParams });
    const request = status => ({ text: async () => new URLSearchParams({ AccountSid: 'synthetic-account', MessageSid: message, MessageStatus: status }).toString(), headers: new Headers(), nextUrl: { origin: 'https://synthetic.invalid' } });
    assert.equal((await route.POST(request('delivered'))).status, 200);
    assert.equal(await state(db), 'delivered'); assert.equal(await state(db, other), 'accepted');
    await route.POST(request('queued')); await route.POST(request('undelivered')); await route.POST(request('unsupported'));
    assert.equal(await state(db), 'delivered');
    valid = false; assert.equal((await route.POST(request('read'))).status, 401); assert.equal(await state(db), 'delivered');
  } finally { await db.close(); }
});
