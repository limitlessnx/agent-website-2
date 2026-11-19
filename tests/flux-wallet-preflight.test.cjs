/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./helpers/load-typescript.cjs');
const plans = load('lib/fluxknight-plans.ts');
const organizationId = '10000000-0000-4000-8000-000000000001';
const agentId = '20000000-0000-4000-8000-000000000001';
function fixture(overrides = {}) {
  const calls = { provider: 0, charges: 0, queries: [] };
  const wallet = {
    organization_id: organizationId, plan_code: 'business', monthly_allowance: 12000,
    balance: 100, bonus_balance: 0, top_up_balance: 0, trial_credit_limit: null,
    trial_ends_at: null, current_period_end: '2099-01-01T00:00:00Z', status: 'active', ...overrides,
  };
  let walletError = null; let capacityEvidence = null;
  const admin = { from(table) {
    const filters = [];
    const data = () => {
      if (table === 'organization_subscriptions') return { id: 'synthetic-subscription', status: wallet.status, metadata: { plan_code: wallet.plan_code } };
      if (table === 'flux_credit_reservations') return null;
      if (table === 'runtime_executions') return filters.some(([key, value]) => key === 'organization_id' && value !== organizationId) ? null : { id: 'synthetic-execution', organization_id: organizationId, agent_id: agentId, status: 'prepared' };
      if (table === 'runtime_context_snapshots') return { id: 'synthetic-snapshot', compiled_prompt: 'Synthetic instructions', prompt_version: 1, checksum: 'synthetic' };
      if (table === 'agent_provider_assignments') return { id: 'synthetic-assignment', limits: {} };
      throw Error('Unexpected table ' + table);
    };
    const q = {
      select: () => q, eq: (key, value) => { filters.push([key, value]); calls.queries.push({ table, key, value }); return q; },
      in: () => q, order: () => q, limit: () => q,
      maybeSingle: async () => ({ data: data(), error: null }), single: async () => ({ data: data(), error: null }),
    };
    return q;
  }, rpc: async (name, args) => {
    if (name === 'record_flux_credit_usage') { calls.charges++; throw Error('No real or synthetic charge should be recorded by a preflight test'); }
    if (name === 'get_flux_credit_availability') return capacityEvidence || { data: { balance: wallet.balance, reserved: 0, available: wallet.balance }, error: null };
    if (name === 'reserve_flux_credit_capacity') return { data: { id: '30000000-0000-4000-8000-000000000001', organization_id: organizationId, status: 'held', reserved_credits: 2, created: true }, error: null };
    if (name === 'finish_flux_credit_capacity') return { data: { id: '30000000-0000-4000-8000-000000000001', organization_id: organizationId, status: args.p_outcome, reserved_credits: 2 }, error: null };
    assert.equal(name, 'sync_flux_credit_wallet_from_subscription');
    assert.equal(args.target_subscription_id, 'synthetic-subscription');
    return { data: walletError ? null : wallet, error: walletError };
  } };
  const credits = load('lib/flux-credits.ts', {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/fluxknight-plans': plans,
  }, '', { Error });
  const dependencies = { '@/lib/flux-credits': credits, '@/lib/fluxknight-plans': plans };
  const core = load('lib/flux-ai-metering-core.ts', dependencies, '', { Error });
  const response = { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200 }) } };
  const http = load('lib/flux-ai-metering.ts', { ...dependencies, 'next/server': response }, '', { Error });
  const route = load('app/api/internal/runtime/provider/execute/route.ts', {
    'next/server': response,
    '@/lib/runtime/auth': { assertRuntimeSecret: value => { if (value !== 'synthetic-runtime') throw Error('Unauthorized.'); } },
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/ai-runtime/migration': { runPhase12StructuredAgent: async () => { calls.provider++; throw Error('Synthetic provider boundary reached; no request sent'); } },
    '@/lib/flux-credits': credits,
    '@/lib/fluxknight-plans': plans,
    '@/lib/flux-ai-metering-core': core,
  }, '', { Error });
  function request(extra = {}, secret = 'synthetic-runtime') {
    return { headers: new Headers({ 'x-runtime-secret': secret }), json: async () => ({ organization_id: organizationId, agent_id: agentId, execution_id: 'synthetic-execution', purpose: 'runtime', ...extra }) };
  }
  return { credits, core, http, route, request, calls, wallet, failWallet: error => { walletError = error; }, capacity: evidence => { capacityEvidence = evidence; } };
}
const preflight = { organizationId, feature: 'core_ai_support', action: 'web_ai' };
for (const status of ['paused', 'suspended', 'cancelled', 'pending', 'unexpected']) {
  test(status + ' wallets remain readable but cannot authorize provider work or credit usage', async () => {
    const f = fixture({ status });
    assert.equal((await f.route.POST(f.request())).status, 409);
    assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
    const summary = await f.credits.getFluxWalletSummary(organizationId);
    assert.equal(summary.balance, 100);
    assert.equal(summary.chargeableAiPaused, true);
    assert.ok(summary.customerMessage);
    for (const metering of [f.core, f.http]) await assert.rejects(metering.preflightChargeableFluxAi(preflight), error => error.name === 'FluxCreditLimitError');
    await assert.rejects(f.credits.reserveFluxCredits({ organizationId, action: 'web_ai' }), error => error.name === 'FluxCreditLimitError');
    assert.equal((await f.route.POST(f.request())).status, 409);
    assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
    assert.ok(f.calls.queries.some(q => q.table === 'organization_subscriptions' && q.key === 'organization_id' && q.value === organizationId));
  });
}
for (const status of ['active', 'trialing']) {
  test(status + ' funded wallets retain their existing core AI access', async () => {
    const f = fixture({ status });
    assert.equal((await f.credits.getFluxWalletSummary(organizationId)).chargeableAiPaused, false);
    assert.equal((await f.core.preflightChargeableFluxAi(preflight)).credits, 2);
    assert.equal((await f.http.preflightChargeableFluxAi(preflight)).credits, 2);
    await f.route.POST(f.request());
    assert.equal(f.calls.provider, 1); assert.equal(f.calls.charges, 0);
  });
}
test('display rounding cannot exhaust a positive balance and the last affordable action remains usable', async () => {
  const f = fixture({ balance: 2 });
  await f.route.POST(f.request()); assert.equal(f.calls.provider, 1); assert.equal(f.calls.charges, 0);
  const summary = await f.credits.getFluxWalletSummary(organizationId);
  assert.equal(summary.balance, 2); assert.equal(summary.used, 11998);
  assert.equal(summary.percentUsed, 99); assert.equal(summary.threshold, 90);
  assert.equal(summary.chargeableAiPaused, false);
  assert.equal((await f.core.preflightChargeableFluxAi(preflight)).credits, 2);
  assert.equal(f.calls.provider, 1); assert.equal(f.calls.charges, 0);
});
test('zero balance is exhausted and insufficient credits still block the requested action', async () => {
  const empty = fixture({ balance: 0 });
  const summary = await empty.credits.getFluxWalletSummary(organizationId);
  assert.equal(summary.chargeableAiPaused, true); assert.equal(summary.percentUsed, 100); assert.equal(summary.threshold, 100);
  for (const balance of [0, 1]) {
    const f = fixture({ balance }); await assert.rejects(f.core.preflightChargeableFluxAi(preflight), error => error.name === 'FluxCreditLimitError');
    await f.route.POST(f.request()); assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
  }
  const last = fixture({ balance: 2 });
  await assert.rejects(last.core.preflightChargeableFluxAi({ ...preflight, action: 'whatsapp_ai' }), error => error.name === 'FluxCreditLimitError');
});
test('expired trials remain blocked even when the wallet still has credits', async () => {
  const f = fixture({ status: 'trialing', trial_credit_limit: 250, trial_ends_at: new Date(Date.now() - 1000).toISOString() });
  await assert.rejects(f.core.preflightChargeableFluxAi(preflight), error => error.name === 'FluxCreditLimitError');
  await f.route.POST(f.request()); assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
});
test('valid free trials retain core AI while paid-only feature gates remain intact', async () => {
  const f = fixture({ status: 'trialing', plan_code: 'basic', trial_credit_limit: 250, trial_ends_at: new Date(Date.now() + 86400000).toISOString() });
  assert.equal((await f.core.preflightChargeableFluxAi(preflight)).credits, 2);
  await assert.rejects(f.core.preflightChargeableFluxAi({ ...preflight, feature: 'leo_voice', action: 'leo_voice_minute' }), error => error.name === 'FluxTrialFeatureGateError');
  assert.equal(f.calls.charges, 0);
});
test('top-up-funded balances retain normal access without repricing plans or changing action units', async () => {
  const f = fixture({ balance: 13000, top_up_balance: 1000 });
  const summary = await f.credits.getFluxWalletSummary(organizationId);
  assert.equal(summary.balance, 13000); assert.equal(summary.used, 0); assert.equal(summary.percentUsed, 0); assert.equal(summary.chargeableAiPaused, false);
  assert.equal((await f.core.preflightChargeableFluxAi(preflight)).credits, plans.FLUX_CREDIT_ACTION_RATES.web_ai);
});
test('unavailable wallet data cannot become a healthy or empty wallet', async () => {
  const f = fixture(); f.failWallet(Error('Synthetic wallet unavailable'));
  await assert.rejects(f.credits.getFluxWalletSummary(organizationId), /Synthetic wallet unavailable/);
  await f.route.POST(f.request()); assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
});
test('existing runtime authorization and execution tenant checks still run before provider work', async () => {
  const f = fixture();
  assert.equal((await f.route.POST(f.request({}, 'invalid'))).status, 401);
  assert.equal(f.calls.queries.length, 0);
  assert.equal((await f.route.POST(f.request({ organization_id: 'foreign-tenant' }))).status, 404);
  assert.equal(f.calls.provider, 0); assert.equal(f.calls.charges, 0);
});

test('shared legacy preflight respects held capacity before reaching providers', async () => {
 const f=fixture(); f.capacity({data:{balance:100,reserved:100,available:0},error:null});
 for(const metering of [f.core,f.http]) await assert.rejects(metering.preflightChargeableFluxAi(preflight),error=>error.name==='FluxCreditLimitError');
 assert.equal((await f.route.POST(f.request())).status,409);assert.equal(f.calls.provider,0);
});
test('unavailable capacity evidence fails closed before provider work', async () => {
 const f=fixture(); f.capacity({data:null,error:Error('Synthetic unavailable capacity')});
 for(const metering of [f.core,f.http]) await assert.rejects(metering.preflightChargeableFluxAi(preflight),/capacity evidence is unavailable/);
 assert.equal((await f.route.POST(f.request())).status,409);assert.equal(f.calls.provider,0);
});
