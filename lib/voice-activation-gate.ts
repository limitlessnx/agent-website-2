import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { getFluxPlanDefinition, planIncludesChannel } from "@/lib/fluxknight-plans";

type Json = Record<string, unknown>;
type GateCheck = { key: string; ok: boolean; detail: string };

type VoiceAgent = {
  id: string;
  name: string | null;
  status: string;
  communication_channels: unknown;
  human_handoff_destination: unknown;
  configuration: unknown;
};

function hasObjectValues(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Json).length);
}

function hasKnowledge(profile: { business_knowledge?: unknown; business_description?: string | null } | null, submission: { business_information?: unknown } | null) {
  if (hasObjectValues(profile?.business_knowledge)) return true;
  if (String(profile?.business_description || "").trim().length >= 20) return true;
  if (typeof submission?.business_information === "string") return submission.business_information.trim().length >= 20;
  return hasObjectValues(submission?.business_information);
}

export type VoiceActivationGate = {
  organizationId: string;
  planCode: string;
  planName: string;
  ready: boolean;
  checks: GateCheck[];
  agentId: string | null;
  agentName: string | null;
};

export async function getVoiceActivationGate(organizationId: string): Promise<VoiceActivationGate> {
  const admin = createAdminClient();
  const wallet = await getFluxWalletSummary(organizationId);
  const plan = getFluxPlanDefinition(wallet.planCode);
  const [agentsResult, profileResult, submissionResult, testsResult, approvalsResult, integrationResult] = await Promise.all([
    admin.from("agents").select("id,name,status,communication_channels,human_handoff_destination,configuration").eq("organization_id", organizationId).neq("status", "deleted"),
    admin.from("client_onboarding_profiles").select("status,business_knowledge,business_description").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("client_onboarding_submissions").select("business_information").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("agent_test_runs").select("agent_id,status,created_at").eq("organization_id", organizationId).eq("status", "passed").order("created_at", { ascending: false }).limit(100),
    admin.from("agent_approval_requests").select("agent_id,status,created_at").eq("organization_id", organizationId).eq("status", "approved").order("created_at", { ascending: false }).limit(100),
    admin.from("organization_integrations").select("provider,status,configuration,health").eq("organization_id", organizationId).eq("provider", "elevenlabs").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [agentsResult, profileResult, submissionResult, testsResult, approvalsResult, integrationResult]) {
    if (result.error) throw result.error;
  }
  const agents = (agentsResult.data || []) as VoiceAgent[];
  const voiceAgents = agents.filter((agent) => Array.isArray(agent.communication_channels) && agent.communication_channels.map(String).includes("voice"));
  const agent = voiceAgents.find((item) => ["published", "active"].includes(String(item.status))) || voiceAgents[0] || null;
  const testedIds = new Set((testsResult.data || []).map((item) => String(item.agent_id)));
  const approvedIds = new Set((approvalsResult.data || []).map((item) => String(item.agent_id)));
  const integration = integrationResult.data;
  const providerReady = Boolean(integration && ["connected", "active", "healthy"].includes(String(integration.status)));
  const configuration = (integration?.configuration || {}) as Json;
  const handoffReady = Boolean(agent && hasObjectValues(agent.human_handoff_destination));
  const knowledgeReady = hasKnowledge(profileResult.data, submissionResult.data);
  const agentReady = Boolean(agent && ["published", "active"].includes(String(agent.status)));
  const checks: GateCheck[] = [
    { key: "plan_voice", ok: planIncludesChannel(plan.code, "voice"), detail: planIncludesChannel(plan.code, "voice") ? `${plan.name} includes Voice.` : `${plan.name} does not include Voice.` },
    { key: "single_voice_agent", ok: voiceAgents.length === 1, detail: voiceAgents.length === 1 ? "Exactly one Voice agent is allocated." : `Expected exactly one Voice agent; found ${voiceAgents.length}.` },
    { key: "business_knowledge", ok: knowledgeReady, detail: knowledgeReady ? "Business information is available for approval." : "Business information has not been submitted." },
    { key: "telephony_connected", ok: providerReady, detail: providerReady ? "Voice provider connection is ready." : "Voice provider connection is not ready." },
    { key: "business_phone_confirmed", ok: Boolean(String(configuration.business_phone_e164 || "").trim()), detail: String(configuration.business_phone_e164 || "").trim() ? "Business phone destination is confirmed." : "Business phone destination is not confirmed." },
    { key: "handoff_configured", ok: handoffReady, detail: handoffReady ? "Human handoff destination is configured." : "Human handoff destination is missing." },
    { key: "agent_published", ok: agentReady, detail: agentReady ? "Voice agent is published." : "Voice agent must be published by Super Admin." },
    { key: "agent_test_passed", ok: Boolean(agent && testedIds.has(String(agent.id))), detail: agent && testedIds.has(String(agent.id)) ? "A passed Voice agent test exists." : "A passed Voice agent test is required." },
    { key: "approval_recorded", ok: Boolean(agent && approvedIds.has(String(agent.id))), detail: agent && approvedIds.has(String(agent.id)) ? "Super Admin approval is recorded." : "Super Admin approval is required." },
  ];
  return { organizationId, planCode: plan.code, planName: plan.name, ready: checks.every((check) => check.ok), checks, agentId: agent ? String(agent.id) : null, agentName: agent ? String(agent.name || "Voice Agent") : null };
}

export function voiceActivationError(gate: VoiceActivationGate) {
  const blocked = gate.checks.filter((check) => !check.ok).map((check) => check.detail);
  return blocked.length ? `Voice activation is blocked: ${blocked.join(" ")}` : "Voice activation is blocked.";
}
