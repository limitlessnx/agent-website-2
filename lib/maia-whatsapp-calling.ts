import { getWhatsAppCredentials } from "@/lib/whatsapp-integration";
import { preflightChargeableFluxAi, recordChargeableFluxAiUsage } from "@/lib/flux-ai-metering";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-data";

export type WhatsAppCallEvent = {
  id: string;
  from: string;
  to?: string;
  direction: "USER_INITIATED" | "BUSINESS_INITIATED" | "UNKNOWN";
  event: string;
  timestamp?: string;
  session?: { sdp_type?: string; sdp?: string };
  contactName?: string;
  phoneNumberId: string;
};

type TenantVoiceTarget = { organizationId: string; agentId: string };

type Json = Record<string, unknown>;

function text(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function buildMultipart(sdp: string, session: Json) {
  const boundary = `----FluxknightMaia${crypto.randomUUID().replaceAll("-", "")}`;
  const body = [
    `--${boundary}\r\n`,
    "Content-Disposition: form-data; name=\"sdp\"\r\n",
    "Content-Type: application/sdp\r\n\r\n",
    sdp,
    `\r\n--${boundary}\r\n`,
    "Content-Disposition: form-data; name=\"session\"\r\n",
    "Content-Type: application/json\r\n\r\n",
    JSON.stringify(session),
    `\r\n--${boundary}--\r\n`,
  ].join("");
  return { boundary, body };
}

function providerError(value: string) {
  try {
    const parsed = JSON.parse(value) as Json;
    const error = parsed.error as Json | undefined;
    if (error) return text(error.message, 500) || "OpenAI rejected the Maia realtime session.";
  } catch {}
  return text(value, 500) || "OpenAI rejected the Maia realtime session.";
}

function openAiSession(agentName: string, organizationId: string, contactName: string) {
  return {
    type: "realtime",
    model: process.env.MAIA_REALTIME_MODEL?.trim() || "gpt-realtime-2.1-mini",
    instructions: [
      `You are ${agentName}, Maia, the voice assistant for one organization only.`,
      `The organization ID is ${organizationId}. Never access or reveal information belonging to another organization.`,
      "You are speaking with a customer over a WhatsApp voice call. Speak naturally, briefly, and clearly. Do not use markdown, URLs, or visual-only formatting.",
      "Use only approved tenant context. Never invent property names, prices, availability, payment terms, documentation status, or appointment confirmations.",
      "If the caller needs a property-specific fact that is not already in the verified session context, say that you will verify it and continue through the WhatsApp conversation or a human team member. Do not guess.",
      "For payments, legal/documentation questions, complaints, negotiation, bookings, or a request for a human, acknowledge the request and state that a human team member will take over.",
      `Caller profile name: ${contactName || "unknown"}.`,
    ].join("\n\n"),
    output_modalities: ["audio"],
    audio: {
      input: {
        noise_reduction: { type: "far_field" },
        transcription: { model: "gpt-4o-mini-transcribe", language: "en" },
        turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true },
      },
      output: { voice: process.env.MAIA_REALTIME_VOICE?.trim() || "marin" },
    },
  };
}

