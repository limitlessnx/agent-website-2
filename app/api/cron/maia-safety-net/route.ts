import { NextResponse } from "next/server";

/**
 * Daily Hobby-plan safety net for Maia's autonomous and follow-up engines.
 *
 * The primary high-frequency scheduler is intentionally external to Vercel
 * because Hobby deployments only support daily cron schedules. This endpoint
 * is therefore a reconciliation pass, not the primary scheduler.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const headers: HeadersInit = cronSecret
    ? { authorization: `Bearer ${cronSecret}` }
    : {};

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
    mode: "daily-safety-net",
    results: summary,
  });
}
