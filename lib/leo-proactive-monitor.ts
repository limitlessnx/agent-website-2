import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDetailedCampaignReports } from "@/lib/campaign-report-reader";
import { listClientOnboardingProfiles } from "@/lib/client-workspace-onboarding";
import { getLeads } from "@/lib/limitless-data";
import { getWorkflowRuns, getWorkflows } from "@/lib/workflow-registry";

export type LeoSignalSeverity = "critical" | "high" | "medium" | "low";
export type LeoSignalCategory = "workflow" | "campaign" | "lead" | "workspace" | "integration";
export type LeoProactiveSignal = {
  id: string;
  category: LeoSignalCategory;
  severity: LeoSignalSeverity;
  title: string;
  summary: string;
  recommendation: string;
  href: string;
  detectedAt: string;
  sourceId?: string;
  workspace?: string;
  evidence: Record<string, unknown>;
};

const severityRank: Record<LeoSignalSeverity, number> = { critical: 4, high: 3, medium: 2, low: 1 };
const HOUR = 60 * 60 * 1000;

function ageMs(value?: string | null, now = Date.now()) {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, now - time) : Number.POSITIVE_INFINITY;
}

function stableId(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
}

function signal(input: Omit<LeoProactiveSignal, "id" | "detectedAt"> & { detectedAt?: string }) : LeoProactiveSignal {
  const detectedAt = input.detectedAt || new Date().toISOString();
  return { ...input, detectedAt, id: stableId([input.category, input.sourceId || "", input.title, input.workspace || ""]) };
}

async function getIntegrationHealth() {
  const supabase = createAdminClient();
  const result = await supabase.from("organization_integrations").select("id,organization_id,provider,display_name,status,last_checked_at").limit(300);
  if (result.error) return [] as Array<{ id: string; organization_id: string; provider: string; display_name?: string | null; status: string; last_checked_at?: string | null }>;
  return result.data || [];
}

