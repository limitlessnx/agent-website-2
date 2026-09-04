import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type RetentionRiskLevel = "low" | "watch" | "high" | "critical";
export type RetentionStage = "retained" | "at_risk" | "cancellation_requested" | "suspended" | "churned";

export type RetentionSignal = {
  key: string;
  label: string;
  impact: number;
  detail: string;
};

export type RetentionSnapshot = {
  organizationId: string;
  organizationName: string;
  stage: RetentionStage;
  riskScore: number;
  riskLevel: RetentionRiskLevel;
  signals: RetentionSignal[];
  current30DayUsage: number;
  previous30DayUsage: number;
  unresolvedSupportCases: number;
  connectedIntegrations: number;
  cancellationReason: string | null;
  recommendedAction: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  status: string;
  metadata: Record<string, unknown> | null;
};

type UsageRow = { organization_id: string; quantity: number; occurred_at: string };
type IntegrationRow = { organization_id: string; status: string };
type SupportRow = { organization_id: string | null; status: string; priority: string; metadata: Record<string, unknown> | null };

function accountLifecycle(metadata: Record<string, unknown> | null) {
  const value = metadata?.account_lifecycle;
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function riskLevel(score: number): RetentionRiskLevel {
  if (score >= 70) return "critical";
  if (score >= 45) return "high";
  if (score >= 20) return "watch";
  return "low";
}

function stageFor(org: OrganizationRow, cancellationRequested: boolean): RetentionStage {
  if (org.status === "archived") return "churned";
  if (org.status === "suspended") return "suspended";
  if (cancellationRequested) return "cancellation_requested";
  return "retained";
}

function recommendedAction(stage: RetentionStage, level: RetentionRiskLevel, signals: RetentionSignal[]) {
  if (stage === "churned") return "Review the departure reason and prepare a targeted win-back path only if the account is still eligible for reactivation.";
  if (stage === "cancellation_requested") return "Review cancellation reason, recent support history and usage before proposing a save action. Do not auto-discount or auto-email.";
  if (stage === "suspended") return "Determine whether suspension is intentional, operational or billing-related before attempting recovery.";
  if (level === "critical" || level === "high") return "Assign customer-success review and address the highest-impact operational signal before discussing expansion or renewal.";
  if (signals.some((signal) => signal.key === "usage-decline")) return "Review the customer's current workflow value and identify where usage or adoption dropped.";
  return "No retention intervention is required. Continue monitoring normal product value and support signals.";
}

export async function getRetentionSnapshots(now = new Date()): Promise<RetentionSnapshot[]> {
  const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const [organizations, usage, integrations, support] = await Promise.all([
    supabaseServerRequest<OrganizationRow[]>("organizations?select=id,name,status,metadata&order=name.asc").catch(() => []),
    supabaseServerRequest<UsageRow[]>(`usage_ledger?select=organization_id,quantity,occurred_at&occurred_at=gte.${encodeURIComponent(previousStart)}&limit=10000`).catch(() => []),
    supabaseServerRequest<IntegrationRow[]>("organization_integrations?select=organization_id,status&limit=5000").catch(() => []),
    supabaseServerRequest<SupportRow[]>("support_conversations?select=organization_id,status,priority,metadata&limit=5000").catch(() => []),
  ]);

  return organizations.map((org) => {
    const lifecycle = accountLifecycle(org.metadata);
    const cancellationRequested = typeof lifecycle.cancellation_requested_at === "string" && Boolean(lifecycle.cancellation_requested_at);
    const cancellationReason = typeof lifecycle.cancellation_reason === "string" ? lifecycle.cancellation_reason : null;
    const orgUsage = usage.filter((row) => row.organization_id === org.id);
    const currentUsage = orgUsage.filter((row) => row.occurred_at >= currentStart).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const previousUsage = orgUsage.filter((row) => row.occurred_at >= previousStart && row.occurred_at < currentStart).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const orgIntegrations = integrations.filter((row) => row.organization_id === org.id);
    const connectedIntegrations = orgIntegrations.filter((row) => ["connected", "active", "healthy"].includes(String(row.status).toLowerCase())).length;
    const integrationErrors = orgIntegrations.filter((row) => ["error", "authentication_failed", "degraded"].includes(String(row.status).toLowerCase())).length;
    const orgSupport = support.filter((row) => row.organization_id === org.id);
    const unresolvedSupportCases = orgSupport.filter((row) => !["resolved", "closed"].includes(row.status)).length;
    const urgentSupport = orgSupport.filter((row) => !["resolved", "closed"].includes(row.status) && ["high", "critical"].includes(row.priority)).length;
    const escalatedSupport = orgSupport.filter((row) => {
      const value = row.metadata?.support_lifecycle;
      if (!value || typeof value !== "object" || Array.isArray(value)) return false;
      return Boolean((value as Record<string, unknown>).escalation_requested_at || (value as Record<string, unknown>).escalation_required);
    }).length;

    const signals: RetentionSignal[] = [];
    let score = 0;

    if (cancellationRequested) {
      score += 55;
      signals.push({ key: "cancellation-requested", label: "Cancellation intent", impact: 55, detail: cancellationReason || "A cancellation request is active." });
    }
    if (org.status === "suspended") {
      score += 45;
      signals.push({ key: "workspace-suspended", label: "Workspace suspended", impact: 45, detail: "The workspace is currently suspended." });
    }
    if (org.status === "archived") {
      score += 80;
      signals.push({ key: "workspace-archived", label: "Customer churned", impact: 80, detail: "The workspace is archived and should be treated as churned unless reactivation is explicitly requested." });
    }
    if (previousUsage > 0 && currentUsage <= previousUsage * 0.5) {
      score += 20;
      signals.push({ key: "usage-decline", label: "Usage declined", impact: 20, detail: `Recorded usage fell from ${Math.round(previousUsage)} to ${Math.round(currentUsage)} units across the last two 30-day periods.` });
    } else if (previousUsage === 0 && currentUsage === 0) {
      score += 12;
      signals.push({ key: "no-recorded-usage", label: "No recorded usage", impact: 12, detail: "No usage-ledger activity is available across the last 60 days." });
    }
    if (orgIntegrations.length > 0 && connectedIntegrations === 0) {
      score += 15;
      signals.push({ key: "no-connected-integrations", label: "No connected integrations", impact: 15, detail: "Configured integrations exist but none are currently healthy or connected." });
    }
    if (integrationErrors > 0) {
      const impact = Math.min(20, integrationErrors * 8);
      score += impact;
      signals.push({ key: "integration-risk", label: "Integration reliability risk", impact, detail: `${integrationErrors} integration${integrationErrors === 1 ? " is" : "s are"} degraded or failing.` });
    }
    if (urgentSupport > 0) {
      const impact = Math.min(24, urgentSupport * 12);
      score += impact;
      signals.push({ key: "urgent-support", label: "Urgent unresolved support", impact, detail: `${urgentSupport} high-priority or critical support case${urgentSupport === 1 ? " remains" : "s remain"} unresolved.` });
    }
    if (escalatedSupport > 0) {
      score += 15;
      signals.push({ key: "support-escalation", label: "Human escalation active", impact: 15, detail: `${escalatedSupport} support case${escalatedSupport === 1 ? " has" : "s have"} an escalation signal.` });
    }
    if (unresolvedSupportCases >= 3) {
      score += 10;
      signals.push({ key: "support-volume", label: "Repeated support pressure", impact: 10, detail: `${unresolvedSupportCases} support cases remain unresolved.` });
    }

    score = Math.min(100, score);
    const stage = stageFor(org, cancellationRequested);
    const level = riskLevel(score);

    return {
      organizationId: org.id,
      organizationName: org.name,
      stage: stage === "retained" && score >= 45 ? "at_risk" : stage,
      riskScore: score,
      riskLevel: level,
      signals: signals.sort((a, b) => b.impact - a.impact),
      current30DayUsage: currentUsage,
      previous30DayUsage: previousUsage,
      unresolvedSupportCases,
      connectedIntegrations,
      cancellationReason,
      recommendedAction: recommendedAction(stage, level, signals),
    };
  }).sort((a, b) => b.riskScore - a.riskScore || a.organizationName.localeCompare(b.organizationName));
}
