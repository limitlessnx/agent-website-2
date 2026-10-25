const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const root = path.resolve(__dirname, '..');

test('claimHumanHandoff returns the persisted tenant-bound claim', async () => {
  const updates = [];
  const updateFilters = [];
  const original = {
    id: 'handoff-1',
    organization_id: 'org-1',
    status: 'pending',
    assigned_membership_id: null,
    claimed_by_membership_id: null,
    claimed_at: null,
  };
  const admin = {
    from(table) {
      const state = { update: null };
      const query = {
        select() { return query; },
        eq(...args) { if (state.update) updateFilters.push(['eq', ...args]); return query; },
        not(...args) { if (state.update) updateFilters.push(['not', ...args]); return query; },
        or(...args) { if (state.update) updateFilters.push(['or', ...args]); return query; },
        update(values) { state.update = values; updates.push([table, values]); return query; },
        maybeSingle() { return Promise.resolve({ data: state.update ? { ...original, ...state.update } : original, error: null }); },
        single() { return Promise.resolve({ data: { ...original, ...state.update }, error: null }); },
      };
      return query;
    },
  };
  const operations = load(path.join(root, 'lib/human-operations.ts'), {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/organization-membership': {
      getOrganizationAccessContext: async () => ({ organizationId: 'org-1', userId: 'user-1', membershipId: 'member-1', permissions: new Set(['handoffs.view']) }),
      assertAnyOrganizationPermission() {},
      listOrganizationMembers: async () => [],
    },
    '@/lib/whatsapp-delivery': { sendWhatsAppMessage: async () => { throw new Error('claim must not send a message'); } },
    '@/lib/ai/limitless-handoff-policy.mjs': {
      LIMITLESS_REALTY_ORGANIZATION_ID: 'org-limitless',
      createLimitlessHumanHandoff: async () => ({}),
    },
  });

  const result = await operations.claimHumanHandoff({ organizationId: 'org-1', userId: 'user-1' }, 'handoff-1');
  assert.equal(result.id, 'handoff-1');
  assert.equal(result.organization_id, 'org-1');
  assert.equal(result.status, 'in_progress');
  assert.equal(result.assigned_membership_id, 'member-1');
  assert.equal(result.claimed_by_membership_id, 'member-1');
  assert.equal(updates.length, 1);
  assert.equal(updates[0][0], 'human_handoffs');
  assert.ok(updateFilters.some(([kind, field, operator]) => kind === 'not' && field === 'status' && operator === 'in'));
  assert.ok(updateFilters.some(([kind, expression]) => kind === 'or' && expression.includes('claimed_by_membership_id.is.null')));
});

test('resolveHumanHandoff stops when a competing resolver wins the terminal-state CAS', async () => {
  const sideEffects = [];
  const handoff = {
    id: 'handoff-1', organization_id: 'org-1', status: 'in_progress', customer_id: 'customer-1',
    conversation_id: 'conversation-1', assigned_membership_id: 'member-1', claimed_by_membership_id: 'member-1',
  };
  const admin = {
    from(table) {
      const state = { update: false };
      const query = {
        select() { return query; },
        eq() { return query; },
        not() { return query; },
        or() { return query; },
        update() { state.update = true; return query; },
        insert() { sideEffects.push(`insert:${table}`); return query; },
        maybeSingle() {
          return Promise.resolve(state.update
            ? { data: null, error: null }
            : { data: handoff, error: null });
        },
      };
      return query;
    },
    rpc() { sideEffects.push('rpc'); return Promise.resolve({ data: null, error: null }); },
  };
  const operations = load(path.join(root, 'lib/human-operations.ts'), {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/organization-membership': {
      getOrganizationAccessContext: async () => ({ organizationId: 'org-1', userId: 'user-1', membershipId: 'member-1', permissions: new Set(['handoffs.view']) }),
      assertAnyOrganizationPermission() {},
      listOrganizationMembers: async () => [],
    },
    '@/lib/whatsapp-delivery': { sendWhatsAppMessage: async () => { throw new Error('resolve must not send a message'); } },
    '@/lib/ai/limitless-handoff-policy.mjs': {
      LIMITLESS_REALTY_ORGANIZATION_ID: 'org-limitless',
      createLimitlessHumanHandoff: async () => ({}),
    },
  });

  await assert.rejects(
    operations.resolveHumanHandoff({ organizationId: 'org-1', userId: 'user-1' }, 'handoff-1', 'completed', true),
    /ownership changed|resolved by another operator/i,
  );
  assert.deepEqual(sideEffects, []);
});
