import {
  planIncludesChannel,
  planIncludesFeature,
  type FluxAgentChannel,
  type FluxFeatureKey,
  type FluxPlanCode,
} from "@/lib/fluxknight-plans";

export type CustomerAgentKey =
  | "whatsapp"
  | "web_support"
  | "call"
  | "receipt"
  | "social_media"
  | "email"
  | "customise";

export type CustomerAgentDefinition = {
  key: CustomerAgentKey;
  name: string;
  summary: string;
  availability: "implemented" | "unverified";
  channel?: FluxAgentChannel;
  requiredFeature?: FluxFeatureKey;
  limitation?: string;
};

/**
 * Canonical customer-facing agent catalogue.
 *
 * "implemented" means the corresponding channel/feature exists in the current
 * plan model. It does not imply that a tenant has configured the integration.
 * Entries marked "unverified" must not be presented as available products
 * until their implementation and operational dependencies have been verified.
 */
export const CUSTOMER_AGENT_CATALOG: readonly CustomerAgentDefinition[] = [
  {
    key: "whatsapp",
    name: "WhatsApp Agent",
    summary: "Answers customer enquiries and supports human handoff.",
    availability: "implemented",
    channel: "whatsapp",
    requiredFeature: "core_ai_support",
  },
  {
    key: "web_support",
    name: "Web Support Agent",
    summary: "Handles customer questions through website chat.",
    availability: "implemented",
    channel: "web_chat",
    requiredFeature: "web_chat_automation",
  },
  {
    key: "call",
    name: "Call Agent",
    summary: "Supports customer-facing voice interactions where configured.",
    availability: "implemented",
    channel: "voice",
    requiredFeature: "voice_automation",
    limitation: "Outbound AI calling is not currently available.",
  },
  {
    key: "receipt",
    name: "Receipt Agent",
    summary: "Receipt-related workflows and customer records.",
    availability: "unverified",
  },
  {
    key: "social_media",
    name: "Social Media Agent",
    summary: "Social-channel workflows and customer engagement.",
    availability: "unverified",
  },
  {
    key: "email",
    name: "Email Agent",
    summary: "Customer communication and email automation.",
    availability: "implemented",
    channel: "email",
    requiredFeature: "email_automation",
  },
  {
    key: "customise",
    name: "Customise Agent",
    summary: "A tailored agent for an approved organization-specific use case.",
    availability: "unverified",
    requiredFeature: "custom_integrations",
    limitation: "Requires verified custom-agent provisioning and approved integrations.",
  },
] as const;

/**
 * Plan eligibility only. Organization allocation, subscription status,
 * integration readiness, and member permissions must also be checked by the
 * server before an agent is exposed or used.
 */
export function isCustomerAgentPlanEligible(
  agent: CustomerAgentDefinition,
  planCode: FluxPlanCode,
): boolean {
  if (agent.availability !== "implemented") return false;
  if (agent.channel && !planIncludesChannel(planCode, agent.channel)) return false;
  if (agent.requiredFeature && !planIncludesFeature(planCode, agent.requiredFeature)) return false;
  return true;
}

/**
 * Returns only verified catalogue entries that are both plan-eligible and
 * explicitly allocated to the organization. Call only after the server has
 * resolved the organization's effective plan and allocation.
 */
export function getVisibleCustomerAgents(
  planCode: FluxPlanCode,
  allocatedAgentKeys: readonly CustomerAgentKey[],
): CustomerAgentDefinition[] {
  const allocated = new Set(allocatedAgentKeys);
  return CUSTOMER_AGENT_CATALOG.filter(
    (agent) => allocated.has(agent.key) && isCustomerAgentPlanEligible(agent, planCode),
  ).map((agent) => ({ ...agent }));
}
