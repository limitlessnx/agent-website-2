export type FluxPlanCode = "basic" | "plus" | "business" | "business_plus";

export type FluxAgentChannel = "web_chat" | "whatsapp" | "voice" | "email";

export type FluxFeatureKey =
  | "core_ai_support"
  | "human_handoff"
  | "follow_ups"
  | "reminders"
  | "team_admin"
  | "cross_channel"
  | "voice_automation"
  | "email_follow_up"
  | "email_automation"
  | "web_chat_automation"
  | "leo_chat"
  | "leo_voice"
  | "industry_database"
  | "client_database"
  | "advanced_workflows"
  | "custom_integrations";

/** Runtime action names are retained for ledger compatibility. */
export type FluxCreditAction =
  | "web_ai"
  | "whatsapp_ai"
  | "ai_email"
  | "email_follow_up"
  | "whatsapp_follow_up_reminder"
  | "leo_chat"
  | "leo_voice_minute";

export type FluxAgentAllocation = {
  key: string;
  name: string;
  channel: FluxAgentChannel;
};

export type FluxPlanDefinition = {
  code: FluxPlanCode;
  legacySlugs: string[];
  name: string;
  monthlyCredits: number;
  configurableMonthlyCredits?: boolean;
  /** Maximum customer-facing channels/agents this plan may activate. */
  maxChannels: number;
  /** Channels available for selection under this plan. */
  selectableChannels: FluxAgentChannel[];
  includedFeatures: FluxFeatureKey[];
  availableAgents: FluxAgentAllocation[];
  customerLabel: string;
};

export const FLUX_CREDIT_MULTIPLIER = 2;
export const FLUX_CREDIT_CUSTOMER_VALUE_CENTS = 1;
export const FLUX_CREDIT_PROVIDER_VALUE_CENTS = 0.5;

export const FLUX_CREDIT_ACTION_RATES: Record<FluxCreditAction, number> = {
  web_ai: 2,
  whatsapp_ai: 4,
  ai_email: 3,
  email_follow_up: 2,
  whatsapp_follow_up_reminder: 3,
  leo_chat: 6,
  leo_voice_minute: 20,
};

export const FLUX_USAGE_THRESHOLDS = [70, 90, 100] as const;

const WEB_CHAT_AGENT: FluxAgentAllocation = { key: "web_chat_agent", name: "Web Support Agent", channel: "web_chat" };
const WHATSAPP_AGENT: FluxAgentAllocation = { key: "whatsapp_agent", name: "WhatsApp Agent", channel: "whatsapp" };
const VOICE_AGENT: FluxAgentAllocation = { key: "voice_agent", name: "Call Agent", channel: "voice" };
const EMAIL_AGENT: FluxAgentAllocation = { key: "email_agent", name: "Email Agent", channel: "email" };
const BASIC_CHANNEL_AGENTS = [WHATSAPP_AGENT, WEB_CHAT_AGENT];
const BUSINESS_CHANNEL_AGENTS = [WHATSAPP_AGENT, VOICE_AGENT, EMAIL_AGENT];
const BUSINESS_PLUS_CHANNEL_AGENTS = [...BUSINESS_CHANNEL_AGENTS, WEB_CHAT_AGENT];

export const FLUX_PLAN_DEFINITIONS: Record<FluxPlanCode, FluxPlanDefinition> = {
  basic: {
    code: "basic",
    legacySlugs: ["basic", "whatsapp-ai-starter"],
    name: "Basic",
    monthlyCredits: 2500,
    maxChannels: 1,
    selectableChannels: ["whatsapp", "web_chat"],
    includedFeatures: ["core_ai_support", "human_handoff"],
    availableAgents: BASIC_CHANNEL_AGENTS,
    customerLabel: "Basic",
  },
  plus: {
    code: "plus",
    legacySlugs: ["plus", "starter", "ai-call-receptionist"],
    name: "Plus",
    monthlyCredits: 5000,
    maxChannels: 1,
    selectableChannels: ["whatsapp", "web_chat"],
    includedFeatures: ["core_ai_support", "human_handoff", "follow_ups", "reminders"],
    availableAgents: BASIC_CHANNEL_AGENTS,
    customerLabel: "Plus",
  },
  business: {
    code: "business",
    legacySlugs: ["business", "ai-front-desk-suite"],
    name: "Business",
    monthlyCredits: 12000,
    maxChannels: 2,
    selectableChannels: ["whatsapp", "voice", "email"],
    includedFeatures: [
      "core_ai_support",
      "human_handoff",
      "follow_ups",
      "reminders",
      "voice_automation",
      "email_follow_up",
      "team_admin",
      "cross_channel",
      "leo_voice",
    ],
    availableAgents: BUSINESS_CHANNEL_AGENTS,
    customerLabel: "Business",
  },
  business_plus: {
    code: "business_plus",
    legacySlugs: ["business_plus", "business-plus", "custom-ai-operations"],
    name: "Business+",
    monthlyCredits: 25000,
    configurableMonthlyCredits: true,
    maxChannels: 4,
    selectableChannels: ["web_chat", "whatsapp", "voice", "email"],
    includedFeatures: [
      "core_ai_support",
      "human_handoff",
      "follow_ups",
      "reminders",
      "voice_automation",
      "email_automation",
      "web_chat_automation",
      "team_admin",
      "cross_channel",
      "leo_voice",
      "industry_database",
      "client_database",
      "advanced_workflows",
      "custom_integrations",
    ],
    availableAgents: BUSINESS_PLUS_CHANNEL_AGENTS,
    customerLabel: "Business+",
  },
};

