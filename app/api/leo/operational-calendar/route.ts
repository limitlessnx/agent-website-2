import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { buildLeoOperationalCalendarSnapshot, completeLeoOperationalCalendarEntry, createLeoOperationalCalendarEntry, listLeoOperationalCalendarEntries, setLeoOperationalCalendarEntryStatus, updateLeoOperationalCalendarEntry } from "@/lib/leo-operational-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const workspace = request.nextUrl.searchParams.get("workspace") || undefined;
  const organizationId = request.nextUrl.searchParams.get("organizationId") || undefined;
  const mode = request.nextUrl.searchParams.get("mode") || "snapshot";
  if (mode === "list") return NextResponse.json({ ok: true, entries: await listLeoOperationalCalendarEntries(identity, { workspace, organizationId, includeInactive: request.nextUrl.searchParams.get("includeInactive") === "true" }) });
  return NextResponse.json(await buildLeoOperationalCalendarSnapshot({ identity, workspace, organizationId }), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
    const body = await request.json().catch(() => ({})); const action = String(body.action || "create").toLowerCase();
    if (action === "create") return NextResponse.json({ ok: true, entry: await createLeoOperationalCalendarEntry(identity, body.entry || body) }, { status: 201 });
    const id = String(body.entryId || body.entry_id || body.id || "").trim(); if (!id) return NextResponse.json({ error: "entryId is required." }, { status: 400 });
    if (action === "update") return NextResponse.json({ ok: true, entry: await updateLeoOperationalCalendarEntry(identity, id, body.patch || body.entry || {}) });
    if (action === "complete") return NextResponse.json({ ok: true, entry: await completeLeoOperationalCalendarEntry(identity, id) });
    if (action === "cancel") return NextResponse.json({ ok: true, entry: await setLeoOperationalCalendarEntryStatus(identity, id, "cancelled") });
    if (action === "reactivate") return NextResponse.json({ ok: true, entry: await setLeoOperationalCalendarEntryStatus(identity, id, "active") });
    return NextResponse.json({ error: "Unsupported action. Use create, update, complete, cancel or reactivate." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Operational calendar operation failed." }, { status: 500 });
  }
}
