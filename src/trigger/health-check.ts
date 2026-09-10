import { logger, task } from "@trigger.dev/sdk";

export const fluxknightTriggerHealthCheck = task({
  id: "fluxknight-trigger-health-check",
  maxDuration: 60,
  run: async (payload: { source?: string } = {}) => {
    const checkedAt = new Date().toISOString();

    logger.info("Fluxknight Trigger.dev health check completed", {
      project: "fluxknight",
      source: payload.source ?? "manual",
      checkedAt,
    });

    return {
      ok: true,
      project: "fluxknight",
      checkedAt,
    };
  },
});
