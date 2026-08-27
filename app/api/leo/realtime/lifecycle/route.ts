import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession } from "@/lib/leo-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set(["connected", "canceled", "ended", "dropped", "backgrounded", "resumed"]);

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "voice", allowPublic: true });
  if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || body.session_id || "").trim();
  const event = String(body.event || "").trim().toLowerCase();
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
  if (!ALLOWED_EVENTS.has(event)) return NextResponse.json({ error: "Unsupported voice lifecycle event." }, { status: 400 });

  const session = await getOrCreateLeoSession({ identity, sessionId });
  if (session.id !== sessionId) return NextResponse.json({ error: "Leo session could not be resolved." }, { status: 404 });

  const details = body.details && typeof body.details === "object" && !Array.isArray(body.details) ? body.details : {};
  await auditLeoEvent({ identity, session, eventType: `voice_call_${event}`, details });
  return NextResponse.json({ ok: true, sessionId: session.id, event });
}
