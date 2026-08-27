import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession, storeLeoMessage } from "@/lib/leo-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "voice", allowPublic: true });
  if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || body.session_id || "").trim();
  if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });

  const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : null;
  if (!role) return NextResponse.json({ error: "role must be user or assistant." }, { status: 400 });

  const content = String(body.content || "").trim().slice(0, 8000);
  if (!content) return NextResponse.json({ error: "content is required." }, { status: 400 });

  const session = await getOrCreateLeoSession({ identity, sessionId });
  if (session.id !== sessionId) return NextResponse.json({ error: "Leo session could not be resolved." }, { status: 404 });

  await storeLeoMessage({ identity, session, role, content, metadata: { source: "voice_transcript" } });
  void auditLeoEvent({ identity, session, eventType: "voice_transcript_stored", details: { role, characters: content.length } });
  return NextResponse.json({ ok: true, sessionId: session.id });
}