import type { SupportScope } from "@/lib/support-agent";

type UnknownRecord = Record<string, unknown>;

function safeString(value: unknown, max = 240) {
  if (typeof value !== "string") return null;
  const withoutUrls = value.replace(/https?:\/\/\S+/gi, "[redacted-url]");
  const withoutSecrets = withoutUrls.replace(
    /\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|authorization|bearer|service[_ -]?role)\b\s*[:=]\s*[^\s,;]+/gi,
    "$1=[redacted]",
  );
  return withoutSecrets.trim().slice(0, max) || null;
}

function safeDate(value: unknown) {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function rows(value: unknown): UnknownRecord[] {
  return Array.isArray(value) ? value.filter((item): item is UnknownRecord => Boolean(item && typeof item === "object" && !Array.isArray(item))) : [];
}

function countTruthyReadiness(readiness: UnknownRecord[]) {
  const keys = [
    "business_profile_ready",
    "prompt_ready",
    "knowledge_ready",
    "integrations_ready",
    "test_ready",
    "approval_ready",
    "workflow_ready",
  ];
  return readiness.map((item) => ({
    readinessScore: typeof item.readiness_score === "number" ? item.readiness_score : null,
    readyChecks: keys.filter((key) => item[key] === true).length,
    totalChecks: keys.length,
    refreshedAt: safeDate(item.refreshed_at),
  }));
}

export type SafeSupportDiagnostics = {
  scope: SupportScope;
  organizationId: string | null;
  collectedAt: string | null;
  organization: { name: string | null; status: string | null } | null;
  agents: Array<{ name: string | null; type: string | null; status: string | null }>;
  integrations: Array<{ name: string | null; provider: string | null; status: string | null; lastCheckedAt: string | null }>;
  workflows: Array<{ name: string | null; key: string | null; status: string | null; provider: string | null; lastRunAt: string | null; lastErrorAt: string | null }>;
  workflowRuns: Array<{ key: string | null; status: string | null; errorSummary: string | null; createdAt: string | null }>;
  runtimeExecutions: Array<{ status: string | null; errorCode: string | null; createdAt: string | null }>;
  subscription: { planName: string | null; status: string | null; currentPeriodEnd: string | null } | null;
  readiness: Array<{ readinessScore: number | null; readyChecks: number; totalChecks: number; refreshedAt: string | null }>;
  totals: {
    agents: number;
    integrations: number;
    workflows: number;
    workflowFailures: number;
    runtimeErrors: number;
  };
};

export function sanitizeSupportDiagnostics(
  diagnostics: UnknownRecord,
  scope: SupportScope,
  organizationId?: string,
): SafeSupportDiagnostics {
  const organizations = rows(diagnostics.organizations);
  const agents = rows(diagnostics.agents);
  const integrations = rows(diagnostics.integrations);
  const workflows = rows(diagnostics.workflows);
  const workflowRuns = rows(diagnostics.workflowRuns);
  const runtimeExecutions = rows(diagnostics.runtimeExecutions);
  const subscriptions = rows(diagnostics.subscriptions);
  const readiness = rows(diagnostics.readiness);
  const plans = rows(diagnostics.billingPlans);

  const organization = organizations[0];
  const subscription = subscriptions[0];
  const plan = plans.find((item) => item.id === subscription?.plan_id) || plans[0];

  return {
    scope,
    organizationId: organizationId || (typeof diagnostics.organizationId === "string" ? diagnostics.organizationId : null),
    collectedAt: safeDate(diagnostics.collectedAt),
    organization: organization
      ? {
          name: safeString(organization.name, 120),
          status: safeString(organization.status, 80),
        }
      : null,
    agents: agents.map((item) => ({
      name: safeString(item.name, 120),
      type: safeString(item.agent_type, 100),
      status: safeString(item.status, 80),
    })),
    integrations: integrations.map((item) => ({
      name: safeString(item.display_name, 120),
      provider: safeString(item.provider, 100),
      status: safeString(item.status, 80),
      lastCheckedAt: safeDate(item.last_checked_at),
    })),
    workflows: workflows.map((item) => ({
      name: safeString(item.name, 140),
      key: safeString(item.workflow_key, 140),
      status: safeString(item.status, 80),
      provider: safeString(item.provider, 100),
      lastRunAt: safeDate(item.last_run_at),
      lastErrorAt: safeDate(item.last_error_at),
    })),
    workflowRuns: workflowRuns.slice(0, 20).map((item) => ({
      key: safeString(item.workflow_key, 140),
      status: safeString(item.status, 80),
      errorSummary: safeString(item.error_message, 280),
      createdAt: safeDate(item.created_at),
    })),
    runtimeExecutions: runtimeExecutions.slice(0, 20).map((item) => ({
      status: safeString(item.status, 80),
      errorCode: safeString(item.error_code, 120),
      createdAt: safeDate(item.created_at),
    })),
    subscription: subscription
      ? {
          planName: safeString(plan?.name, 120),
          status: safeString(subscription.status, 80),
          currentPeriodEnd: safeDate(subscription.current_period_end),
        }
      : null,
    readiness: countTruthyReadiness(readiness),
    totals: {
      agents: agents.length,
      integrations: integrations.length,
      workflows: workflows.length,
      workflowFailures: workflowRuns.filter((item) => ["failed", "timed_out", "error"].includes(String(item.status || "").toLowerCase())).length,
      runtimeErrors: runtimeExecutions.filter((item) => ["failed", "error", "timed_out"].includes(String(item.status || "").toLowerCase())).length,
    },
  };
}
