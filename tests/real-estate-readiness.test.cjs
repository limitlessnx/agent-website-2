const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');

const orgId = 'fixture-real-estate-org';
const ok = data => ({ data, error: null });
const count = value => ({ count: value, error: null });

function harness(overrides = {}) {
  const queries = [];
  const client = {
    from(table) {
      const entry = { table, filters: [] };
      queries.push(entry);
      const result = overrides[table] || defaultResult(table);
      const builder = {
        select() { return builder; },
        eq(key, value) { entry.filters.push([key, value]); return builder; },
        limit() { return builder; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return builder;
    },
  };
  let resolvedId = null;
  const module = load('lib/real-estate-readiness.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => client },
    '@/lib/real-estate-organization': { resolveActiveRealEstateOrganization: async (db, id) => { assert.equal(db, client); resolvedId = id; return overrides.organization === null ? null : { id, name: 'Fixture Realty', slug: 'fixture-realty', status: 'active', metadata: { industry_slug: 'real_estate' } }; } },
    '@/lib/fluxknight-plans': { FLUX_PLAN_DEFINITIONS: overrides.plans || {
      basic: { code: 'basic', name: 'Basic', includedFeatures: [] },
      plus: { code: 'plus', name: 'Plus', includedFeatures: ['follow_ups', 'reminders'] },
    } },
  });
  return { module, queries, getResolvedId: () => resolvedId };
}

function defaultResult(table) {
  const counts = { properties: 2, real_estate_estates: 0, real_estate_inspections: 0, human_handoffs: 0, follow_ups: 0, appointments: 0 };
  if (table in counts) return count(counts[table]);
  if (table === 'organization_integrations') return ok([{ id: 'integration-1', provider: 'whatsapp', status: 'connected', last_checked_at: null }]);
  if (table === 'agents') return ok([{ id: 'maia-1', slug: 'maia', status: 'active', human_handoff_destination: { destination: 'fixture-destination' } }]);
  if (table === 'organization_calendar_resources') return ok([{ id: 'calendar-1', status: 'active', assigned_membership_id: 'membership-1' }]);
  if (table === 'flux_credit_wallets') return ok({ plan_code: 'plus', status: 'active' });
  throw new Error(`Unexpected table: ${table}`);
}

test('readiness verifies an active real-estate organization and scopes every operational query to its ID', async () => {
  const h = harness();
  const result = await h.module.getRealEstateReadiness(orgId);
  assert.equal(h.getResolvedId(), orgId);
  assert.ok(h.queries.length > 0);
  assert.ok(h.queries.every(query => query.filters.some(([key, value]) => key === 'organization_id' && value === orgId)), 'every operational read is tenant-scoped');
  assert.equal(result.checks.find(check => check.key === 'organization_scope').status, 'ready');
  assert.equal(result.checks.find(check => check.key === 'property_inventory').status, 'unverified');
  assert.equal(result.checks.find(check => check.key === 'estate_catalog').status, 'ready');
  assert.equal(result.checks.find(check => check.key === 'whatsapp').status, 'unverified', 'a connected config is not delivery proof');
  assert.equal(result.checks.find(check => check.key === 'maia').status, 'unverified', 'an active agent record is not inbound-path proof');
  assert.equal(result.overall, 'attention_required');
});

test('readiness fails closed for blank, inactive or non-real-estate organizations before querying tenant data', async () => {
  const blank = harness();
  await assert.rejects(() => blank.module.getRealEstateReadiness('  '), /Organization is required/);
  const inactive = harness({ organization: null });
  await assert.rejects(() => inactive.module.getRealEstateReadiness(orgId), /active real-estate organization/);
  assert.equal(inactive.queries.length, 0);
});

test('schema and permission failures are reported as unverified rather than missing or ready', async () => {
  const failure = { message: 'fixture unavailable' };
  const h = harness({
    properties: { count: null, error: failure },
    real_estate_estates: { count: null, error: failure },
    organization_integrations: { data: null, error: failure },
    agents: { data: null, error: failure },
    organization_calendar_resources: { data: null, error: failure },
    flux_credit_wallets: { data: null, error: failure },
  });
  const result = await h.module.getRealEstateReadiness(orgId);
  for (const key of ['property_inventory', 'estate_catalog', 'whatsapp', 'maia', 'handover', 'calendar', 'entitlements', 'followups', 'reminders']) {
    assert.equal(result.checks.find(check => check.key === key).status, 'unverified', `${key} should not be misreported as missing or ready`);
  }
});

test('duplicate Maia, WhatsApp and wallet records do not appear ready', async () => {
  const h = harness({
    organization_integrations: ok([
      { id: 'i1', provider: 'whatsapp', status: 'connected', last_checked_at: null },
      { id: 'i2', provider: 'whatsapp', status: 'connected', last_checked_at: null },
    ]),
    agents: ok([
      { id: 'm1', slug: 'maia', status: 'active', human_handoff_destination: { destination: 'fixture-a' } },
      { id: 'm2', slug: 'maia', status: 'active', human_handoff_destination: { destination: 'fixture-b' } },
    ]),
    flux_credit_wallets: { data: null, error: { message: 'multiple rows returned' } },
  });
  const result = await h.module.getRealEstateReadiness(orgId);
  for (const key of ['whatsapp', 'maia', 'handover', 'entitlements', 'followups', 'reminders']) assert.equal(result.checks.find(check => check.key === key).status, 'unverified');
});

test('paused wallet cannot make entitlements or scheduler checks appear operational', async () => {
  const h = harness({ flux_credit_wallets: ok({ plan_code: 'plus', status: 'paused' }) });
  const result = await h.module.getRealEstateReadiness(orgId);
  for (const key of ['entitlements', 'followups', 'reminders']) assert.equal(result.checks.find(check => check.key === key).status, 'unverified');
  assert.match(result.checks.find(check => check.key === 'entitlements').detail, /paused/);
});
