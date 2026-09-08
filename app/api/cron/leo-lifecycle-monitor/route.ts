import { NextResponse } from "next/server";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { listPersistedLeoSignals, reconcileLeoProactiveSignals } from "@/lib/leo-proactive-signal-store";
import { syncLeoProactiveLifecycleDashboardNotifications, syncLifecycleDashboardNotifications } from "@/lib/dashboard-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(secret && supplied && supplied === secret);
}

export async function GET(request: Request) {
  if (!authorizedCron(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await scanLeoProactiveSignals({ limit: 100 });
  const current = await reconcileLeoProactiveSignals(snapshot, "leo_lifecycle_cron");
  const allPersisted = await listPersistedLeoSignals(500);
  const [proactiveNotifications] = await Promise.all([
    syncLeoProactiveLifecycleDashboardNotifications(allPersisted),
    syncLifecycleDashboardNotifications(),
  ]);

  const lifecycleSignals = current.filter((item) => item.category === "lifecycle");
  const resolvedLifecycle = allPersisted.filter((item) => item.category === "lifecycle" && item.lifecycle === "resolved").length;

  return NextResponse.json({
    ok: true,
    generatedAt: snapshot.generatedAt,
    scan: {
      total: snapshot.total,
      critical: snapshot.critical,
      high: snapshot.high,
      medium: snapshot.medium,
      low: snapshot.low,
      lifecycleSignals: lifecycleSignals.length,
    },
    lifecycle: {
      new: lifecycleSignals.filter((item) => item.lifecycle === "new").length,
      active: lifecycleSignals.filter((item) => item.lifecycle === "active").length,
      acknowledged: lifecycleSignals.filter((item) => item.lifecycle === "acknowledged").length,
      resolvedHistory: resolvedLifecycle,
    },
    notificationSync: proactiveNotifications,
    execution: "observe_recommend_only",
  }, { headers: { "cache-control": "no-store" } });
}
