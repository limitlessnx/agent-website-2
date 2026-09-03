import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type SupportPriority = "low" | "normal" | "high" | "critical";
export type SupportStatus = "open" | "diagnosing" | "waiting_approval" | "resolved" | "closed";

export type SupportLifecycleCase = {
  id: string;
  title: string;
  status: SupportStatus;
  priority: SupportPriority;
  assignedAgent: string;
  createdAt: string;
  updatedAt: string;
  responseTargetAt: string;
  targetState: "healthy" | "due_soon" | "overdue" | "resolved";
  escalationRequested: boolean;
  escalationRequired: boolean;
  recurringIssue: boolean;
  recurringCount: number;
  feedbackScore: number | null;
  feedbackComment: string | null;
};

type SupportConversationRow = {
  id: string;
  organization_id: string | null;
  title: string;
  status: SupportStatus;
  priority: SupportPriority;
  assigned_agent: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const TARGET_HOURS: Record<SupportPriority, number> = {
  critical: 1,
  high: 4,
  normal: 24,
  low: 48,
};

function lifecycleMetadata(metadata: Record<string, unknown> | null) {
  const value = metadata?.support_lifecycle;
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function issueSignature(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 3 && !["help", "with", "from", "that", "this", "have", "does", "work", "working", "issue", "problem"].includes(part))
    .slice(0, 5)
    .sort()
    .join(":");
}

function responseTargetAt(row: SupportConversationRow) {
  const lifecycle = lifecycleMetadata(row.metadata);
  const configured = typeof lifecycle.response_target_at === "string" ? lifecycle.response_target_at : "";
  if (configured) return configured;
  const created = new Date(row.created_at).getTime();
  return new Date(created + TARGET_HOURS[row.priority] * 60 * 60 * 1000).toISOString();
}

function targetState(row: SupportConversationRow, targetAt: string) {
  if (["resolved", "closed"].includes(row.status)) return "resolved" as const;
  const remaining = new Date(targetAt).getTime() - Date.now();
  if (remaining <= 0) return "overdue" as const;
  if (remaining <= 60 * 60 * 1000) return "due_soon" as const;
  return "healthy" as const;
}

export async function getSupportLifecycleCases(organizationId: string): Promise<SupportLifecycleCase[]> {
  const rows = await supabaseServerRequest<SupportConversationRow[]>(
    `support_conversations?select=id,organization_id,title,status,priority,assigned_agent,metadata,created_at,updated_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=100`,
  ).catch(() => []);

  const signatures = new Map<string, number>();
  for (const row of rows) {
    const signature = issueSignature(row.title);
    if (signature) signatures.set(signature, (signatures.get(signature) || 0) + 1);
  }

  return rows.map((row) => {
    const lifecycle = lifecycleMetadata(row.metadata);
    const signature = issueSignature(row.title);
    const recurringCount = signature ? signatures.get(signature) || 1 : 1;
    const targetAt = responseTargetAt(row);
    const state = targetState(row, targetAt);
    const feedbackScore = Number(lifecycle.feedback_score || 0);

    return {
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      assignedAgent: row.assigned_agent || "agent-leo",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      responseTargetAt: targetAt,
      targetState: state,
      escalationRequested: Boolean(lifecycle.escalation_requested_at),
      escalationRequired: Boolean(lifecycle.escalation_required) || row.priority === "critical" || state === "overdue",
      recurringIssue: recurringCount >= 3,
      recurringCount,
      feedbackScore: feedbackScore >= 1 && feedbackScore <= 5 ? feedbackScore : null,
      feedbackComment: typeof lifecycle.feedback_comment === "string" ? lifecycle.feedback_comment : null,
    };
  });
}

export function supportTargetHours(priority: SupportPriority) {
  return TARGET_HOURS[priority];
}

export function mergeSupportLifecycleMetadata(
  metadata: Record<string, unknown> | null,
  patch: Record<string, unknown>,
) {
  const base = { ...(metadata || {}) };
  const lifecycle = { ...lifecycleMetadata(metadata), ...patch };
  base.support_lifecycle = lifecycle;
  return base;
}
