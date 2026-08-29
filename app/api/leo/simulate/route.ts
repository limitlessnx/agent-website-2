import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { simulateLeoBusinessChange } from "@/lib/leo-business-simulation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const changes = Array.isArray(body.changes) ? body.changes : [];
    const simulation = await simulateLeoBusinessChange({
      identity,
      workspace: body.workspace || undefined,
      organizationId: body.organizationId || body.organization_id || undefined,
      title: body.title,
      description: body.description,
      changes,
    });
    return NextResponse.json({ ok: true, simulation }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Business simulation failed." }, { status: 500 });
  }
}
