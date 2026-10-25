const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = require('./helpers/load-typescript.cjs');

const root = path.resolve(__dirname, '..');
const LIMITLESS = 'b15f21b4-5697-4d21-9421-8a34eae3476d';
const OTHER = '7f3b2dc2-9be5-4f1e-9ac2-11ab5f0542d4';
const now = new Date('2026-10-25T20:00:00.000Z');

function target(organizationId, name, slug) {
  return { organizationId, name, slug, aliases: [], relation: 'owned' };
}

function mocks(resolvedTarget, reportCalls) {
  return {
    '@/lib/leo-workspace-portfolio': {
      listLeoWorkspacePortfolio: async () => [],
      resolveLeoWorkspaceTarget: async () => resolvedTarget,
    },
    '@/lib/leo-autonomous-goals': {
      listLeoAutonomousGoals: async () => [],
      summarizeLeoGoalHealth: () => ({ critical: 0, attention: 0 }),
    },
    '@/lib/leo-proactive-monitor': {
      scanLeoProactiveSignals: async () => ({ generatedAt: now.toISOString(), total: 0, critical: 0, high: 0, medium: 0, low: 0, audit: {}, signals: [] }),
    },
    '@/lib/workflow-registry': {
      getWorkflowRuns: async () => [],
      getWorkflows: async () => [],
    },
    '@/lib/limitless-data': {
      getLeads: async () => [],
      LIMITLESS_REALTY_ORGANIZATION_ID: LIMITLESS,
    },
    '@/lib/campaign-report-reader': {
      getDetailedCampaignReports: async (organizationId, limit) => {
        reportCalls.push([organizationId, limit]);
        return [];
      },
    },
    '@/lib/supabase/admin': {
      createAdminClient: () => ({
        from: () => ({
          select: () => ({ limit: async () => ({ data: [], error: null }) }),
        }),
      }),
    },
  };
}

const builders = [
  { file: 'leo-business-state.ts', exportName: 'buildLeoUnifiedBusinessState', limit: 150 },
  { file: 'leo-decision-intelligence.ts', exportName: 'buildLeoDecisionIntelligence', limit: 100 },
];

for (const builder of builders) {
  test(`${builder.exportName} requests campaign reports with the resolved workspace organization ID`, async () => {
    const reportCalls = [];
    const module = load(path.join(root, 'lib', builder.file), mocks(target(LIMITLESS, 'Limitless Realty', 'limitless-realty'), reportCalls));
    await module[builder.exportName]({ identity: { scope: 'super_admin' }, organizationId: LIMITLESS, now });
    assert.deepEqual(reportCalls, [[LIMITLESS, builder.limit]]);
  });

  test(`${builder.exportName} pins platform fallback reports to the canonical Limitless organization`, async () => {
    const reportCalls = [];
    const module = load(path.join(root, 'lib', builder.file), mocks(null, reportCalls));
    await module[builder.exportName]({ identity: { scope: 'super_admin' }, now });
    assert.deepEqual(reportCalls, [[LIMITLESS, builder.limit]]);
  });

  test(`${builder.exportName} does not request Limitless campaign reports for another tenant`, async () => {
    const reportCalls = [];
    const module = load(path.join(root, 'lib', builder.file), mocks(target(OTHER, 'Acme Holdings', 'acme-holdings'), reportCalls));
    await module[builder.exportName]({ identity: { scope: 'super_admin' }, organizationId: OTHER, now });
    assert.deepEqual(reportCalls, []);
  });
}
