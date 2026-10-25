const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const root = path.resolve(__dirname, '..');

test('claimHumanHandoff returns the persisted tenant-bound claim', async () => {
  const updates = [];
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
        eq() { return query; },
        update(values) { state.update = values; updates.push([table, values]); return query; },
        maybeSingle() { return Promise.resolve({ data: original, error: null }); },
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
});
