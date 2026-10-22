import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFluxPlanDefinition, planIncludesChannel } from "@/lib/fluxknight-plans";
import { getFluxWalletSummary } from "@/lib/flux-credits";

const MAX_TEXT = 4000;
const allowedLanguages = new Set(["en", "en-NG", "en-GB", "en-US"]);
const allowedVoices = new Set(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]);

type VoiceConfiguration = {
  elevenlabs_agent_id?: string;
  elevenlabs_version_id?: string;
  elevenlabs_phone_number_id?: string;
  elevenlabs_webhook_id?: string;
  identity?: string;
  greeting?: string;
  language?: string;
  voice?: string;
  business_hours?: Record<string, unknown>;
  after_hours_response?: string;
  qualification_questions?: string[];
  call_transfer_rules?: Record<string, unknown>;
  human_handoff_number?: string;
  voicemail_behavior?: string;
  call_summary_format?: string;
  recording_policy?: "disabled" | "transcription_only" | "record_and_transcribe";
  maximum_call_duration_minutes?: number;
  configured_at?: string;
  configured_by?: string;
};

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim().slice(0, MAX_TEXT);
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function questions(value: unknown) {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean).slice(0, 20) : [];
}

async function adminContext(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return { error: "Unauthorized.", status: 401 as const };
  const organizationId = request.method === "GET"
    ? String(request.nextUrl.searchParams.get("organizationId") || "").trim()
    : String((await request.clone().json().catch(() => ({})) as Record<string, unknown>).organizationId || "").trim();
  if (!organizationId) return { error: "Organization is required.", status: 400 as const };
  return { session, organizationId };
}

export async function GET(request: NextRequest) {
  const auth = await adminContext(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const admin = createAdminClient();
    const [{ data: agent, error: agentError }, wallet] = await Promise.all([
      admin.from("agents").select("id,name,status,agent_type,communication_channels,configuration").eq("organization_id", auth.organizationId).contains("communication_channels", ["voice"]).maybeSingle(),
      getFluxWalletSummary(auth.organizationId),
    ]);
    if (agentError) throw agentError;
    const plan = getFluxPlanDefinition(wallet.planCode);
    return NextResponse.json({ available: planIncludesChannel(plan.code, "voice"), plan: plan.code, agent: agent ? { id: agent.id, name: agent.name, status: agent.status } : null, configuration: object((agent?.configuration as Record<string, unknown> | null)?.voice) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Voice configuration." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await adminContext(request);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const organizationId = String(body.organizationId || auth.organizationId).trim();
    if (organizationId !== auth.organizationId) return NextResponse.json({ error: "Organization scope mismatch." }, { status: 403 });
    const wallet = await getFluxWalletSummary(organizationId);
    const plan = getFluxPlanDefinition(wallet.planCode);
    if (!planIncludesChannel(plan.code, "voice")) return NextResponse.json({ error: "Voice configuration requires the Business plan or above." }, { status: 409 });
    const admin = createAdminClient();
    const { data: agent, error: agentError } = await admin.from("agents").select("id,name,status,configuration,communication_channels").eq("organization_id", organizationId).contains("communication_channels", ["voice"]).maybeSingle();
    if (agentError) throw agentError;
    if (!agent) return NextResponse.json({ error: "Allocate the Voice agent before configuring it." }, { status: 409 });
    const language = text(body.language, "en-NG");
    const voice = text(body.voice, "nova");
    const recordingPolicy = text(body.recording_policy, "transcription_only") as VoiceConfiguration["recording_policy"];
    const maximum = Math.min(180, Math.max(1, Math.round(Number(body.maximum_call_duration_minutes || 30))));
    if (!allowedLanguages.has(language)) return NextResponse.json({ error: "Unsupported Voice language." }, { status: 400 });
    if (!allowedVoices.has(voice)) return NextResponse.json({ error: "Unsupported Voice selection." }, { status: 400 });
    if (!["disabled", "transcription_only", "record_and_transcribe"].includes(recordingPolicy || "")) return NextResponse.json({ error: "Invalid recording policy." }, { status: 400 });
    const configuration = object(agent.configuration);
    const voiceConfiguration: VoiceConfiguration = {
      elevenlabs_agent_id: text(body.elevenlabs_agent_id),
      elevenlabs_version_id: text(body.elevenlabs_version_id),
      elevenlabs_phone_number_id: text(body.elevenlabs_phone_number_id),
      elevenlabs_webhook_id: text(body.elevenlabs_webhook_id),
      identity: text(body.identity),
      greeting: text(body.greeting),
      language,
      voice,
      business_hours: object(body.business_hours),
      after_hours_response: text(body.after_hours_response),
      qualification_questions: questions(body.qualification_questions),
      call_transfer_rules: object(body.call_transfer_rules),
      human_handoff_number: text(body.human_handoff_number),
      voicemail_behavior: text(body.voicemail_behavior),
      call_summary_format: text(body.call_summary_format),
      recording_policy: recordingPolicy,
      maximum_call_duration_minutes: maximum,
      configured_at: new Date().toISOString(),
      configured_by: auth.session.email,
    };
    const { data: updated, error: updateError } = await admin.from("agents").update({ configuration: { ...configuration, voice: voiceConfiguration }, updated_at: new Date().toISOString(), status: agent.status === "draft" ? "testing" : agent.status }).eq("organization_id", organizationId).eq("id", agent.id).select("id,name,status,updated_at").single();
    if (updateError) throw updateError;
    const { data: integration } = await admin.from("organization_integrations").select("id,configuration").eq("organization_id", organizationId).eq("provider", "elevenlabs").maybeSingle();
    if (integration?.id) {
      await admin.from("organization_integrations").update({ configuration: { ...object(integration.configuration), elevenlabs_agent_id: voiceConfiguration.elevenlabs_agent_id || null, elevenlabs_version_id: voiceConfiguration.elevenlabs_version_id || null, elevenlabs_phone_number_id: voiceConfiguration.elevenlabs_phone_number_id || null, elevenlabs_webhook_id: voiceConfiguration.elevenlabs_webhook_id || null }, updated_at: new Date().toISOString() }).eq("id", integration.id).eq("organization_id", organizationId);
    }
    await admin.rpc("refresh_agent_runtime_readiness", { p_organization_id: organizationId, p_agent_id: agent.id });
    return NextResponse.json({ ok: true, agent: updated, configuration: voiceConfiguration });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Voice configuration." }, { status: 400 });
  }
}
