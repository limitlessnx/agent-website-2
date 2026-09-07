import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { getUnifiedLifecycleSnapshots } from "@/lib/lifecycle-intelligence";

export type DashboardNotificationSeverity = "info" | "success" | "warning" | "critical";
export type DashboardNotificationAudience = "customer" | "admin" | "both";

export type DashboardNotification = {
  id: string;
  eventKey: string;
  organizationId: string;
  audience: DashboardNotificationAudience;
  category: string;
  severity: DashboardNotificationSeverity;
  title: string;
  message: string;
  actionLabel: string | null;
  actionHref: string | null;
  source: string;
  persistent: boolean;
  metadata: Record<string, unknown>;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
};

type NotificationRow = {
  id: string;
  event_key: string;
  organization_id: string;
  audience: DashboardNotificationAudience;
  category: string;
  severity: DashboardNotificationSeverity;
  title: string;
  message: string;
  action_label: string | null;
  action_href: string | null;
  source: string;
  persistent: boolean;
  metadata: Record<string, unknown> | null;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type ReadRow = { notification_id: string; read_at: string };

function mapNotification(row: NotificationRow, readAt: string | null): DashboardNotification {
  return {
    id: row.id,
    eventKey: row.event_key,
    organizationId: row.organization_id,
    audience: row.audience,
    category: row.category,
    severity: row.severity,
    title: row.title,
    message: row.message,
    actionLabel: row.action_label,
    actionHref: row.action_href,
    source: row.source,
    persistent: row.persistent,
    metadata: row.metadata || {},
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    resolvedAt: row.resolved_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readAt,
  };
}

export async function listOrganizationDashboardNotifications(organizationId: string, userId: string, limit = 100) {
  const rows = await supabaseServerRequest<NotificationRow[]>(
    `dashboard_notifications?organization_id=eq.${encodeURIComponent(organizationId)}&audience=in.(customer,both)&order=created_at.desc&limit=${Math.min(200, Math.max(1, limit))}`,
  ).catch(() => []);

  if (!rows.length) return [];
  const ids = rows.map((row) => row.id).join(",");
  const reads = await supabaseServerRequest<ReadRow[]>(
    `dashboard_notification_reads?user_id=eq.${encodeURIComponent(userId)}&notification_id=in.(${ids})&select=notification_id,read_at`,
  ).catch(() => []);
  const readById = new Map(reads.map((row) => [row.notification_id, row.read_at]));
  const now = Date.now();

  return rows
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > now || row.persistent)
    .map((row) => mapNotification(row, readById.get(row.id) || null));
}

export async function getOrganizationUnreadNotificationCount(organizationId: string, userId: string) {
  const rows = await listOrganizationDashboardNotifications(organizationId, userId, 200);
  return rows.filter((row) => !row.readAt && !row.resolvedAt).length;
}

export async function markDashboardNotificationRead(organizationId: string, userId: string, notificationId: string) {
  const owned = await supabaseServerRequest<Array<{ id: string }>>(
    `dashboard_notifications?id=eq.${encodeURIComponent(notificationId)}&organization_id=eq.${encodeURIComponent(organizationId)}&audience=in.(customer,both)&select=id&limit=1`,
  );
  if (!owned[0]) throw new Error("Notification not found.");

  await supabaseServerRequest(
    `dashboard_notification_reads?on_conflict=notification_id,user_id`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ notification_id: notificationId, user_id: userId, read_at: new Date().toISOString() }),
    },
  );
}

export async function markAllDashboardNotificationsRead(organizationId: string, userId: string) {
  const rows = await supabaseServerRequest<Array<{ id: string }>>(
    `dashboard_notifications?organization_id=eq.${encodeURIComponent(organizationId)}&audience=in.(customer,both)&resolved_at=is.null&select=id&limit=500`,
  );
  if (!rows.length) return 0;
  const readAt = new Date().toISOString();
  await supabaseServerRequest(
    `dashboard_notification_reads?on_conflict=notification_id,user_id`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.map((row) => ({ notification_id: row.id, user_id: userId, read_at: readAt }))),
    },
  );
  return rows.length;
}

async function upsertLifecycleNotification(input: {
  eventKey: string;
  organizationId: string;
  audience: DashboardNotificationAudience;
  category: string;
  severity: DashboardNotificationSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  persistent?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  await supabaseServerRequest(
    `dashboard_notifications?on_conflict=event_key`,
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        event_key: input.eventKey,
        organization_id: input.organizationId,
        audience: input.audience,
        category: input.category,
        severity: input.severity,
        title: input.title,
        message: input.message,
        action_label: input.actionLabel || null,
        action_href: input.actionHref || null,
        source: "lifecycle",
        persistent: Boolean(input.persistent),
        metadata: input.metadata || {},
        last_seen_at: now,
        resolved_at: null,
        updated_at: now,
      }),
    },
  );
}

export async function syncLifecycleDashboardNotifications(organizationId?: string) {
  const snapshots = await getUnifiedLifecycleSnapshots(30).catch(() => []);
  const selected = organizationId ? snapshots.filter((item) => item.organizationId === organizationId) : snapshots;

  for (const item of selected) {
    if (item.attention === "high" || item.attention === "critical") {
      await upsertLifecycleNotification({
        eventKey: `lifecycle:${item.organizationId}:risk:${item.attention}`,
        organizationId: item.organizationId,
        audience: "both",
        category: "health",
        severity: item.attention === "critical" ? "critical" : "warning",
        title: item.attention === "critical" ? "Your workspace needs immediate attention" : "Your workspace needs attention",
        message: item.reasons[0] || item.recommendedNextAction,
        actionLabel: "Review support",
        actionHref: "/portal/support",
        persistent: item.attention === "critical",
        metadata: { stage: item.stage, healthScore: item.healthScore, retentionRiskScore: item.retentionRiskScore },
      });
    }

    if (item.stage === "expansion" && item.attention !== "high" && item.attention !== "critical") {
      await upsertLifecycleNotification({
        eventKey: `lifecycle:${item.organizationId}:expansion`,
        organizationId: item.organizationId,
        audience: "admin",
        category: "expansion",
        severity: "info",
        title: `${item.organizationName} has an expansion signal`,
        message: item.recommendedNextAction,
        actionLabel: "Review opportunity",
        actionHref: `/dashboard/expansion?organizationId=${encodeURIComponent(item.organizationId)}`,
        metadata: { opportunityScore: item.opportunityScore, stage: item.stage },
      });
    }
  }
}
