import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import { runMaia } from "@/lib/ai/maia-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { getWhatsAppCredentials } from "@/lib/whatsapp-integration";
import { addCanonicalCrmMessage, getOrCreateCanonicalConversation, resolveCanonicalCustomer } from "@/lib/canonical-customer";
import {
  queueLimitlessFollowup,
  queueLimitlessPropertyFollowupSequence,
  searchLimitlessProperties,
  shouldFollowUp,
} from "@/lib/ai/limitless-realty-maia";
import {
  type MaiaInboundPayload,
  claimMaiaConversationLock,
  markMaiaInboundCompleted,
  markMaiaInboundFailed,
  recordMaiaRuntimeEvent,
  registerMaiaInboundEvent,
  releaseMaiaConversationLock,
  validateMaiaTenantContext,
} from "@/lib/ai/maia-trigger-runtime";

const MAX_PROVIDER_EVENT_AGE_MS = 24 * 60 * 60 * 1000;

async function transcribeWhatsAppAudio(payload: MaiaInboundPayload) {
  const mediaId = String(payload.metadata?.mediaId || "");
  if (String(payload.metadata?.messageType || "").toLowerCase() !== "audio" || !mediaId) return null;
  const credentials = await getWhatsAppCredentials(payload.organizationId);
  const token = String(credentials?.access_token || credentials?.accessToken || "");
  const graphVersion = String(credentials?.graph_version || "v23.0");
  if (!token) throw new Error("WhatsApp credentials are unavailable for audio transcription.");
  const mediaResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
    cache: "no-store",
  });
  const mediaMeta = await mediaResponse.json().catch(() => ({}));
  if (!mediaResponse.ok || !mediaMeta?.url) throw new Error(String(mediaMeta?.error?.message || "WhatsApp audio media could not be resolved."));
  const audioResponse = await fetch(String(mediaMeta.url), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!audioResponse.ok) throw new Error(`WhatsApp audio download failed (${audioResponse.status}).`);
  const buffer = await audioResponse.arrayBuffer();
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: String(mediaMeta.mime_type || payload.metadata?.mimeType || "audio/ogg") }), "whatsapp-voice.ogg");
  form.append("model", process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe");
  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}` },
    body: form,
    cache: "no-store",
  });
  const transcription = await transcriptionResponse.json().catch(() => ({}));
  if (!transcriptionResponse.ok) throw new Error(String(transcription?.error?.message || `Audio transcription failed (${transcriptionResponse.status}).`));
  return String(transcription?.text || "").trim();
}


function providerEventIsStale(payload: MaiaInboundPayload) {
  const raw = Number(payload.metadata?.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return false;
  const eventMs = raw > 10_000_000_000 ? raw : raw * 1000;
  return Date.now() - eventMs > MAX_PROVIDER_EVENT_AGE_MS;
}

export const maiaProcessInboundMessage = task({
  id: "maia-process-inbound-message",
  maxDuration: 300,
  retry: {
    maxAttempts: 4,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 45_000,
    factor: 2,
  },
  catchError: async ({ error }) => {
    const message = error instanceof Error ? error.message : String(error);
    // Provider-side 4xx errors are deterministic request/configuration failures.
    // Retrying them created a production retry storm and duplicated persisted user messages.
    if (/OpenAI request failed \(4\d\d\)/i.test(message)) {
      throw new AbortTaskRunError(message);
    }
  },
  run: async (payload: MaiaInboundPayload) => {
    await validateMaiaTenantContext(payload);

    if (providerEventIsStale(payload)) {
      logger.info("Ignoring stale Maia provider event", {
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        externalEventId: payload.externalEventId,
        providerTimestamp: String(payload.metadata?.timestamp || ""),
      });
      return {
        ok: true,
        stale: true,
        ignored: true,
        reason: "provider_event_older_than_24_hours",
      };
    }

    const registration = await registerMaiaInboundEvent(payload);
    if (registration.duplicate) {
      logger.info("Maia inbound event already completed; skipping duplicate", {
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        externalEventId: payload.externalEventId,
        eventId: registration.event.id,
      });
      return {
        ok: true,
        duplicate: true,
        eventId: registration.event.id,
      };
    }

    const eventId = registration.event.id;
    const lockOwner = eventId;
    const locked = await claimMaiaConversationLock(payload, lockOwner);

    if (!locked) {
      logger.warn("Maia conversation is already being processed; retrying later", {
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        externalConversationId: payload.externalConversationId,
        eventId,
      });
      throw new Error("Maia conversation is currently locked by another inbound event.");
    }

    await recordMaiaRuntimeEvent({
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      eventType: "trigger_inbound_started",
      status: "processing",
      payload: {
        eventId,
        externalEventId: payload.externalEventId,
        channel: payload.channel,
        provider: payload.provider || "unknown",
        externalConversationId: payload.externalConversationId || null,
      },
    });

    try {
      const isLimitlessRealty = payload.organizationId === "b15f21b4-5697-4d21-9421-8a34eae3476d";
      const transcribedAudio = await transcribeWhatsAppAudio(payload);
      const effectiveMessage = transcribedAudio || payload.message;
      if (transcribedAudio) {
        payload.message = transcribedAudio;
        await recordMaiaRuntimeEvent({ organizationId: payload.organizationId, agentId: payload.agentId, eventType: "voice_note_transcribed", status: "completed", payload: { eventId, transcript: transcribedAudio.slice(0, 8000), externalEventId: payload.externalEventId } });
      }
      const stopIntent = /\b(stop(?: sending| messaging| contacting)?|unsubscribe|opt[- ]?out|remove me from (?:your )?(?:messages|list)|(?:do not|don't) (?:send|message|contact)|no more messages)\b/i.test(payload.message);

      if (isLimitlessRealty && stopIntent && payload.customerPhone) {
        const admin = createAdminClient();
        const phone = payload.customerPhone.replace(/\D/g, "");
        const { data: candidateLeads } = await admin
          .from("leads")
          .select("id,phone")
          .eq("organization_id", payload.organizationId);
        const matchingLeadIds = (candidateLeads || [])
          .filter((lead) => String(lead.phone || "").replace(/\D/g, "") === phone)
          .map((lead) => lead.id)
          .filter(Boolean);

        if (matchingLeadIds.length) {
          await admin
            .from("leads")
            .update({ opted_out: true, status: "opted_out", updated_at: new Date().toISOString() })
            .eq("organization_id", payload.organizationId)
            .in("id", matchingLeadIds);
        }

        const leadIds = matchingLeadIds;
        if (leadIds.length) {
          await admin
            .from("follow_ups")
            .update({ status: "cancelled" })
            .eq("organization_id", payload.organizationId)
            .eq("status", "pending")
            .in("lead_id", leadIds);
        }
        await admin
          .from("agent_runtime_goals")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("organization_id", payload.organizationId)
          .eq("agent_id", payload.agentId)
          .eq("goal_type", "follow_up")
          .in("status", ["queued", "running"])
          .filter("input->>customer_phone", "eq", phone);
        await markMaiaInboundCompleted(eventId);
        await recordMaiaRuntimeEvent({
          organizationId: payload.organizationId,
          agentId: payload.agentId,
          eventType: "trigger_inbound_completed",
          status: "completed",
          payload: { eventId, stopIntent: true, suppressedReply: true },
        });
        return { ok: true, duplicate: false, eventId, suppressedReply: true, reason: "customer_opted_out" };
      }
      if (isLimitlessRealty && payload.customerPhone) {
        const admin = createAdminClient();
        const phone = payload.customerPhone.replace(/\D/g, "");
        const { data: candidateLeads, error: candidateLeadError } = await admin
          .from("leads")
          .select("id,phone")
          .eq("organization_id", payload.organizationId);
        if (candidateLeadError) throw candidateLeadError;
        const leadIds = (candidateLeads || [])
          .filter((lead) => String(lead.phone || "").replace(/\D/g, "") === phone)
          .map((lead) => lead.id)
          .filter(Boolean);
        if (leadIds.length) {
          await admin
            .from("follow_ups")
            .update({ status: "cancelled" })
            .eq("organization_id", payload.organizationId)
            .eq("status", "pending")
            .in("lead_id", leadIds);
        }
        await admin
          .from("agent_runtime_goals")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("organization_id", payload.organizationId)
          .eq("agent_id", payload.agentId)
          .eq("goal_type", "follow_up")
          .in("status", ["queued", "running"])
          .filter("input->>customer_phone", "eq", phone);
      }

      const customerId = payload.customerPhone
        ? await resolveCanonicalCustomer({ organizationId: payload.organizationId, phone: payload.customerPhone, externalKey: "whatsapp:" + payload.customerPhone, fullName: payload.customerName || "WhatsApp customer", source: "maia-whatsapp-runtime" }).then((result) => result.customerId)
        : null;
      const conversationId = customerId
        ? await getOrCreateCanonicalConversation({ organizationId: payload.organizationId, customerId, channel: "whatsapp", externalThreadId: payload.externalConversationId || ("whatsapp:" + (payload.customerPhone || customerId)), agentId: payload.agentId, metadata: { provider: payload.provider || "meta_whatsapp", source: "maia-whatsapp-runtime" } })
        : null;

      if (conversationId) {
        await addCanonicalCrmMessage({ organizationId: payload.organizationId, conversationId, senderType: "customer", direction: "inbound", content: payload.message, externalMessageId: "whatsapp-inbound:" + payload.externalEventId, status: "received", metadata: { provider: payload.provider || "meta_whatsapp", maia_event_id: eventId } });
        const { data: conversation } = await createAdminClient().from("crm_conversations").select("status,metadata").eq("organization_id", payload.organizationId).eq("id", conversationId).maybeSingle();
        const metadata = (conversation?.metadata || {}) as Record<string, unknown>;
        const responseMode = String(metadata.ai_response_mode || "").trim();
        const humanControlled = ["waiting","human_active","resolved"].includes(String(conversation?.status || "")) || ["paused_for_handoff","human_takeover","stopped"].includes(responseMode);
        if (humanControlled) {
          await markMaiaInboundCompleted(eventId);
          await recordMaiaRuntimeEvent({ organizationId: payload.organizationId, agentId: payload.agentId, eventType: "trigger_inbound_completed", status: "completed", payload: { eventId, conversationId, customerId, suppressedReply: true, reason: "human_handoff_active" } });
          return { ok: true, duplicate: false, eventId, conversationId, customerId, suppressedReply: true, reason: "human_handoff_active" };
        }
      }

      const propertyContext = isLimitlessRealty ? await searchLimitlessProperties(effectiveMessage) : null;
      const runtimeMessage = propertyContext
        ? [effectiveMessage, "", "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:", JSON.stringify(propertyContext), "", "Use the verified property result when answering. Never invent availability, pricing, title, documentation or property media. If the customer asks about a named property, use the exact verified catalog match.", "For a clear property enquiry or buying intent, preserve the property context for follow-up scheduling."].join("\n")
        : effectiveMessage;
      const result = await runMaia({ organizationId: payload.organizationId, agentId: payload.agentId, message: runtimeMessage, channel: payload.channel, externalConversationId: payload.externalConversationId, customerId: customerId || undefined, conversationId: conversationId || undefined, correlationId: eventId, autonomous: true });

      let followup: unknown = null;
      if (isLimitlessRealty && payload.channel === "whatsapp" && payload.customerPhone) {
        const lowerMessage = effectiveMessage.toLowerCase();
        const propertyMentioned = Boolean(propertyContext?.matches?.some((property) => {
          const title = String(property.title || "").trim().toLowerCase();
          return title.length >= 5 && lowerMessage.includes(title);
        })) || /\b(this|that|the)\s+(property|estate|land|plot|house|apartment)\b/i.test(effectiveMessage);
        const buyingIntent = /\b(interested|interest|like|love|want|looking to buy|looking for|how much|price|payment|installment|inspection|title|documentation|documents|location|availability|reserve|book|pay|purchase)\b/i.test(effectiveMessage);
        if (propertyMentioned && buyingIntent) {
          followup = await queueLimitlessPropertyFollowupSequence({
            organizationId: payload.organizationId,
            agentId: payload.agentId,
            customerPhone: payload.customerPhone,
            customerName: payload.customerName,
            propertyContext,
          });
        } else if (shouldFollowUp(effectiveMessage)) {
          followup = await queueLimitlessFollowup({
            organizationId: payload.organizationId,
            agentId: payload.agentId,
            customerPhone: payload.customerPhone,
            customerName: payload.customerName,
            when: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            message: `Follow up with ${payload.customerName || "the client"} about the Limitless Realty enquiry. Preserve the verified catalogue context and do not invent availability or pricing.`,
          });
        }
      }

      let delivery: Awaited<ReturnType<typeof sendWhatsAppMessage>> | null = null;
      if (payload.channel === "whatsapp" && payload.customerPhone) {
        delivery = await sendWhatsAppMessage({
          organizationId: payload.organizationId,
          to: payload.customerPhone,
          text: result.reply,
          deliveryMode: "direct",
          lastCustomerMessageAt: new Date().toISOString(),
        });
        if (conversationId) {
          await addCanonicalCrmMessage({
            organizationId: payload.organizationId,
            conversationId,
            senderType: "agent",
            direction: "outbound",
            content: result.reply,
            externalMessageId: delivery.providerMessageId || ("maia-runtime:" + result.sessionId + ":" + eventId),
            status: delivery.providerMessageId ? "sent" : "queued",
            metadata: { provider: payload.provider || "meta_whatsapp", maia_session_id: result.sessionId },
          });
        }
      }

      await markMaiaInboundCompleted(eventId);
      await recordMaiaRuntimeEvent({
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        eventType: "trigger_inbound_completed",
        status: "completed",
        payload: {
          eventId,
          sessionId: result.sessionId,
          steps: result.steps,
          model: result.model,
          toolResults: result.toolResults,
          delivery,
          followup,
        },
      });

      logger.info("Maia inbound message processed", {
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        eventId,
        sessionId: result.sessionId,
        channel: payload.channel,
        steps: result.steps,
      });

      return {
        ok: true,
        duplicate: false,
        eventId,
        sessionId: result.sessionId,
        reply: result.reply,
        steps: result.steps,
        model: result.model,
        toolResults: result.toolResults,
        delivery,
        followup,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Maia Trigger execution failed.";
      await markMaiaInboundFailed(eventId, errorMessage).catch(() => undefined);
      await recordMaiaRuntimeEvent({
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        eventType: "trigger_inbound_failed",
        status: "failed",
        payload: {
          eventId,
          externalEventId: payload.externalEventId,
          error: errorMessage,
        },
      }).catch(() => undefined);

      logger.error("Maia inbound message failed", {
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        eventId,
        error: errorMessage,
      });
      throw error;
    } finally {
      await releaseMaiaConversationLock(payload, lockOwner).catch((error) => {
        logger.error("Maia conversation lock release failed", {
          organizationId: payload.organizationId,
          agentId: payload.agentId,
          eventId,
          error: error instanceof Error ? error.message : "Unknown lock release error",
        });
      });
    }
  },
});
