import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { preflightChargeableFluxAi, recordChargeableFluxAiUsage } from "@/lib/flux-ai-metering-core";
import { analysis, conversationId, durationSeconds, eventType, firstText, metadata, payloadData, record, transcript, verifyElevenLabsSignature } from "@/lib/elevenlabs-webhooks";

type Json = Record<string, unknown>;

function failedTransfer(payload: Json, type: string) {
  const data = payloadData(payload);
  const meta = metadata(payload);
  const transfer = firstText(data.transfer_status, data.transferStatus, data.transfer_result, meta.transfer_status, meta.transfer_result).toLowerCase();
  return type.toLowerCase().includes("failure") || ["failed", "failure", "declined", "unavailable", "no_answer", "busy"].includes(transfer);
}

function organizationFromPayload(payload: Json) {
  const meta = metadata(payload);
  const data = payloadData(payload);
  return firstText(meta.organization_id, meta.organizationId, data.organization_id, data.organizationId, payload.organization_id, payload.organizationId);
}

function externalAgentId(payload: Json) {
  const data = payloadData(payload);
  return firstText(data.agent_id, data.agentId, payload.agent_id, payload.agentId);
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET || "";
  if (!verifyElevenLabsSignature(rawBody, request.headers.get("ElevenLabs-Signature"), secret)) {
    return NextResponse.json({ error: "Invalid ElevenLabs webhook signature." }, { status: 401 });
  }

  let payload: Json;
  try {
    payload = JSON.parse(rawBody) as Json;
  } catch {
    return NextResponse.json({ error: "Invalid JSON webhook payload." }, { status: 400 });
  }

  const type = eventType(payload);
  const callId = conversationId(payload);
  const eventKey = firstText(payload.event_id, payload.eventId, payload.id, callId ? `${type}:${callId}` : "");
  if (!eventKey) return NextResponse.json({ error: "ElevenLabs event identity is missing." }, { status: 400 });

  const admin = createAdminClient();
  const eventInsert = await admin.from("elevenlabs_voice_webhook_events").insert({ event_key: eventKey, event_type: type, conversation_id: callId || null, payload });
  if (eventInsert.error?.code === "23505") return NextResponse.json({ ok: true, duplicate: true, event_key: eventKey });
  if (eventInsert.error) return NextResponse.json({ error: eventInsert.error.message }, { status: 500 });

  try {
    if (!callId) throw new Error("ElevenLabs conversation_id is required.");
    const hintedOrganizationId = organizationFromPayload(payload);
    const providerAgentId = externalAgentId(payload);
    let organizationId = hintedOrganizationId;
    let agent: { id: string; organization_id: string; name: string | null } | null = null;

    if (organizationId && providerAgentId) {
      const result = await admin.from("agents").select("id,organization_id,name").eq("organization_id", organizationId).eq("configuration->>elevenlabs_agent_id", providerAgentId).maybeSingle();
      if (result.error) throw result.error;
      agent = result.data;
    }
    if (!agent && providerAgentId) {
      const result = await admin.from("agents").select("id,organization_id,name").eq("configuration->>elevenlabs_agent_id", providerAgentId).maybeSingle();
      if (result.error) throw result.error;
      agent = result.data;
      organizationId = agent?.organization_id || organizationId;
    }
    if (!organizationId) throw new Error("Unable to resolve the ElevenLabs call to a Fluxknight organization.");
    if (!agent) {
      const result = await admin.from("agents").select("id,organization_id,name").eq("organization_id", organizationId).contains("communication_channels", ["voice"]).maybeSingle();
      if (result.error) throw result.error;
      agent = result.data;
    }
    if (!agent) throw new Error("No Voice agent is allocated for the resolved organization.");

    const data = payloadData(payload);
    const meta = metadata(payload);
    const duration = durationSeconds(payload);
    const transferFailed = failedTransfer(payload, type);
    const summary = firstText(record(analysis(payload)).summary, record(analysis(payload)).call_summary, data.summary).slice(0, 8000);
    const direction = firstText(data.direction, meta.direction, "inbound").toLowerCase();
    const callerPhone = firstText(data.caller_phone, data.callerPhone, data.from, meta.caller_phone, meta.from);
    const status = transferFailed ? "transfer_failed" : type.toLowerCase().includes("failure") ? "failed" : "completed";

    const conversationInsert = await admin.from("agent_conversations").insert({ organization_id: organizationId, agent_id: agent.id, channel: "voice", external_thread_key: `elevenlabs:${callId}`, status: transferFailed ? "human_handoff" : "closed", ai_paused: transferFailed, last_message_at: new Date().toISOString(), metadata: { provider: "elevenlabs", conversation_id: callId, event_type: type } }).select("id").maybeSingle();
    let conversation = conversationInsert.data;
    if (conversationInsert.error?.code === "23505") {
      const existing = await admin.from("agent_conversations").select("id").eq("organization_id", organizationId).eq("channel", "voice").eq("external_thread_key", `elevenlabs:${callId}`).maybeSingle();
      if (existing.error) throw existing.error;
      conversation = existing.data;
    } else if (conversationInsert.error) throw conversationInsert.error;
    if (!conversation?.id) throw new Error("Unable to persist the ElevenLabs conversation.");

    const existingCall = await admin.from("elevenlabs_voice_calls").select("id,metered_at,flux_credits_charged").eq("organization_id", organizationId).eq("conversation_id", callId).maybeSingle();
    if (existingCall.error) throw existingCall.error;
    const callPayload = { organization_id: organizationId, agent_id: agent.id, conversation_id: callId, elevenlabs_agent_id: providerAgentId || null, elevenlabs_version_id: firstText(data.version_id, data.versionId), direction: ["inbound", "outbound"].includes(direction) ? direction : "unknown", status, duration_seconds: duration, transfer_status: transferFailed ? "failed" : firstText(data.transfer_status, meta.transfer_status) || null, caller_phone: callerPhone || null, transcript: transcript(payload) || null, summary: summary || null, analysis: analysis(payload), raw_payload: payload, updated_at: new Date().toISOString() };
    const savedCall = await admin.from("elevenlabs_voice_calls").upsert(callPayload, { onConflict: "organization_id,conversation_id" }).select("id,metered_at,flux_credits_charged").single();
    if (savedCall.error) throw savedCall.error;

    if (transferFailed) {
      const existingHandoff = await admin.from("handoff_requests").select("id").eq("organization_id", organizationId).eq("conversation_id", conversation.id).ilike("notes", `%${callId}%`).maybeSingle();
      if (existingHandoff.error) throw existingHandoff.error;
      if (!existingHandoff.data) {
        const handoff = await admin.from("handoff_requests").insert({ organization_id: organizationId, conversation_id: conversation.id, agent_id: agent.id, reason: "ElevenLabs human transfer failed or was unavailable.", priority: "high", status: "open", notes: `ElevenLabs conversation ${callId}. Caller: ${callerPhone || "unknown"}. Summary: ${summary || "No summary available."}` }).select("id,status").single();
        if (handoff.error) throw handoff.error;
      }
    }

    let creditsCharged = Number(savedCall.data.flux_credits_charged || 0);
    if (!savedCall.data.metered_at && duration > 0) {
      const minutes = Math.max(1, Math.ceil(duration / 60));
      await preflightChargeableFluxAi({ organizationId, feature: "leo_voice", action: "leo_voice_minute", quantity: minutes });
      const usage = await recordChargeableFluxAiUsage({ organizationId, action: "leo_voice_minute", quantity: minutes, source: "elevenlabs_voice_call", provider: "elevenlabs", providerUsage: { duration_seconds: duration, duration_minutes: minutes, conversation_id: callId }, metadata: { conversation_id: callId, agent_id: agent.id, event_key: eventKey, transfer_failed: transferFailed } });
      creditsCharged = usage.credits;
      await admin.from("elevenlabs_voice_calls").update({ flux_credits_charged: creditsCharged, metered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("conversation_id", callId);
    }

    await admin.from("elevenlabs_voice_webhook_events").update({ organization_id: organizationId, processed_at: new Date().toISOString() }).eq("event_key", eventKey);
    return NextResponse.json({ ok: true, event_key: eventKey, organization_id: organizationId, conversation_id: callId, call_status: status, transfer_failed: transferFailed, duration_seconds: duration, flux_credits_charged: creditsCharged });
  } catch (error) {
    await admin.from("elevenlabs_voice_webhook_events").update({ processing_error: error instanceof Error ? error.message : "Unable to process ElevenLabs webhook." }).eq("event_key", eventKey);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process ElevenLabs webhook." }, { status: 500 });
  }
}
