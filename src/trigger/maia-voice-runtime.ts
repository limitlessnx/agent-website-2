import { logger, task } from "@trigger.dev/sdk";
import { processMaiaVoiceTurn, type MaiaVoiceTurnPayload } from "@/lib/maia-voice-runtime";

export const maiaProcessVoiceTurn = task({
  id: "maia-process-voice-turn",
  maxDuration: 120,
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 2_000,
    maxTimeoutInMs: 20_000,
    factor: 2,
  },
  run: async (payload: MaiaVoiceTurnPayload) => {
    const result = await processMaiaVoiceTurn(payload);
    logger.info("Maia voice turn processed", {
      organizationId: payload.organizationId,
      agentId: payload.agentId,
      externalEventId: payload.externalEventId,
      callId: payload.callId || payload.externalConversationId || null,
      duplicate: result.duplicate,
      conversationId: result.conversationId || null,
      terminal: result.terminal || false,
    });
    return result;
  },
});