export async function scanLeoProactiveSignals(options: { now?: Date; limit?: number } = {}) {
  const now = options.now || new Date();
  const nowMs = now.getTime();
  const [workflows, runs, campaigns, leads, clients, integrations] = await Promise.all([
    getWorkflows(150, true).catch(() => []),
    getWorkflowRuns(300).catch(() => []),
    getDetailedCampaignReports(40).catch(() => []),
    getLeads(250).catch(() => []),
    listClientOnboardingProfiles(100).catch(() => []),
    getIntegrationHealth().catch(() => []),
  ]);

  const signals: LeoProactiveSignal[] = [];

  for (const workflow of workflows) {
    if (workflow.status === "error") signals.push(signal({ category: "workflow", severity: "critical", title: `${workflow.name} is in an error state`, summary: `Workflow ${workflow.workflow_key} is marked error and may not be processing new work.`, recommendation: "Inspect the latest failed run and error before resuming or changing the workflow.", href: "/dashboard/agent-operations", sourceId: workflow.id, workspace: workflow.organization_id, evidence: { organization_id: workflow.organization_id, workflow_key: workflow.workflow_key, status: workflow.status, last_error_at: workflow.last_error_at || null } }));
  }

  for (const run of runs) {
    if (!["failed", "timed_out"].includes(run.status)) continue;
    const created = run.created_at || run.started_at || run.completed_at;
    if (ageMs(created, nowMs) > 24 * HOUR) continue;
    signals.push(signal({ category: "workflow", severity: run.status === "timed_out" ? "high" : "critical", title: `Recent ${run.status.replaceAll("_", " ")} workflow run`, summary: `${run.workflow_key} ${run.status === "timed_out" ? "timed out" : "failed"}${run.error_message ? `: ${run.error_message.slice(0, 180)}` : "."}`, recommendation: "Inspect the failed execution, confirm whether the cause is transient, then retry only if the action is safe to repeat.", href: "/dashboard/agent-operations", sourceId: run.id, workspace: run.organization_id, evidence: { organization_id: run.organization_id, workflow_key: run.workflow_key, status: run.status, attempt: run.attempt, created_at: created || null, error: run.error_message || null } }));
  }

  for (const integration of integrations) {
    const status = String(integration.status || "").toLowerCase();
    const unhealthy = ["error", "disconnected", "expired", "failed", "invalid", "revoked"].includes(status);
    const stale = status === "connected" && ageMs(integration.last_checked_at, nowMs) > 7 * 24 * HOUR;
    if (!unhealthy && !stale) continue;
    signals.push(signal({ category: "integration", severity: unhealthy ? "high" : "low", title: `${integration.display_name || integration.provider || "Integration"} needs attention`, summary: unhealthy ? `Integration status is ${status}. Dependent workflows may be affected.` : "Integration health has not been checked in more than seven days.", recommendation: "Inspect connection health and dependent workflows before changing credentials or reconnecting the provider.", href: "/dashboard/integrations", sourceId: integration.id, workspace: integration.organization_id, evidence: { organization_id: integration.organization_id, provider: integration.provider, status, last_checked_at: integration.last_checked_at || null } }));
  }

  for (const campaign of campaigns) {
    if (ageMs(campaign.created_at, nowMs) > 48 * HOUR) continue;
    if (campaign.failed > 0) {
      const severity: LeoSignalSeverity = campaign.accepted > 0 && campaign.failed >= campaign.accepted ? "critical" : "high";
      signals.push(signal({ category: "campaign", severity, title: `${campaign.failed} WhatsApp campaign failure${campaign.failed === 1 ? "" : "s"}`, summary: `${campaign.campaign_topic}: ${campaign.accepted} accepted, ${campaign.delivered} delivered, ${campaign.read} read, ${campaign.failed} failed, ${campaign.unresolved} unresolved.`, recommendation: "Review provider failure evidence and isolate affected recipients before considering any resend.", href: "/dashboard/limitless/campaigns", sourceId: campaign.id, workspace: "limitless_realty", evidence: { execution_id: campaign.execution_id || null, status: campaign.status, accepted: campaign.accepted, delivered: campaign.delivered, read: campaign.read, failed: campaign.failed, unresolved: campaign.unresolved, note: campaign.final_status_note || null } }));
    } else if ((campaign.unresolved > 0 || campaign.pending_delivery > 0) && ageMs(campaign.created_at, nowMs) > 30 * 60 * 1000) {
      signals.push(signal({ category: "campaign", severity: "medium", title: "Campaign delivery evidence is still unresolved", summary: `${campaign.campaign_topic} still has ${campaign.unresolved || campaign.pending_delivery} unresolved delivery outcome${(campaign.unresolved || campaign.pending_delivery) === 1 ? "" : "s"}.`, recommendation: "Re-check delivery evidence before reporting the campaign as complete or attempting another send.", href: "/dashboard/limitless/campaigns", sourceId: campaign.id, workspace: "limitless_realty", evidence: { execution_id: campaign.execution_id || null, status: campaign.status, unresolved: campaign.unresolved, pending_delivery: campaign.pending_delivery, created_at: campaign.created_at } }));
    }
  }

  for (const lead of leads) {
    const status = String(lead.status || "").toLowerCase();
    const score = String(lead.score || "").toLowerCase();
    const qualified = ["qualified", "hot", "ready", "ready_to_buy"].includes(status) || score === "hot";
    const reference = lead.last_contacted_at || lead.last_follow_up_at || lead.created_at;
    const age = ageMs(reference, nowMs);
    if (qualified && age > 24 * HOUR) signals.push(signal({ category: "lead", severity: age > 72 * HOUR ? "high" : "medium", title: "Qualified lead may be going untouched", summary: `${lead.name || lead.phone || "A Limitless Realty lead"} is marked ${status || score || "qualified"} and has no recorded contact activity within the last ${Math.floor(age / HOUR)} hours.`, recommendation: "Review the lead history and prepare the appropriate next follow-up rather than sending blindly.", href: "/dashboard/limitless/leads", sourceId: lead.id, workspace: "limitless_realty", evidence: { lead_id: lead.id, status, score, last_contacted_at: lead.last_contacted_at || null, last_follow_up_at: lead.last_follow_up_at || null, created_at: lead.created_at || null } }));
  }

  for (const client of clients) {
    if (["live", "paused"].includes(client.status)) continue;
    const age = ageMs(client.updated_at || client.created_at, nowMs);
    if (age < 48 * HOUR) continue;
    signals.push(signal({ category: "workspace", severity: age > 7 * 24 * HOUR ? "medium" : "low", title: "Client workspace onboarding appears stalled", summary: `${client.business_name || client.business_email || "A client workspace"} remains in ${client.status.replaceAll("_", " ")} after ${Math.floor(age / HOUR)} hours without a newer onboarding update.`, recommendation: "Review the onboarding blocker and confirm whether configuration, testing, or approval is waiting on someone.", href: "/dashboard/clients", sourceId: client.id, workspace: client.organization_id, evidence: { organization_id: client.organization_id, status: client.status, current_step: client.current_step, updated_at: client.updated_at, created_at: client.created_at } }));
  }

  const deduped = [...new Map(signals.map((item) => [item.id, item])).values()].sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.detectedAt.localeCompare(a.detectedAt));
  const duplicateCount = Math.max(0, signals.length - deduped.length);
  const limit = Math.max(1, Math.min(Number(options.limit) || 50, 100));
  const selected = deduped.slice(0, limit);
  return {
    generatedAt: now.toISOString(), total: selected.length,
    critical: selected.filter((item) => item.severity === "critical").length,
    high: selected.filter((item) => item.severity === "high").length,
    medium: selected.filter((item) => item.severity === "medium").length,
    low: selected.filter((item) => item.severity === "low").length,
    audit: { rawSignals: signals.length, deduplicatedSignals: deduped.length, duplicateCount, truncated: deduped.length > selected.length, sources: { workflows: workflows.length, runs: runs.length, campaigns: campaigns.length, leads: leads.length, clients: clients.length, integrations: integrations.length } },
    signals: selected,
  };
}
