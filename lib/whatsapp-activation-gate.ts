import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxWalletSummary } from "@/lib/flux-credits";
import { getFluxPlanDefinition, planIncludesChannel } from "@/lib/fluxknight-plans";

type Json = Record<string, unknown>;
type GateCheck = { key: string; ok: boolean; detail: string };

function hasObjectValues(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value as Json).length);
}

function hasKnowledge(profile: { business_knowledge?: unknown; business_description?: string | null } | null, submission: { business_information?: unknown } | null) {
  if (hasObjectValues(profile?.business_knowledge)) return true;
  if (String(profile?.business_description || "").trim().length >= 20) return true;
  if (typeof submission?.business_information === "string") return submission.business_information.trim().length >= 20;
  return hasObjectValues(submission?.business_information);
}

export type WhatsAppActivationGate = {
  organizationId: string;
  planCode: string;
  planName: string;
  ready: boolean;
  checks: GateCheck[];
  agentId: string | null;
  agentName: string | null;
};

export async function getWhatsAppActivationGate(organizationId: string): Promise<WhatsAppActivationGate> {
  const admin = createAdminClient();
  const wallet = await getFluxWalletSummary(organizationId);
  const plan = getFluxPlanDefinition(wallet.planCode);
  const [agentsResult, profileResult, submissionResult, testsResult, approvalsResult, bindingResult] = await Promise.all([
    admin.from("agents").select("id,name,status,communication_channels,human_handoff_destination").eq("organization_id", organizationId).neq("status", "deleted"),
    admin.from("client_onboarding_profiles").select("status,business_knowledge,business_description").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("client_onboarding_submissions").select("business_information").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("agent_test_runs").select("agent_id,status,created_at").eq("organization_id", organizationId).eq("status", "passed").order("created_at", { ascending: false }).limit(100),
    admin.from("agent_approval_requests").select("agent_id,status,created_at").eq("organization_id", organizationId).eq("status", "approved").order("created_at", { ascending: false }).limit(100),
    admin.from("whatsapp_twilio_bindings").select("status,twilio_sender_status").eq("organization_id", organizationId).maybeSingle(),
  ]);
  for (const result of [agentsResult, profileResult, submissionResult, testsResult, approvalsResult, bindingResult]) {
    if (result.error) throw result.error;
  }
  const agents = agentsResult.data || [];
  const whatsappAgents = agents.filter((agent) => Array.isArray(agent.communication_channels) && agent.communication_channels.includes("whatsapp"));
  const publishedWhatsAppAgents = whatsappAgents.filter((agent) => ["published", "active"].includes(String(agent.status)));
  const agent = publishedWhatsAppAgents[0] || whatsappAgents[0] || null;
  const testedIds = new Set((testsResult.data || []).map((item) => String(item.agent_id)));
  const approvedIds = new Set((approvalsResult.data || []).map((item) => String(item.agent_id)));
  const bindingOnline = String(bindingResult.data?.status || "") === "connected" || String(bindingResult.data?.twilio_sender_status || "") === "ONLINE";
  const knowledgeReady = hasKnowledge(profileResult.data, submissionResult.data);
  const handoffReady = Boolean(agent && hasObjectValues(agent.human_handoff_destination));
  const agentReady = Boolean(agent && ["published", "active"].includes(String(agent.status)));
  const checks: GateCheck[] = [
    { key: "plan_whatsapp", ok: planIncludesChannel(plan.code, "whatsapp"), detail: planIncludesChannel(plan.code, "whatsapp") ? `${plan.name} includes WhatsApp.` : `${plan.name} does not include WhatsApp.` },
    { key: "single_whatsapp_agent", ok: whatsappAgents.length === 1, detail: whatsappAgents.length === 1 ? "Exactly one WhatsApp agent is allocated." : `Expected exactly one WhatsApp agent; found ${whatsappAgents.length}.` },
    { key: "business_knowledge", ok: knowledgeReady, detail: knowledgeReady ? "Business information is available for approval." : "Business information has not been submitted." },
    { key: "provider_online", ok: bindingOnline, detail: bindingOnline ? "WhatsApp sender is online." : "WhatsApp sender is not online." },
    { key: "handoff_configured", ok: handoffReady, detail: handoffReady ? "Human handoff destination is configured." : "Human handoff destination or pending assignment placeholder is missing." },
    { key: "agent_published", ok: agentReady, detail: agentReady ? "WhatsApp agent is published." : "WhatsApp agent must be published by Super Admin." },
    { key: "agent_test_passed", ok: Boolean(agent && testedIds.has(String(agent.id))), detail: agent && testedIds.has(String(agent.id)) ? "A passed agent test exists." : "A passed WhatsApp agent test is required." },
    { key: "approval_recorded", ok: Boolean(agent && approvedIds.has(String(agent.id))), detail: agent && approvedIds.has(String(agent.id)) ? "Super Admin approval is recorded." : "Super Admin approval is required." },
  ];
  return {
    organizationId,
    planCode: plan.code,
    planName: plan.name,
    ready: checks.every((check) => check.ok),
    checks,
    agentId: agent ? String(agent.id) : null,
    agentName: agent ? String(agent.name || "WhatsApp Agent") : null,
  };
}

export function whatsappActivationError(gate: WhatsAppActivationGate) {
  const blocked = gate.checks.filter((check) => !check.ok).map((check) => check.detail);
  return blocked.length ? `WhatsApp activation is blocked: ${blocked.join(" ")}` : "WhatsApp activation is blocked.";
}
