import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { preflightChargeableFluxAi } from "@/lib/flux-ai-metering-core";
import { analysis, conversationId, durationSeconds, eventType, firstText, metadata, payloadData, record, transcript, verifyElevenLabsSignature } from "@/lib/elevenlabs-webhooks";

import { calculateModeledProviderCostCents } from "@/lib/fluxknight-plans";

type Json = Record<string, unknown>;

class ReceiptError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}

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

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid JSON webhook payload." }, { status: 400 });
  }
  const type = eventType(payload);
  const callId = conversationId(payload);
  const eventKey = firstText(payload.event_id, payload.eventId, payload.id, callId ? `${type}:${callId}` : "");
  if (!eventKey || !callId || eventKey.length > 512 || callId.length > 256) {
    return NextResponse.json({ error: "A valid ElevenLabs event and conversation identity is required." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient> | undefined;
  let stored = false;
  try {
    admin = createAdminClient();
    const inserted = await admin.from("elevenlabs_voice_webhook_events").insert({ event_key: eventKey, event_type: type, conversation_id: callId, payload });
    let receipt: { payload: unknown; processed_at: string | null; organization_id: string | null } = { payload, processed_at: null, organization_id: null };
    if (inserted.error?.code === "23505") {
      const prior = await admin.from("elevenlabs_voice_webhook_events").select("payload,processed_at,organization_id").eq("event_key", eventKey).single();
      if (prior.error || !prior.data) throw new Error("Receipt evidence unavailable");
      receipt = prior.data;
      if (canonicalJson(receipt.payload) !== canonicalJson(payload)) {
        throw new ReceiptError("The event identity was reused with different content.", 409);
      }
    } else if (inserted.error) throw inserted.error;
    stored = true;
    if (receipt.processed_at) return NextResponse.json({ ok: true, duplicate: true, event_key: eventKey });

    const providerAgentId = externalAgentId(payload);
    if (!providerAgentId) throw new ReceiptError("ElevenLabs provider agent identity is required.", 422);
    // A signed organization hint is not authority to choose a tenant or agent.
    const mapped = await admin.from("agents").select("id,organization_id,name")
      .eq("configuration->>elevenlabs_agent_id", providerAgentId).maybeSingle();
    if (mapped.error || !mapped.data) throw new Error("Voice agent mapping unavailable or ambiguous");
    const agent = mapped.data;
    const organizationId = agent.organization_id;
    const hintedOrganizationId = organizationFromPayload(payload);
    if ((hintedOrganizationId && hintedOrganizationId.toLowerCase() !== organizationId.toLowerCase()) ||
        (receipt.organization_id && receipt.organization_id !== organizationId)) {
      throw new ReceiptError("The receipt does not match the configured organization.", 403);
    }
    // Retain the first verified tenant binding even if a later preflight/read
    // fails. A configuration change cannot silently move a failed receipt.
    if (!receipt.organization_id) {
      const bound = await admin.from("elevenlabs_voice_webhook_events").update({ organization_id: organizationId })
        .eq("event_key", eventKey).is("organization_id", null).is("processed_at", null)
        .select("organization_id,processed_at").maybeSingle();
      if (bound.error) throw bound.error;
      if (!bound.data) {
        const current = await admin.from("elevenlabs_voice_webhook_events").select("organization_id,processed_at").eq("event_key", eventKey).single();
        if (current.error || !current.data) throw new Error("Receipt binding unavailable");
        if (current.data.organization_id !== organizationId) throw new ReceiptError("The receipt does not match the configured organization.", 403);
        if (current.data.processed_at) return NextResponse.json({ ok: true, duplicate: true, event_key: eventKey });
      }
    }
    const existing = await admin.from("elevenlabs_voice_calls").select("metered_at,flux_credits_charged,duration_seconds")
      .eq("organization_id", organizationId).eq("conversation_id", callId).maybeSingle();
    if (existing.error) throw existing.error;

    const data = payloadData(payload);
    const meta = metadata(payload);
    const duration = Math.max(durationSeconds(payload), Number(existing.data?.duration_seconds || 0));
    const transferFailed = failedTransfer(payload, type);
    const summary = firstText(record(analysis(payload)).summary, record(analysis(payload)).call_summary, data.summary).slice(0, 8000);
    const direction = firstText(data.direction, meta.direction, "inbound").toLowerCase();
    const callerPhone = firstText(data.caller_phone, data.callerPhone, data.from, meta.caller_phone, meta.from);
    const status = transferFailed ? "transfer_failed" : type.toLowerCase().includes("failure") ? "failed" : "completed";
    const minutes = Math.max(1, Math.ceil(duration / 60));
    let creditAmount = 0;
    let planCode: string | null = null;
    if (!existing.data?.metered_at && duration > 0) {
      const quote = await preflightChargeableFluxAi({ organizationId, feature: "leo_voice", action: "leo_voice_minute", quantity: minutes });
      creditAmount = quote.credits;
      planCode = quote.wallet.planCode;
    }
    const applied = await admin.rpc("apply_elevenlabs_voice_receipt", {
      p_event_key: eventKey, p_payload: payload, p_organization_id: organizationId,
      p_agent_id: agent.id, p_provider_agent_id: providerAgentId, p_call_id: callId,
      p_projection: {
        event_type: type, version_id: firstText(data.version_id, data.versionId),
        direction: ["inbound", "outbound"].includes(direction) ? direction : "unknown",
        status, duration_seconds: duration, transfer_failed: transferFailed,
        transfer_status: transferFailed ? "failed" : firstText(data.transfer_status, meta.transfer_status) || null,
        caller_phone: callerPhone || null, transcript: transcript(payload) || null,
        summary: summary || null, analysis: analysis(payload),
      },
      p_credit_amount: creditAmount, p_plan_code: planCode,
      p_provider_cost_cents: creditAmount > 0 ? calculateModeledProviderCostCents("leo_voice_minute", minutes) : 0,
    });
    if (applied.error || !applied.data || applied.data.ok !== true) throw new Error("Receipt transaction unavailable");
    return NextResponse.json(applied.data);
  } catch (error) {
    if (stored && admin) {
      // Never let a failed/stale HTTP attempt overwrite committed completion.
      try {
        const failure = await admin.from("elevenlabs_voice_webhook_events")
          .update({ processing_error: "Voice receipt processing failed; retry is available." })
          .eq("event_key", eventKey).is("processed_at", null);
        if (failure.error) console.warn("[elevenlabs-receipt] failure evidence unavailable");
      } catch { console.warn("[elevenlabs-receipt] failure evidence unavailable"); }
    }
    return NextResponse.json({ error: error instanceof ReceiptError ? error.message : "Voice receipt processing is unavailable. Please retry." }, { status: error instanceof ReceiptError ? error.status : 503 });
  }
}
