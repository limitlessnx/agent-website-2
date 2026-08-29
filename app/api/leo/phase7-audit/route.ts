import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoPhase7 } from "@/lib/leo-phase7-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  try {
    const audit = await auditLeoPhase7({ identity });
    return NextResponse.json({ ok: audit.status !== "fail", audit }, { headers: { "cache-control": "no-store" }, status: audit.status === "fail" ? 409 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Phase 7 audit failed." }, { status: 500 });
  }
}
