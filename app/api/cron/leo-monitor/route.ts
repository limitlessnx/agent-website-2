import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { listPersistedLeoSignals, reconcileLeoProactiveSignals } from "@/lib/leo-proactive-signal-store";
import { alertPolicyForLeoSignal } from "@/lib/leo-proactive-policy";
import { auditLeoProactiveMonitoring } from "@/lib/leo-proactive-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const supplied = authorization?.replace(/^Bearer\s+/i, "").trim();
  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  let authorized = Boolean(cronSecret && supplied === cronSecret);
  let schedulerAuthorized = false;
  if (!authorized && schedulerToken) {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
    schedulerAuthorized = !error && data === true;
    authorized = schedulerAuthorized;
  }
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await scanLeoProactiveSignals({ limit: 100 });
  const active = await reconcileLeoProactiveSignals(snapshot, schedulerAuthorized ? "leo_supabase_scheduler" : "leo_vercel_scheduler");
  const all = await listPersistedLeoSignals(500);
  const audit = auditLeoProactiveMonitoring(all);
  const deliverable = active.filter((item) => alertPolicyForLeoSignal(item).deliver);

  return NextResponse.json({
    ok: true,
    mode: schedulerAuthorized ? "high-frequency-scheduler" : "vercel-scheduler",
    generatedAt: snapshot.generatedAt,
    detected: active.length,
    deliverable: deliverable.length,
    critical: active.filter((item) => item.severity === "critical").length,
    high: active.filter((item) => item.severity === "high").length,
    lifecycle: {
      new: active.filter((item) => item.lifecycle === "new").length,
      active: active.filter((item) => item.lifecycle === "active").length,
      acknowledged: active.filter((item) => item.lifecycle === "acknowledged").length,
    },
    audit,
  }, { headers: { "cache-control": "no-store" } });
}
