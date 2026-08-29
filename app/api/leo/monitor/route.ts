import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") {
    return NextResponse.json({ error: "Super Leo proactive monitoring requires super-admin access." }, { status: 403 });
  }
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 50, 100));
  const snapshot = await scanLeoProactiveSignals({ limit });
  return NextResponse.json({ ok: true, ...snapshot }, { headers: { "cache-control": "no-store" } });
}
