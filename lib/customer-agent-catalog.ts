import { supabaseServerRequest } from "@/lib/supabase-server-rest";
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
    requiredFeature: "core_ai_support",
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
    summary: "Supports customer email follow-up where configured.",
    availability: "implemented",
    channel: "email",
    requiredFeature: "email_follow_up",
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

type OrganizationAgentRow = {
  slug?: string | null;
  name?: string | null;
  status?: string | null;
  agent_type?: string | null;
  configuration?: Record<string, unknown> | null;
  communication_channels?: unknown[] | null;
};

function normalizeAgentToken(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/**
 * Resolve allocations from active agent records belonging to this organization.
 * Installed marketplace systems are deliberately not used as a proxy for agent
 * allocation. Unknown agent types fail closed rather than being guessed.
 */
export async function getOrganizationAllocatedCustomerAgentKeys(
  organizationId: string,
): Promise<CustomerAgentKey[]> {
  if (!organizationId.trim()) return [];

  const rows = await supabaseServerRequest<OrganizationAgentRow[]>(
    `agents?organization_id=eq.${encodeURIComponent(organizationId)}&select=slug,name,status,agent_type,configuration,communication_channels&order=updated_at.desc`,
  );

  const allocated = new Set<CustomerAgentKey>();
  for (const row of rows) {
    if (row.status !== "active" && row.status !== "published") continue;

    const config = row.configuration || {};
    const tokens = [
      row.slug,
      row.agent_type,
      row.name,
      config.agent_key,
      ...(Array.isArray(row.communication_channels) ? row.communication_channels : []),
      ...(Array.isArray(config.channels) ? config.channels : []),
    ].map(normalizeAgentToken);

    if (tokens.some((token) => ["whatsapp", "whatsapp_agent", "whatsapp_ai", "maia_whatsapp"].includes(token))) {
      allocated.add("whatsapp");
    }
    if (tokens.some((token) => ["web_chat", "web_chat_agent", "web_support", "web_support_agent"].includes(token))) {
      allocated.add("web_support");
    }
    if (tokens.some((token) => ["voice", "voice_agent", "call", "call_agent", "voice_ai"].includes(token))) {
      allocated.add("call");
    }
    if (tokens.some((token) => ["email", "email_agent", "email_ai"].includes(token))) {
      allocated.add("email");
    }
    if (tokens.some((token) => ["receipt", "receipt_agent"].includes(token))) {
      allocated.add("receipt");
    }
    if (tokens.some((token) => ["social_media", "social_media_agent", "social_agent"].includes(token))) {
      allocated.add("social_media");
    }
    if (tokens.some((token) => ["customise", "customise_agent", "custom_agent"].includes(token))) {
      allocated.add("customise");
    }
  }

  return [...allocated];
}
