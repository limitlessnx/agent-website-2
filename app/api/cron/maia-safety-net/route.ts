import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Maia scheduler gateway.
 *
 * Vercel Cron invokes this daily as a safety net using CRON_SECRET.
 * Supabase Cron invokes it frequently using the private scheduler token stored
 * in Supabase Vault. The gateway forwards the same authenticated context to the
 * two existing Maia runners, so high-frequency execution does not depend on
 * CRON_SECRET being present for the external scheduler path.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const suppliedCronSecret = authorization?.replace(/^Bearer\s+/i, "").trim();
  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();

  let authorized = Boolean(cronSecret && suppliedCronSecret === cronSecret);
  let externalSchedulerAuthorized = false;

  if (!authorized && schedulerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("verify_maia_scheduler_secret", {
      candidate: schedulerToken,
    });
    externalSchedulerAuthorized = !error && data === true;
    authorized = externalSchedulerAuthorized;
  }

  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = new URL(request.url).origin;
  const headers: HeadersInit = cronSecret
    ? { authorization: `Bearer ${cronSecret}` }
    : { "x-maia-scheduler-token": schedulerToken as string };

  const results = await Promise.allSettled([
    fetch(`${baseUrl}/api/maia/autonomous`, { method: "GET", headers, cache: "no-store" }),
    fetch(`${baseUrl}/api/limitless/maia/followups`, { method: "GET", headers, cache: "no-store" }),
  ]);

  const summary = results.map((result, index) => ({
    task: index === 0 ? "autonomous" : "followups",
    ok: result.status === "fulfilled" && result.value.ok,
    status: result.status === "fulfilled" ? result.value.status : null,
    error: result.status === "rejected" ? String(result.reason) : null,
  }));

  return NextResponse.json({
    ok: summary.every((item) => item.ok),
    mode: externalSchedulerAuthorized ? "external-scheduler" : "daily-safety-net",
    results: summary,
  }, { status: 200 });
}
