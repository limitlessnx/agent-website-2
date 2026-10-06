import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLimitlessInstallmentReminderSweep } from "@/lib/limitless-installment-reminder-runtime";

async function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (cronSecret && supplied === cronSecret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLimitlessInstallmentReminderSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to run installment reminder sweep.",
    }, { status: 500 });
  }
}
