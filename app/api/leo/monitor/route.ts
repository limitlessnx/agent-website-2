import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { acknowledgeLeoProactiveSignal, reconcileLeoProactiveSignals } from "@/lib/leo-proactive-signal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  return identity?.scope === "super_admin" ? identity : null;
}

function lifecycleSummary(signals: Awaited<ReturnType<typeof reconcileLeoProactiveSignals>>) {
  return {
    new: signals.filter((item) => item.lifecycle === "new").length,
    active: signals.filter((item) => item.lifecycle === "active").length,
    acknowledged: signals.filter((item) => item.lifecycle === "acknowledged").length,
  };
}

export async function GET(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) return NextResponse.json({ error: "Super Leo proactive monitoring requires super-admin access." }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 50, 100));
  const snapshot = await scanLeoProactiveSignals({ limit });
  const signals = await reconcileLeoProactiveSignals(snapshot, identity.email || identity.userId || "super_admin");
  return NextResponse.json({ ok: true, ...snapshot, signals, lifecycle: lifecycleSummary(signals) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) return NextResponse.json({ error: "Super Leo proactive monitoring requires super-admin access." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "").trim();
  if (action !== "acknowledge") return NextResponse.json({ error: "Unsupported monitor action. Use acknowledge." }, { status: 400 });
  try {
    const signal = await acknowledgeLeoProactiveSignal(String(body.signalId || ""), identity.email || identity.userId || "super_admin");
    return NextResponse.json({ ok: true, signal });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update proactive signal." }, { status: 400 });
  }
}
