import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const admin = createAdminClient();
  const results: unknown[] = [];

  for (let index = 0; index < 10; index += 1) {
    const { data, error } = await admin.rpc("process_next_provisioning_job");
    if (error) {
      console.error("Provisioning worker failed", error);
      return NextResponse.json({ error: error.message, processed: results.length, results }, { status: 500 });
    }

    results.push(data);
    if (!data || data.processed === false && data.reason === "no_job") break;
  }

  return NextResponse.json({ processed: results.filter((item: any) => item?.processed === true).length, results });
}

export async function GET(request: Request) {
  return runWorker(request);
}

export async function POST(request: Request) {
  return runWorker(request);
}
