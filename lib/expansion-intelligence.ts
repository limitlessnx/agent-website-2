import { getOrganizationValueReports, type OrganizationValueReport } from "@/lib/usage-reporting";

export type ExpansionOpportunityKind =
  | "capacity"
  | "specialist_agent"
  | "channel"
  | "automation"
  | "lead_operations"
  | "handoff_reduction";

export type ExpansionOpportunity = {
  id: string;
  organizationId: string;
  organizationName: string;
  kind: ExpansionOpportunityKind;
  priority: "low" | "medium" | "high";
  confidence: "emerging" | "strong";
  title: string;
  rationale: string;
  evidence: string[];
  recommendedAction: string;
  actionHref: string;
};

export type OrganizationExpansionSnapshot = {
  organizationId: string;
  organizationName: string;
  opportunities: ExpansionOpportunity[];
  opportunityScore: number;
  strongestOpportunity: ExpansionOpportunity | null;
  periodDays: number;
  hasOperationalData: boolean;
};

function pct(value: number | null) {
  return value === null ? null : `${value > 0 ? "+" : ""}${value}%`;
}

function opportunity(
  report: OrganizationValueReport,
  kind: ExpansionOpportunityKind,
  priority: ExpansionOpportunity["priority"],
  confidence: ExpansionOpportunity["confidence"],
  title: string,
  rationale: string,
  evidence: string[],
  recommendedAction: string,
): ExpansionOpportunity {
  return {
    id: `${report.organizationId}:${kind}:${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    organizationId: report.organizationId,
    organizationName: report.organizationName,
    kind,
    priority,
    confidence,
    title,
    rationale,
    evidence,
    recommendedAction,
    actionHref: `/dashboard/clients?organizationId=${encodeURIComponent(report.organizationId)}`,
  };
}

function scorePriority(priority: ExpansionOpportunity["priority"]) {
  if (priority === "high") return 30;
  if (priority === "medium") return 18;
  return 8;
}

export function deriveExpansionOpportunities(report: OrganizationValueReport): ExpansionOpportunity[] {
  if (!report.hasOperationalData) return [];

  const opportunities: ExpansionOpportunity[] = [];
  const conversations = report.metrics.conversations.current;
  const conversationGrowth = report.metrics.conversations.changePercent;
  const actions = report.metrics.successfulActions.current;
  const actionGrowth = report.metrics.successfulActions.changePercent;
  const leads = report.metrics.leadsCaptured.current;
  const qualified = report.metrics.qualifiedLeads.current;
  const handoffs = report.metrics.handoffs.current;
  const activeAgents = report.metrics.activeAgents;
  const whatsapp = report.metrics.whatsappMessages.current;
  const emails = report.metrics.emailsSent.current;

  if (conversations >= 500 || (conversations >= 150 && (conversationGrowth ?? 0) >= 40)) {
    opportunities.push(opportunity(
      report,
      "capacity",
      conversations >= 750 ? "high" : "medium",
      conversations >= 500 ? "strong" : "emerging",
      "Conversation capacity is growing",
      "Customer demand is high enough to review whether the current agent and workflow footprint should expand.",
      [
        `${conversations.toLocaleString()} conversations in the last ${report.periodDays} days`,
        conversationGrowth === null ? "No comparable previous-period baseline yet" : `${pct(conversationGrowth)} conversation growth versus the previous period`,
      ],
      "Review agent capacity and workflow coverage before usage becomes a service bottleneck.",
    ));
  }

  if (activeAgents <= 1 && conversations >= 200) {
    opportunities.push(opportunity(
      report,
      "specialist_agent",
      conversations >= 500 ? "high" : "medium",
      conversations >= 300 ? "strong" : "emerging",
      "A specialist agent may improve coverage",
      "One active agent is carrying a meaningful conversation load. A specialist agent can separate sales, support, booking, or another high-volume responsibility when the business case is clear.",
      [`${activeAgents} active agent${activeAgents === 1 ? "" : "s"}`, `${conversations.toLocaleString()} conversations this period`],
      "Review conversation categories and identify whether one repeated responsibility merits a dedicated agent.",
    ));
  }

  if (leads >= 30 && qualified >= 10) {
    const qualificationRate = leads > 0 ? Math.round((qualified / leads) * 100) : 0;
    opportunities.push(opportunity(
      report,
      "lead_operations",
      leads >= 100 ? "high" : "medium",
      leads >= 50 ? "strong" : "emerging",
      "Lead operations can be expanded",
      "The workspace is generating enough lead activity to justify deeper qualification, follow-up, scheduling, or CRM automation.",
      [`${leads.toLocaleString()} leads captured`, `${qualified.toLocaleString()} qualified leads`, `${qualificationRate}% observed qualification rate`],
      "Review the lead journey for repeatable steps that can move from manual handling into Fluxknight automation.",
    ));
  }

  if (handoffs >= 20 && conversations >= 50) {
    const handoffRate = Math.round((handoffs / conversations) * 100);
    opportunities.push(opportunity(
      report,
      "handoff_reduction",
      handoffRate >= 25 ? "high" : "medium",
      handoffs >= 40 ? "strong" : "emerging",
      "Human handoffs deserve a workflow review",
      "Frequent handoffs can signal a useful boundary for a new workflow, specialist agent, better knowledge coverage, or deliberate human escalation design.",
      [`${handoffs.toLocaleString()} human handoffs`, `${handoffRate}% handoffs relative to conversations`],
      "Inspect handoff reasons and automate only the repeatable, low-risk categories.",
    ));
  }

  if (actions >= 100 || (actions >= 30 && (actionGrowth ?? 0) >= 50)) {
    opportunities.push(opportunity(
      report,
      "automation",
      actions >= 250 ? "high" : "medium",
      actions >= 100 ? "strong" : "emerging",
      "Automation usage supports a broader workflow footprint",
      "Successful automated actions are occurring often enough to inspect adjacent manual processes for expansion.",
      [
        `${actions.toLocaleString()} successful automated actions`,
        actionGrowth === null ? "No comparable previous-period action baseline yet" : `${pct(actionGrowth)} action growth versus the previous period`,
      ],
      "Identify the next repetitive operational task with clear inputs, outputs, and approval boundaries.",
    ));
  }

  if (report.topChannel && whatsapp === 0 && emails === 0 && conversations >= 75) {
    opportunities.push(opportunity(
      report,
      "channel",
      "low",
      conversations >= 150 ? "strong" : "emerging",
      "A second customer channel may be worth evaluating",
      `Most observed conversation activity is concentrated in ${report.topChannel.replaceAll("_", " ")}, while no WhatsApp or email activity was measured in this period.`,
      [`Top channel: ${report.topChannel.replaceAll("_", " ")}`, `${conversations.toLocaleString()} conversations`, "No measured WhatsApp or email activity"],
      "Evaluate customer behavior before adding another channel; do not add one merely because the integration exists.",
    ));
  }

  return opportunities.sort((a, b) => scorePriority(b.priority) - scorePriority(a.priority));
}

export async function getExpansionSnapshots(periodDays = 30): Promise<OrganizationExpansionSnapshot[]> {
  const reports = await getOrganizationValueReports(periodDays);

  return reports.map((report) => {
    const opportunities = deriveExpansionOpportunities(report);
    const opportunityScore = Math.min(100, opportunities.reduce((total, item) => total + scorePriority(item.priority), 0));
    return {
      organizationId: report.organizationId,
      organizationName: report.organizationName,
      opportunities,
      opportunityScore,
      strongestOpportunity: opportunities[0] ?? null,
      periodDays,
      hasOperationalData: report.hasOperationalData,
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore || a.organizationName.localeCompare(b.organizationName));
}
