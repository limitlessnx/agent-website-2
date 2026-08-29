import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoBusinessEventSnapshot, emitLeoBusinessEvent, listLeoBusinessEvents } from "@/lib/leo-business-events";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const workspace = request.nextUrl.searchParams.get("workspace") || undefined;
    const organizationId = request.nextUrl.searchParams.get("organizationId") || undefined;
    const type = request.nextUrl.searchParams.get("type") || undefined;
    const since = request.nextUrl.searchParams.get("since") || undefined;
    const limit = Number(request.nextUrl.searchParams.get("limit") || 100);
    const mode = request.nextUrl.searchParams.get("mode") || "snapshot";
    if (mode === "events") return NextResponse.json({ ok: true, events: await listLeoBusinessEvents(identity, { workspace, organizationId, type, since, limit }) }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json(await buildLeoBusinessEventSnapshot(identity, { workspace, organizationId }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read business events." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "emit").toLowerCase();
    if (action !== "emit") return NextResponse.json({ error: "Unsupported action. Use emit." }, { status: 400 });
    const result = await emitLeoBusinessEvent(identity, body.event || body);
    return NextResponse.json({ ok: true, ...result }, { status: result.duplicate ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Business event emission failed." }, { status: 500 });
  }
}
