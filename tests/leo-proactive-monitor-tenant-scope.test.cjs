const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const root = path.resolve(__dirname, '..');
const LIMITLESS = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const OTHER = '7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const now = new Date('2026-10-24T12:00:00.000Z');

test('proactive campaign and lead signals retain explicit tenant IDs and tenant-specific links', async () => {
  const organizationIdsQueried = [];
  const profileRows = [
    { organization_id: LIMITLESS, business_name: 'Limitless Realty', status: 'live', created_at: now.toISOString(), updated_at: now.toISOString() },
    { organization_id: OTHER, business_name: 'Fixture Realty', status: 'live', created_at: now.toISOString(), updated_at: now.toISOString() },
  ];
  const leadRows = [LIMITLESS, OTHER].map((organization_id, index) => ({
    id: `lead-${index + 1}`,
    organization_id,
    name: index === 0 ? 'Limitless fixture' : 'Other tenant fixture',
    phone: '2348000000000',
    status: 'qualified',
    score: 'hot',
    last_contacted_at: null,
    last_follow_up_at: null,
    created_at: new Date(now.getTime() - 30 * 60 * 60 * 1000).toISOString(),
  }));
  const admin = {
    from(table) {
      const state = { organizationIds: [] };
      const query = {
        select() { return query; },
        in(column, values) {
          assert.equal(table, 'leads');
          assert.equal(column, 'organization_id');
          state.organizationIds = values;
          organizationIdsQueried.push(...values);
          return query;
        },
        limit() {
          const data = table === 'leads'
            ? leadRows.filter((row) => state.organizationIds.includes(row.organization_id))
            : [];
          return Promise.resolve({ data, error: null });
        },
      };
      return query;
    },
  };
  const monitor = load(path.join(root, 'lib/leo-proactive-monitor.ts'), {
    '@/lib/supabase/admin': { createAdminClient: () => admin },
    '@/lib/campaign-report-reader': {
      getDetailedCampaignReports: async (organization_id) => [{
        id: `campaign-${organization_id}`,
        organization_id,
        campaign_topic: 'Fixture update',
        status: 'failed_after_acceptance',
        attempted: 1,
        accepted: 1,
        sent: 0,
        delivered: 0,
        read: 0,
        failed: 1,
        skipped: 0,
        pending_delivery: 0,
        unresolved: 0,
        created_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
        recipients: [],
      }],
    },
    '@/lib/client-workspace-onboarding': { listClientOnboardingProfiles: async () => profileRows },
    '@/lib/limitless-data': { LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS },
    '@/lib/workflow-registry': { getWorkflowRuns: async () => [], getWorkflows: async () => [] },
    '@/lib/leo-lifecycle-proactive-monitor': { scanLifecycleProactiveSignals: async () => ({ generatedAt: now.toISOString(), organizations: 2, signals: [] }) },
  });

  const result = await monitor.scanLeoProactiveSignals({ now, limit: 100 });
  assert.deepEqual([...new Set(organizationIdsQueried)].sort(), [LIMITLESS, OTHER].sort());
  for (const [organization_id, name, campaignHref, leadHref] of [
    [LIMITLESS, 'Limitless Realty', '/dashboard/limitless/campaigns', '/dashboard/limitless/leads'],
    [OTHER, 'Fixture Realty', '/dashboard/clients', '/dashboard/clients'],
  ]) {
    const campaign = result.signals.find((item) => item.category === 'campaign' && item.evidence.organization_id === organization_id);
    const lead = result.signals.find((item) => item.category === 'lead' && item.evidence.organization_id === organization_id);
    assert.ok(campaign, `campaign signal exists for ${name}`);
    assert.ok(lead, `lead signal exists for ${name}`);
    assert.equal(campaign.workspace, name);
    assert.equal(campaign.href, campaignHref);
    assert.equal(lead.workspace, name);
    assert.equal(lead.href, leadHref);
  }
});
