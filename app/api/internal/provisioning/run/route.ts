import { NextResponse } from "next/server";
import { processProvisioningQueue } from "@/lib/provisioning-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function runWorker(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const result = await processProvisioningQueue(10);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Provisioning worker failed", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Provisioning worker failed.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return runWorker(request);
}

export async function POST(request: Request) {
  return runWorker(request);
}
