import { runMaia } from "@/lib/ai/maia-runtime";
import { resolveCanonicalCustomer, getOrCreateCanonicalConversation, addCanonicalCrmMessage } from "@/lib/canonical-customer";
import {
  claimMaiaConversationLock,
  markMaiaInboundCompleted,
  markMaiaInboundFailed,
  recordMaiaRuntimeEvent,
  registerMaiaInboundEvent,
  releaseMaiaConversationLock,
  validateMaiaTenantContext,
  type MaiaInboundPayload,
} from "@/lib/ai/maia-trigger-runtime";

export type MaiaVoiceTurnPayload = MaiaInboundPayload & {
  channel: "voice";
  provider: string;
  callId?: string;
  direction?: "inbound" | "outbound" | "unknown";
  turnIndex?: number;
  isTerminal?: boolean;
};

function clean(value: unknown, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function voiceThreadId(payload: MaiaVoiceTurnPayload) {
  return clean(payload.externalConversationId || payload.callId, 300);
}

export async function processMaiaVoiceTurn(payload: MaiaVoiceTurnPayload) {
  if (payload.channel !== "voice") throw new Error("Maia voice adapter only accepts voice payloads.");
  const conversationKey = voiceThreadId(payload);
  if (!conversationKey) throw new Error("A voice conversation identifier is required.");
  if (!clean(payload.message, 20000)) throw new Error("A voice transcript turn is required.");

  await validateMaiaTenantContext(payload);
  const registration = await registerMaiaInboundEvent(payload);
  if (registration.duplicate) {
    return { ok: true, duplicate: true, eventId: registration.event.id, reply: null };
  }

  const eventId = registration.event.id;
  const lockOwner = eventId;
  const locked = await claimMaiaConversationLock(payload, lockOwner);
  if (!locked) throw new Error("The Maia voice conversation is currently being processed; retry this turn.");

  try {
    const phone = clean(payload.customerPhone, 80);
    const externalKey = `voice:${payload.provider}:${conversationKey}`;
    const customer = await resolveCanonicalCustomer({
      organizationId: payload.organizationId,
      phone: phone || undefined,
      externalKey,
      fullName: clean(payload.customerName, 180) || "Voice caller",
      source: "maia-voice-runtime",
    });
    const conversationId = await getOrCreateCanonicalConversation({
      organizationId: payload.organizationId,
      customerId: customer.customerId,
      channel: "voice",
      externalThreadId: conversationKey,
      agentId: payload.agentId,
      metadata: { provider: payload.provider, call_id: clean(payload.callId, 240) || null },
    });

    await addCanonicalCrmMessage({
      organizationId: payload.organizationId,
      conversationId,
      senderType: "customer",
      direction: "inbound",
      content: payload.message,
      externalMessageId: `maia-voice-inbound:${payload.externalEventId}`,
      status: "received",
      metadata: {
        provider: payload.provider,
        call_id: clean(payload.callId, 240) || null,
        turn_index: Number.isFinite(Number(payload.turnIndex)) ? Number(payload.turnIndex) : null,
        direction: payload.direction || "inbound",
      },
    });

    await recordMaiaRuntimeEvent({
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      eventType: "voice_turn_started",
      status: "processing",
      payload: { eventId, conversationId, callId: clean(payload.callId, 240) || null, turnIndex: payload.turnIndex ?? null },
    });

    const result = await runMaia({
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      message: [
        "VOICE CALL CONTEXT: Reply for spoken delivery. Keep the response concise, natural and easy to understand aloud.",
        "Do not use markdown, long lists, URLs, or visual-only formatting. If property media is requested, explain that Maia can send it through the customer's verified WhatsApp conversation after the call or when the appropriate channel is available.",
        `Caller name: ${clean(payload.customerName, 180) || "unknown"}`,
        `Caller phone: ${phone || "not provided"}`,
        `Transcript turn:\n${payload.message}`,
      ].join("\n\n"),
      channel: "voice",
      externalConversationId: conversationKey,
      customerId: customer.customerId,
      conversationId,
      correlationId: eventId,
      autonomous: true,
    });

    await addCanonicalCrmMessage({
      organizationId: payload.organizationId,
      conversationId,
      senderType: "agent",
      direction: "outbound",
      content: result.reply,
      externalMessageId: `maia-voice-reply:${eventId}`,
      status: "queued",
      metadata: { provider: payload.provider, maia_session_id: result.sessionId, turn_index: payload.turnIndex ?? null },
    });

    await markMaiaInboundCompleted(eventId);
    await recordMaiaRuntimeEvent({
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      eventType: "voice_turn_completed",
      status: "completed",
      payload: { eventId, conversationId, sessionId: result.sessionId, steps: result.steps, toolResults: result.toolResults, terminal: payload.isTerminal === true },
    });

    return {
      ok: true,
      duplicate: false,
      eventId,
      conversationId,
      customerId: customer.customerId,
      sessionId: result.sessionId,
      reply: result.reply,
      steps: result.steps,
      model: result.model,
      toolResults: result.toolResults,
      terminal: payload.isTerminal === true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Maia voice turn failed.";
    await markMaiaInboundFailed(eventId, errorMessage).catch(() => undefined);
    await recordMaiaRuntimeEvent({
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      eventType: "voice_turn_failed",
      status: "failed",
      payload: { eventId, externalEventId: payload.externalEventId, error: errorMessage },
    }).catch(() => undefined);
    throw error;
  } finally {
    await releaseMaiaConversationLock(payload, lockOwner).catch(() => undefined);
  }
}
