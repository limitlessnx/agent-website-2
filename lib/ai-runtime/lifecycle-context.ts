import type { LeoIdentity } from "@/lib/leo-core";
import { buildLeoLifecycleOperations, type LeoLifecycleOperationsSnapshot } from "@/lib/leo-lifecycle-operations";
import type { UnifiedLifecycleSnapshot } from "@/lib/lifecycle-intelligence";

export type LifecycleConversationIntent = "attention" | "risk" | "next_action" | "expansion";

export type LifecycleConversationContext = {
  intent: LifecycleConversationIntent;
  generatedAt: string;
  scope: { type: "platform" | "workspace"; organizationId?: string; organizationName?: string };
  summary: LeoLifecycleOperationsSnapshot["summary"];
  selectedOrganization?: {
    organizationId: string;
    organizationName: string;
    stage: UnifiedLifecycleSnapshot["stage"];
    attention: UnifiedLifecycleSnapshot["attention"];
    healthScore: number;
    retentionRiskScore: number;
    unresolvedSupportCases: number;
    connectedIntegrations: number;
    reasons: string[];
    recommendedNextAction: string;
    opportunityScore: number;
    opportunityCount: number;
  };
  attentionQueue: LeoLifecycleOperationsSnapshot["attentionQueue"];
  expansionQueue: LeoLifecycleOperationsSnapshot["expansionQueue"];
  dashboardLinks: {
    lifecycle: string;
    retention: string;
    controlCenter: string;
    notifications: string;
  };
  rules: LeoLifecycleOperationsSnapshot["rules"];
};

const LIFECYCLE_TERMS = [
  "client", "clients", "customer", "customers", "account", "accounts",
  "attention", "risk", "at risk", "health", "retention", "churn", "cancel",
  "next action", "what should", "do next", "priority", "prioritize",
  "expansion", "growth", "upsell", "upgrade", "opportunity",
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectLifecycleConversationIntent(objective: string): LifecycleConversationIntent | null {
  const text = normalize(objective);
  if (!text || !LIFECYCLE_TERMS.some((term) => text.includes(normalize(term)))) return null;
  if (/expansion|growth|upsell|upgrade|opportunit/.test(text)) return "expansion";
  if (/next action|what should|do next|priority|prioritize/.test(text)) return "next_action";
  if (/why|risk|at risk|health|retention|churn|cancel/.test(text)) return "risk";
  if (/attention|client|customer|account/.test(text)) return "attention";
  return null;
}

function resolveNamedOrganization(objective: string, organizations: UnifiedLifecycleSnapshot[]) {
  const text = normalize(objective);
  const candidates = organizations
    .filter((item) => {
      const name = normalize(item.organizationName);
      return name.length >= 3 && text.includes(name);
    })
    .sort((a, b) => b.organizationName.length - a.organizationName.length);
  if (!candidates.length) return undefined;
  const longest = normalize(candidates[0].organizationName);
  const equallySpecific = candidates.filter((item) => normalize(item.organizationName).length === longest.length);
  return equallySpecific.length === 1 ? candidates[0] : undefined;
}

function compactSelected(item: UnifiedLifecycleSnapshot) {
  return {
    organizationId: item.organizationId,
    organizationName: item.organizationName,
    stage: item.stage,
    attention: item.attention,
    healthScore: item.healthScore,
    retentionRiskScore: item.retentionRiskScore,
    unresolvedSupportCases: item.unresolvedSupportCases,
    connectedIntegrations: item.connectedIntegrations,
    reasons: item.reasons.slice(0, 5),
    recommendedNextAction: item.recommendedNextAction,
    opportunityScore: item.opportunityScore,
    opportunityCount: item.opportunityCount,
  };
}

export async function buildLifecycleConversationContext(input: {
  identity: LeoIdentity;
  objective: string;
  organizationId?: string;
}): Promise<LifecycleConversationContext | null> {
  if (input.identity.scope !== "super_admin") return null;
  const intent = detectLifecycleConversationIntent(input.objective);
  if (!intent) return null;

  const snapshot = await buildLeoLifecycleOperations({ identity: input.identity });
  const selected = input.organizationId
    ? snapshot.organizations.find((item) => item.organizationId === input.organizationId)
    : resolveNamedOrganization(input.objective, snapshot.organizations);

  if (input.organizationId && !selected) throw new Error("Organization lifecycle evidence was not found.");

  return {
    intent,
    generatedAt: snapshot.generatedAt,
    scope: selected
      ? { type: "workspace", organizationId: selected.organizationId, organizationName: selected.organizationName }
      : { type: "platform" },
    summary: snapshot.summary,
    selectedOrganization: selected ? compactSelected(selected) : undefined,
    attentionQueue: snapshot.attentionQueue.slice(0, 10),
    expansionQueue: snapshot.expansionQueue.slice(0, 10),
    dashboardLinks: {
      lifecycle: "/dashboard/lifecycle",
      retention: "/dashboard/retention",
      controlCenter: "/dashboard/control-center",
      notifications: "/dashboard/notifications",
    },
    rules: snapshot.rules,
  };
}
