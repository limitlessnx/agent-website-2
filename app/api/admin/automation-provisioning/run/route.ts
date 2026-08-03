import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { runNextAutomationProvisioningJob } from "@/lib/automation-provisioning";

export const runtime = "nodejs";
export const maxDuration = 60;

type WorkerResult = {
  processed?: boolean;
  reason?: string;
  [key: string]: unknown;
};

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const results: WorkerResult[] = [];
    for (let index = 0; index < 5; index += 1) {
      const result = await runNextAutomationProvisioningJob();
      results.push(result);
      if (result.processed === false && result.reason === "no_job") break;
    }

    return NextResponse.json({
      processed: results.filter((item) => item.processed === true).length,
      results,
    });
  } catch (error) {
    console.error("Admin automation provisioning run failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run provisioning." },
      { status: 500 },
    );
  }
}
