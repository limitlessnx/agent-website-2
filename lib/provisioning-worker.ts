import { createAdminClient } from "@/lib/supabase/admin";

export type ProvisioningWorkerResult = {
  processed?: boolean;
  reason?: string;
  [key: string]: unknown;
};

function isWorkerResult(value: unknown): value is ProvisioningWorkerResult {
  return typeof value === "object" && value !== null;
}

export async function processProvisioningQueue(limit = 10) {
  const admin = createAdminClient();
  const results: ProvisioningWorkerResult[] = [];
  const safeLimit = Math.max(1, Math.min(limit, 25));

  for (let index = 0; index < safeLimit; index += 1) {
    const { data, error } = await admin.rpc("process_next_provisioning_job");

    if (error) {
      throw new Error(`Provisioning worker failed: ${error.message}`);
    }

    if (!isWorkerResult(data)) {
      throw new Error("Provisioning worker returned an invalid response.");
    }

    results.push(data);

    if (data.processed === false && data.reason === "no_job") {
      break;
    }
  }

  return {
    processed: results.filter((item) => item.processed === true).length,
    results,
  };
}
