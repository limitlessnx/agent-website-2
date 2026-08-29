import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoDecisionIntelligence } from "@/lib/leo-decision-intelligence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo decision intelligence is restricted to Fluxknight administration." }, { status: 403 });
  const url = new URL(request.url);
  const workspace = url.searchParams.get("workspace")?.trim() || undefined;
  const organizationId = url.searchParams.get("organization_id")?.trim() || undefined;
  try {
    const snapshot = await buildLeoDecisionIntelligence({ identity, workspace, organizationId });
    return NextResponse.json({ ok: true, snapshot }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("leo_decision_intelligence_failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Decision intelligence could not be generated." }, { status: 500 });
  }
}
