import { logger, task } from "@trigger.dev/sdk";
import { runMaia } from "@/lib/ai/maia-runtime";
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
  run: async (payload: MaiaInboundPayload) => {
    await validateMaiaTenantContext(payload);

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
      const result = await runMaia({
        organizationId: payload.organizationId,
        agentId: payload.agentId,
        message: payload.message,
        channel: payload.channel,
        externalConversationId: payload.externalConversationId,
        autonomous: true,
      });

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
