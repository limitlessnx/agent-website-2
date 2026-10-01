import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk";
import { runMaia } from "@/lib/ai/maia-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
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
    const tenantContext = await validateMaiaTenantContext(payload);

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
      const isLimitlessRealty = String(tenantContext.organization.slug || "").toLowerCase() === "limitless-realty";
      const stopIntent = /\b(stop(?: sending| messaging| contacting)?|unsubscribe|opt[- ]?out|remove me from (?:your )?(?:messages|list)|(?:do not|don't) (?:send|message|contact)|no more messages)\b/i.test(payload.message);

      if (isLimitlessRealty && stopIntent && payload.customerPhone) {
        const admin = createAdminClient();
        const phone = payload.customerPhone.replace(/\D/g, "");
        await admin
          .from("leads")
          .update({ opted_out: true, status: "opted_out", updated_at: new Date().toISOString() })
          .eq("organization_id", payload.organizationId)
          .eq("phone", phone);
        const { data: matchingLeads } = await admin
          .from("leads")
          .select("id")
          .eq("organization_id", payload.organizationId)
          .eq("phone", phone);
        const leadIds = (matchingLeads || []).map((lead) => lead.id).filter(Boolean);
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
      const propertyContext = isLimitlessRealty ? await searchLimitlessProperties(payload.message) : null;
      const runtimeMessage = propertyContext
        ? [
            payload.message,
            "",
            "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:",
            JSON.stringify(propertyContext),
            "",
            "Use the verified property result when answering. Never invent availability, pricing, title, documentation or property media. If the customer asks about a named property, use the exact verified catalog match.",
            "For a clear property enquiry or buying intent, preserve the property context for follow-up scheduling.",
          ].join("\n")
        : payload.message;
      const result = await runMaia({
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        message: runtimeMessage,
        channel: payload.channel,
        externalConversationId: payload.externalConversationId,
        autonomous: true,
      });

      let followup: unknown = null;
      if (isLimitlessRealty && payload.channel === "whatsapp" && payload.customerPhone) {
        const lowerMessage = payload.message.toLowerCase();
        const propertyMentioned = Boolean(propertyContext?.matches?.some((property) => {
          const title = String(property.title || "").trim().toLowerCase();
          return title.length >= 5 && lowerMessage.includes(title);
        })) || /\b(this|that|the)\s+(property|estate|land|plot|house|apartment)\b/i.test(payload.message);
        const buyingIntent = /\b(interested|interest|like|love|want|looking to buy|looking for|how much|price|payment|installment|inspection|title|documentation|documents|location|availability|reserve|book|pay|purchase)\b/i.test(payload.message);
        if (propertyMentioned && buyingIntent) {
          followup = await queueLimitlessPropertyFollowupSequence({
            organizationId: payload.organizationId,
            agentId: payload.agentId,
            customerPhone: payload.customerPhone,
            customerName: payload.customerName,
            propertyContext,
          });
        } else if (shouldFollowUp(payload.message)) {
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

      let delivery: unknown = null;
      if (payload.channel === "whatsapp" && payload.customerPhone) {
        delivery = await sendWhatsAppMessage({
          organizationId: payload.organizationId,
          to: payload.customerPhone,
          text: result.reply,
          deliveryMode: "direct",
          lastCustomerMessageAt: payload.customerMessageAt || null,
        });
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