export const FLUX_FEATURE_LABELS: Record<FluxFeatureKey, string> = {
  core_ai_support: "Core AI support",
  human_handoff: "Human handoff",
  follow_ups: "Follow-up automation",
  reminders: "Reminders",
  voice_automation: "Voice automation",
  email_follow_up: "Email follow-up",
  email_automation: "Email automation",
  web_chat_automation: "Web chat automation",
  leo_chat: "Leo Chat",
  team_admin: "Team and admin controls",
  cross_channel: "Cross-channel workflows",
  leo_voice: "Leo Voice",
  industry_database: "Industry database",
  client_database: "Client database",
  advanced_workflows: "Advanced workflows",
  custom_integrations: "Custom integrations",
};

function normalizePlanLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
}

const SLUG_TO_PLAN = Object.values(FLUX_PLAN_DEFINITIONS).reduce<Record<string, FluxPlanCode>>((accumulator, plan) => {
  for (const slug of plan.legacySlugs) {
    accumulator[slug] = plan.code;
    accumulator[normalizePlanLookupKey(slug)] = plan.code;
  }
  accumulator[plan.name.toLowerCase()] = plan.code;
  accumulator[normalizePlanLookupKey(plan.name)] = plan.code;
  return accumulator;
}, {});

export function normalizeFluxPlanCode(value: string | null | undefined): FluxPlanCode {
  const normalized = normalizePlanLookupKey(String(value || ""));
  if (normalized === "business+" || normalized === "business_plus") return "business_plus";
  return SLUG_TO_PLAN[normalized] || "basic";
}

export function getFluxPlanDefinition(value: string | null | undefined): FluxPlanDefinition {
  return FLUX_PLAN_DEFINITIONS[normalizeFluxPlanCode(value)];
}

export function getPlanAgentAllocation(value: string | null | undefined) {
  return getFluxPlanDefinition(value).availableAgents.map((agent) => ({ ...agent }));
}

export function getMaxChannelCount(value: string | null | undefined) {
  return getFluxPlanDefinition(value).maxChannels;
}

/** Backward-compatible name for callers that use agents as channel workers. */
export function getMaxAgentCount(value: string | null | undefined) {
  return getMaxChannelCount(value);
}

export function getSelectableChannels(value: string | null | undefined) {
  return [...getFluxPlanDefinition(value).selectableChannels];
}

export function planIncludesChannel(plan: string | null | undefined, channel: FluxAgentChannel) {
  return getFluxPlanDefinition(plan).selectableChannels.includes(channel);
}

export function getRequiredPlanForChannel(channel: FluxAgentChannel): FluxPlanDefinition {
  return Object.values(FLUX_PLAN_DEFINITIONS).find((plan) => plan.selectableChannels.includes(channel)) || FLUX_PLAN_DEFINITIONS.business_plus;
}

export function planIncludesFeature(plan: string | null | undefined, feature: FluxFeatureKey) {
  return getFluxPlanDefinition(plan).includedFeatures.includes(feature);
}

export function getRequiredPlanForFeature(feature: FluxFeatureKey): FluxPlanDefinition {
  return Object.values(FLUX_PLAN_DEFINITIONS).find((plan) => plan.includedFeatures.includes(feature)) || FLUX_PLAN_DEFINITIONS.business_plus;
}

export function getUpgradeLabel(feature: FluxFeatureKey, currentPlan: string | null | undefined) {
  if (planIncludesFeature(currentPlan, feature)) return null;
  return `Available on ${getRequiredPlanForFeature(feature).name}`;
}

export function calculateFluxCredits(action: FluxCreditAction, quantity = 1) {
  const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  return Math.ceil(FLUX_CREDIT_ACTION_RATES[action] * safeQuantity);
}

export function calculateModeledProviderCostCents(action: FluxCreditAction, quantity = 1) {
  return calculateFluxCredits(action, quantity) * FLUX_CREDIT_PROVIDER_VALUE_CENTS;
}

export function calculateUsagePercent(balance: number, allowance: number) {
  if (!allowance || allowance <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(((allowance - balance) / allowance) * 100)));
}

export function getThresholdLevel(percentUsed: number) {
  if (percentUsed >= 100) return 100;
  if (percentUsed >= 90) return 90;
  if (percentUsed >= 70) return 70;
  return null;
}
