import { transcribeWhatsAppAudio } from "@/lib/whatsapp-media-transcription";
import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import { runMaia } from "@/lib/ai/maia-runtime";
import { runOptionalRealEstateOperation } from "@/lib/ai/optional-real-estate-operation";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureTenantContactDates } from "@/lib/tenant-contact-dates";
import { recordRealEstateCustomerInboundWindow } from "@/lib/real-estate-customer-service-window";
import { dispatchMaiaOutboundMessage } from "@/lib/maia-outbound";
import { addCanonicalCrmMessage, getOrCreateCanonicalConversation, resolveCanonicalCustomer } from "@/lib/canonical-customer";
import {
  queueLimitlessPropertyFollowupSequence,
  searchLimitlessProperties,
} from "@/lib/ai/limitless-realty-maia";
import { isExplicitLimitlessOptInMessage, limitlessPhoneCandidates, normalizeLimitlessPhone, uniqueLimitlessPhoneMatchId } from "@/lib/limitless-followup-contract";
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
      if (payload.channel === "whatsapp" && payload.provider === "meta_whatsapp" && payload.customerPhone) {
        await recordRealEstateCustomerInboundWindow({
          organizationId: payload.organizationId,
          phone: payload.customerPhone,
          provider: payload.provider,
          providerMessageId: payload.externalEventId,
          occurredAt: payload.metadata?.timestamp,
        }).catch((error) => logger.warn("Unable to record real-estate customer-service window", {
          organizationId: payload.organizationId,
          externalEventId: payload.externalEventId,
          errorType: error instanceof Error ? error.name : "unknown",
        }));
      }
      const transcribedAudio = await transcribeWhatsAppAudio(payload);
      const effectiveMessage = transcribedAudio || payload.message;
      if (transcribedAudio) {
        payload.message = transcribedAudio;
        await recordMaiaRuntimeEvent({ organizationId: payload.organizationId, agentId: payload.agentId, eventType: "voice_note_transcribed", status: "completed", payload: { eventId, transcript: transcribedAudio.slice(0, 8000), externalEventId: payload.externalEventId } });
      }
      const stopIntent = /\b(stop(?: sending| messaging| contacting)?|unsubscribe|opt[- ]?out|remove me from (?:your )?(?:messages|list)|(?:do not|don't) (?:send|message|contact)|no more messages)\b/i.test(payload.message);

      if (isLimitlessRealty && stopIntent && payload.customerPhone) {
        const admin = createAdminClient();
        const rawPhone = payload.customerPhone.trim();
        const phone = normalizeLimitlessPhone(rawPhone);
        if (!phone) throw new Error("Unable to verify the customer phone for this opt-out request.");
        const phoneVariants = limitlessPhoneCandidates(rawPhone);
        const { data: candidateLeads, error: leadLookupError } = await admin
          .from("leads")
          .select("id,phone")
          .eq("organization_id", payload.organizationId)
          .in("phone", phoneVariants)
          .limit(21);
        if (leadLookupError) throw leadLookupError;
        if ((candidateLeads || []).length >= 21) throw new Error("Limitless phone lookup is ambiguous; no opt-out updates were applied.");
        const normalizedMatches = (candidateLeads || [])
          .filter((lead) => normalizeLimitlessPhone(lead.phone) === phone)
          .map((lead) => ({ id: lead.id }));
        const matchingLeadId = uniqueLimitlessPhoneMatchId(normalizedMatches);
        if (matchingLeadId) {
          const { error: optOutError } = await admin.rpc("record_limitless_maia_opt_out", {
            p_organization_id: payload.organizationId,
            p_lead_id: matchingLeadId,
            p_external_event_id: payload.externalEventId || null,
          });
          if (optOutError) throw optOutError;
        }
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
      const customerId = payload.customerPhone
        ? await resolveCanonicalCustomer({ organizationId: payload.organizationId, phone: payload.customerPhone, externalKey: "whatsapp:" + payload.customerPhone, fullName: payload.customerName || "WhatsApp customer", source: "maia-whatsapp-runtime" }).then((result) => result.customerId)
        : null;
      // Persist only explicitly stated birthday/anniversary dates. The helper
      // scopes every read/write to this tenant and never overwrites an existing date.
      if (payload.customerPhone && customerId && payload.channel === "whatsapp") {
        try {
          await captureTenantContactDates({
            organizationId: payload.organizationId,
            fullName: payload.customerName || "WhatsApp customer",
            phone: payload.customerPhone,
            message: effectiveMessage,
          });
        } catch (error) {
          logger.warn("Customer date capture failed; continuing Maia reply", {
            organizationId: payload.organizationId,
            agentId: payload.agentId,
            errorType: error instanceof Error ? error.name : "unknown",
          });
        }
      }

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

      const propertyContext = isLimitlessRealty ? await searchLimitlessProperties(effectiveMessage, payload.organizationId) : null;
      const runtimeMessage = propertyContext
        ? [effectiveMessage, "", "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:", JSON.stringify(propertyContext), "", "Use the verified property result when answering. Never invent availability, pricing, title, documentation or property media. If the customer asks about a named property, use the exact verified catalog match.", "For a clear property enquiry or buying intent, preserve the property context for follow-up scheduling."].join("\n")
        : effectiveMessage;
      const result = await runMaia({ organizationId: payload.organizationId, agentId: payload.agentId, message: runtimeMessage, channel: payload.channel, externalConversationId: payload.externalConversationId, customerId: customerId || undefined, conversationId: conversationId || undefined, correlationId: eventId, autonomous: true });

      let followup: unknown = null;
      if (isLimitlessRealty && payload.channel === "whatsapp" && payload.customerPhone) {
        followup = await runOptionalRealEstateOperation(async () => {
          let scheduledFollowup: unknown = null;
        const lowerMessage = effectiveMessage.toLowerCase();
        const propertyMentioned = Boolean(propertyContext?.matches?.some((property) => {
          const title = String(property.title || "").trim().toLowerCase();
          return title.length >= 5 && lowerMessage.includes(title);
        })) || /\b(this|that|the)\s+(property|estate|land|plot|house|apartment)\b/i.test(effectiveMessage);
        const explicitOptIn = isExplicitLimitlessOptInMessage(effectiveMessage);
        if (explicitOptIn && customerId) {
          scheduledFollowup = await queueLimitlessPropertyFollowupSequence({
            organizationId: payload.organizationId,
            agentId: payload.agentId,
            customerId,
            customerPhone: payload.customerPhone,
            customerName: payload.customerName,
            propertyContext,
            consentAt: new Date().toISOString(),
            consentSource: "maia_whatsapp_inbound",
            consentActor: `customer:${customerId}`,
            explicitRenewedConsent: explicitOptIn,
            specificPropertyMentioned: propertyMentioned,
          });
        }

          return scheduledFollowup;
        });
        const followupSummary = followup && typeof followup === "object"
          ? followup as { created?: unknown; skipped?: unknown }
          : null;
        await recordMaiaRuntimeEvent({
          organizationId: payload.organizationId,
          agentId: payload.agentId,
          eventType: "optional_followup_result",
          status: followupSummary?.skipped ? "skipped" : followupSummary?.created ? "scheduled" : "no_followup",
          payload: {
            created_count: typeof followupSummary?.created === "number" ? followupSummary.created : 0,
            skip_reason: typeof followupSummary?.skipped === "string" ? followupSummary.skipped : null,
          },
        }).catch(() => undefined);
      }

      let delivery: Awaited<ReturnType<typeof dispatchMaiaOutboundMessage>> | null = null;
      if (payload.channel === "whatsapp" && payload.customerPhone) {
        delivery = await dispatchMaiaOutboundMessage({
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
