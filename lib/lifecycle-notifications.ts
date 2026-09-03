export type LifecycleNotificationSeverity = "info" | "success" | "warning" | "critical";

export type LifecycleNotificationAudience = "customer" | "admin" | "both";

export type LifecycleNotificationChannel = "dashboard" | "email" | "admin";

export type LifecycleNotificationCategory =
  | "health"
  | "usage"
  | "integration"
  | "support"
  | "account"
  | "billing"
  | "security"
  | "expansion"
  | "retention";

export type LifecycleNotificationEvent = {
  id: string;
  organizationId: string;
  userId?: string | null;
  category: LifecycleNotificationCategory;
  severity: LifecycleNotificationSeverity;
  audience: LifecycleNotificationAudience;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionHref?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  readAt?: string | null;
  dismissedAt?: string | null;
};

export type LifecycleRoutingDecision = {
  channels: LifecycleNotificationChannel[];
  reason: string;
};

/**
 * Dashboard-first routing policy.
 *
 * The dashboard is the default customer communication surface.
 * Email is reserved for events that are financial, security-sensitive,
 * account-critical, or explicitly intended as a periodic summary.
 */
export function routeLifecycleNotification(
  event: Pick<LifecycleNotificationEvent, "category" | "severity" | "audience">,
): LifecycleRoutingDecision {
  const channels = new Set<LifecycleNotificationChannel>();

  if (event.audience === "customer" || event.audience === "both") {
    channels.add("dashboard");
  }

  if (event.audience === "admin" || event.audience === "both") {
    channels.add("admin");
  }

  const emailCriticalCategories: LifecycleNotificationCategory[] = [
    "billing",
    "security",
    "account",
  ];

  if (
    (event.audience === "customer" || event.audience === "both") &&
    (emailCriticalCategories.includes(event.category) || event.severity === "critical")
  ) {
    channels.add("email");
  }

  return {
    channels: [...channels],
    reason:
      channels.has("email")
        ? "Dashboard-first routing with email escalation for critical, billing, security, or account events."
        : "Dashboard-first routing; no email required for this lifecycle event.",
  };
}
