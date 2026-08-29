import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent } from "@/lib/leo-session-store";
import { auditLeoAutonomyGovernance, getLeoAutonomyGovernance, updateLeoAutonomyGovernance } from "@/lib/leo-autonomy-governance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const policy = await getLeoAutonomyGovernance(identity);
  return NextResponse.json({ ok: true, policy, audit: auditLeoAutonomyGovernance(policy) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  try {
    const body = await request.json().catch(() => ({}));
    const policy = await updateLeoAutonomyGovernance(identity, body && typeof body === "object" && !Array.isArray(body) ? body : {});
    await auditLeoEvent({ identity, eventType: "leo_autonomy_governance_updated", details: { version: policy.version, kill_switch: policy.killSwitch, global_enabled: policy.globalEnabled, consequential_autonomous_execution: false } });
    return NextResponse.json({ ok: true, policy, audit: auditLeoAutonomyGovernance(policy) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Leo autonomy governance." }, { status: 400 });
  }
}
