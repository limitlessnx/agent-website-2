import { NextResponse } from "next/server";
import { runNextAutomationProvisioningJob } from "@/lib/automation-provisioning";

export const runtime = "nodejs";
export const maxDuration = 60;

type WorkerResult = {
  processed?: boolean;
  reason?: string;
  [key: string]: unknown;
};

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runWorker(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

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
}

export async function GET(request: Request) {
  return runWorker(request);
}

export async function POST(request: Request) {
  return runWorker(request);
}
