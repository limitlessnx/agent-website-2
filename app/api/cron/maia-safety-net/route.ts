import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Maia scheduler gateway.
 *
 * - Vercel Hobby invokes this route once daily as a safety net using CRON_SECRET.
 * - Supabase Cron invokes it frequently using the private scheduler token stored
 *   in Supabase Vault. The token is verified server-side through a privileged RPC.
 *
 * This keeps high-frequency scheduling off Vercel while preserving the existing
 * autonomous and follow-up engines.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const suppliedCronSecret = authorization?.replace(/^Bearer\s+/i, "").trim();
  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();

  let authorized = Boolean(cronSecret && suppliedCronSecret === cronSecret);

  if (!authorized && schedulerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("verify_maia_scheduler_secret", {
      candidate: schedulerToken,
    });
    authorized = !error && data === true;
  }

  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseUrl = new URL(request.url).origin;
  const internalSecret = cronSecret;
  if (!internalSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const headers: HeadersInit = { authorization: `Bearer ${internalSecret}` };

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
    mode: schedulerToken && suppliedCronSecret !== cronSecret ? "external-scheduler" : "daily-safety-net",
    results: summary,
  });
}