async function metaCallAction(input: { phoneNumberId: string; accessToken: string; graphVersion: string; callId: string; action: "accept" | "terminate"; sdp?: string; opaqueData?: string }) {
  const payload: Record<string, unknown> = {
    messaging_product: "whatsapp",
    call_id: input.callId,
    action: input.action,
  };
  if (input.sdp) payload.session = { sdp_type: "answer", sdp: input.sdp };
  if (input.opaqueData) payload.biz_opaque_callback_data = input.opaqueData.slice(0, 512);
  const response = await fetch(`https://graph.facebook.com/${input.graphVersion}/${encodeURIComponent(input.phoneNumberId)}/calls`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as Json;
  if (!response.ok) throw new Error(text((body.error as Json | undefined)?.message, 500) || `Meta rejected the WhatsApp call ${input.action} (${response.status}).`);
  return body;
}

export async function acceptMaiaWhatsAppCall(call: WhatsAppCallEvent, target: TenantVoiceTarget) {
  if (process.env.MAIA_WHATSAPP_CALLING_ENABLED !== "true") return { ok: false, enabled: false, reason: "feature_disabled" } as const;
  if (target.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) return { ok: false, enabled: true, reason: "limitless_realty_only" } as const;
  if (!call.id || !call.from || !call.phoneNumberId) throw new Error("A WhatsApp call ID, caller and phone number ID are required.");
  if (call.event.toLowerCase() !== "connect" || call.session?.sdp_type?.toLowerCase() !== "offer" || !call.session.sdp?.trim()) {
    return { ok: true, enabled: true, ignored: true, reason: "not_an_inbound_offer" } as const;
  }
  const credentials = await getWhatsAppCredentials(target.organizationId);
  const accessToken = text(credentials?.access_token || credentials?.accessToken);
  const phoneNumberId = text(credentials?.phone_number_id || credentials?.phoneNumberId) || call.phoneNumberId;
  const graphVersion = text(credentials?.graph_version) || process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!accessToken) throw new Error("Meta WhatsApp credentials are unavailable for Maia Calling.");
  if (String(credentials?.provider_family || "meta").toLowerCase() === "twilio") throw new Error("WhatsApp Calling requires a Meta Cloud API integration, not Twilio WhatsApp.");

  await preflightChargeableFluxAi({ organizationId: target.organizationId, feature: "leo_voice", action: "leo_voice_minute" });
  const agent = await createAdminClient().from("agents").select("name").eq("id", target.agentId).eq("organization_id", target.organizationId).maybeSingle();
  const session = openAiSession(text(agent.data?.name) || "Maia", target.organizationId, text(call.contactName));
  const multipart = buildMultipart(call.session.sdp, session);
  const openAiResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
    method: "POST",
    headers: { Authorization: `Bearer ${text(process.env.OPENAI_API_KEY)}`, Accept: "application/sdp", "Content-Type": `multipart/form-data; boundary=${multipart.boundary}` },
    body: multipart.body,
    cache: "no-store",
  });
  const answer = await openAiResponse.text();
  if (!openAiResponse.ok) throw new Error(providerError(answer));
  const location = openAiResponse.headers.get("location") || openAiResponse.headers.get("Location") || "";
  const realtimeCallId = location.split("/").filter(Boolean).pop() || "";
  if (!realtimeCallId) throw new Error("OpenAI accepted the Maia voice offer but did not return a realtime session identifier.");

  const opaqueData = JSON.stringify({ organizationId: target.organizationId, agentId: target.agentId, callId: call.id });
  const metaResult = await metaCallAction({ phoneNumberId, accessToken, graphVersion, callId: call.id, action: "accept", sdp: answer, opaqueData });
  await recordChargeableFluxAiUsage({ organizationId: target.organizationId, action: "leo_voice_minute", source: "maia_whatsapp_calling", provider: "openai", model: String(session.model), quantity: 1, metadata: { call_id: call.id, provider: "meta_whatsapp" } });
  return { ok: true, enabled: true, accepted: true, callId: call.id, realtimeCallId, model: session.model, voice: (session.audio as Json).output && text(((session.audio as Json).output as Json).voice), meta: metaResult } as const;
}

export async function terminateMaiaWhatsAppCall(input: { organizationId: string; phoneNumberId: string; callId: string }) {
  const credentials = await getWhatsAppCredentials(input.organizationId);
  const accessToken = text(credentials?.access_token || credentials?.accessToken);
  const phoneNumberId = text(credentials?.phone_number_id || credentials?.phoneNumberId) || input.phoneNumberId;
  const graphVersion = text(credentials?.graph_version) || process.env.WHATSAPP_GRAPH_VERSION || "v23.0";
  if (!accessToken || !phoneNumberId || !input.callId) throw new Error("Meta call termination credentials or call ID are unavailable.");
  return metaCallAction({ phoneNumberId, accessToken, graphVersion, callId: input.callId, action: "terminate" });
}

