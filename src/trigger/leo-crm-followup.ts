import { task } from "@trigger.dev/sdk";
import { runCrmFollowup } from "@/lib/leo-execution/worker";
import { CRM_FOLLOWUP_TASK } from "@/lib/leo-execution/contract";

export const leoCrmFollowup = task({
  id: CRM_FOLLOWUP_TASK,
  retry: { maxAttempts: 1 },
  maxDuration: 120,
  run: async (payload: { executionId: string }) => runCrmFollowup(payload.executionId),
});
