import type { OrganizationIntegration } from "@/lib/platform-engine";
import type { LifecycleNotificationEvent } from "@/lib/lifecycle-notifications";

export type CustomerHealthBand = "healthy" | "watch" | "risk" | "critical";

export type CustomerHealthSignal = {
  key: string;
  label: string;
  impact: number;
  severity: "info" | "warning" | "critical";
  detail: string;
};

export type CustomerHealthSnapshot = {
  organizationId: string;
  organizationName: string;
  score: number;
  band: CustomerHealthBand;
  signals: CustomerHealthSignal[];
  connectedIntegrations: number;
  integrationCount: number;
  lastActivityAt: string | null;
  notifications: LifecycleNotificationEvent[];
};

type HealthInput = {
  organizationId: string;
  organizationName: string;
  integrations: OrganizationIntegration[];
  platformErrors?: string[];
  now?: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function ageInDays(value: string | null | undefined, now: Date) {
  if (!value) return null;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
}

function healthBand(score: number): CustomerHealthBand {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  if (score >= 40) return "risk";
  return "critical";
}

function mostRecentDate(values: Array<string | null | undefined>) {
  const dates = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => b.time - a.time);
  return dates[0]?.value || null;
}

export function calculateCustomerHealth(input: HealthInput): CustomerHealthSnapshot {
  const now = input.now || new Date();
  const signals: CustomerHealthSignal[] = [];
  let score = 100;

  const connected = input.integrations.filter((item) => item.status === "connected").length;
  const errors = input.integrations.filter((item) => ["error", "authentication_failed"].includes(item.status));
  const degraded = input.integrations.filter((item) => item.status === "degraded");
  const configuredButDisconnected = input.integrations.filter(
    (item) => item.has_credentials && ["disconnected", "paused"].includes(item.status),
  );

  if (errors.length) {
    const impact = Math.min(50, errors.length * 25);
    score -= impact;
    signals.push({
      key: "integration-error",
      label: "Integration failure",
      impact,
      severity: "critical",
      detail: `${errors.length} integration${errors.length === 1 ? "" : "s"} require immediate attention.`,
    });
  }

  if (degraded.length) {
    const impact = Math.min(24, degraded.length * 12);
    score -= impact;
    signals.push({
      key: "integration-degraded",
      label: "Integration degradation",
      impact,
      severity: "warning",
      detail: `${degraded.length} integration${degraded.length === 1 ? " is" : "s are"} degraded.`,
    });
  }

  if (configuredButDisconnected.length) {
    const impact = Math.min(30, configuredButDisconnected.length * 15);
    score -= impact;
    signals.push({
      key: "integration-disconnected",
      label: "Configured integration offline",
      impact,
      severity: "warning",
      detail: `${configuredButDisconnected.length} configured integration${configuredButDisconnected.length === 1 ? " is" : "s are"} not connected.`,
    });
  }

  const staleChecks = input.integrations.filter((item) => {
    const age = ageInDays(item.last_checked_at, now);
    return age !== null && age >= 1;
  });
  if (staleChecks.length) {
    const impact = Math.min(16, staleChecks.length * 4);
    score -= impact;
    signals.push({
      key: "stale-health-check",
      label: "Stale integration health",
      impact,
      severity: "warning",
      detail: `${staleChecks.length} integration health check${staleChecks.length === 1 ? " is" : "s are"} older than 24 hours.`,
    });
  }

  if (input.integrations.length > 0 && connected === 0) {
    score -= 10;
    signals.push({
      key: "no-connected-integrations",
      label: "No active channel",
      impact: 10,
      severity: "warning",
      detail: "No organization integration is currently connected.",
    });
  }

  if (input.platformErrors?.length) {
    const impact = Math.min(30, input.platformErrors.length * 10);
    score -= impact;
    signals.push({
      key: "platform-data-error",
      label: "Platform visibility issue",
      impact,
      severity: "warning",
      detail: `${input.platformErrors.length} platform data source${input.platformErrors.length === 1 ? " is" : "s are"} unavailable.`,
    });
  }

  const lastActivityAt = mostRecentDate(
    input.integrations.flatMap((item) => [item.last_checked_at, item.last_connected_at, item.updated_at]),
  );
  const inactivityDays = ageInDays(lastActivityAt, now);

  if (inactivityDays !== null && inactivityDays >= 30) {
    score -= 25;
    signals.push({
      key: "inactive-30-days",
      label: "Extended inactivity",
      impact: 25,
      severity: "critical",
      detail: `No integration activity has been recorded for ${inactivityDays} days.`,
    });
  } else if (inactivityDays !== null && inactivityDays >= 14) {
    score -= 15;
    signals.push({
      key: "inactive-14-days",
      label: "Low recent activity",
      impact: 15,
      severity: "warning",
      detail: `No integration activity has been recorded for ${inactivityDays} days.`,
    });
  }

  score = Math.max(0, Math.min(100, score));
  const band = healthBand(score);
  const createdAt = now.toISOString();
  const notifications: LifecycleNotificationEvent[] = [];

  if (errors.length) {
    notifications.push({
      id: `${input.organizationId}:health:integration-error`,
      organizationId: input.organizationId,
      category: "integration",
      severity: "critical",
      audience: "both",
      title: "An integration needs attention",
      message: `${errors.length} connected service${errors.length === 1 ? " has" : "s have"} entered an error state.`,
      actionLabel: "Review integrations",
      actionHref: `/dashboard/integrations?organizationId=${encodeURIComponent(input.organizationId)}`,
      metadata: { providers: errors.map((item) => item.provider), healthScore: score },
      createdAt,
    });
  }

  if (inactivityDays !== null && inactivityDays >= 14) {
    notifications.push({
      id: `${input.organizationId}:health:inactivity`,
      organizationId: input.organizationId,
      category: "health",
      severity: inactivityDays >= 30 ? "critical" : "warning",
      audience: "both",
      title: inactivityDays >= 30 ? "Workspace activity has dropped" : "Your workspace has been quiet",
      message: `No recent integration activity has been detected for ${inactivityDays} days.`,
      actionLabel: "Review workspace",
      actionHref: `/dashboard/clients?organizationId=${encodeURIComponent(input.organizationId)}`,
      metadata: { inactivityDays, healthScore: score },
      createdAt,
    });
  }

  if (score < 60) {
    notifications.push({
      id: `${input.organizationId}:health:admin-risk`,
      organizationId: input.organizationId,
      category: "health",
      severity: score < 40 ? "critical" : "warning",
      audience: "admin",
      title: `${input.organizationName} needs customer-success attention`,
      message: `Customer health is ${score}/100 with ${signals.length} active risk signal${signals.length === 1 ? "" : "s"}.`,
      actionLabel: "Review health",
      actionHref: `/dashboard/health?organizationId=${encodeURIComponent(input.organizationId)}`,
      metadata: { healthScore: score, band, signals: signals.map((signal) => signal.key) },
      createdAt,
    });
  }

  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    score,
    band,
    signals,
    connectedIntegrations: connected,
    integrationCount: input.integrations.length,
    lastActivityAt,
    notifications,
  };
}

export function calculateOrganizationHealthSnapshots(
  integrations: OrganizationIntegration[],
  platformErrors: string[] = [],
  now = new Date(),
) {
  const organizations = new Map<string, { name: string; integrations: OrganizationIntegration[] }>();

  for (const integration of integrations) {
    const current = organizations.get(integration.organization_id) || {
      name: integration.organization_name || "Organization",
      integrations: [],
    };
    current.integrations.push(integration);
    organizations.set(integration.organization_id, current);
  }

  return [...organizations.entries()]
    .map(([organizationId, organization]) =>
      calculateCustomerHealth({
        organizationId,
        organizationName: organization.name,
        integrations: organization.integrations,
        platformErrors,
        now,
      }),
    )
    .sort((a, b) => a.score - b.score || a.organizationName.localeCompare(b.organizationName));
}
