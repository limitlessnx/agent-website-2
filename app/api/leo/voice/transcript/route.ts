import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity, sanitizeLeoPageContext } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession, storeLeoMessage } from "@/lib/leo-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "voice", allowPublic: true });
  if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const role = body.role === "assistant" ? "assistant" : body.role === "user" ? "user" : null;
  const content = String(body.content || "").trim().slice(0, 12000);
  if (!role || !content) return NextResponse.json({ error: "Transcript role and content are required." }, { status: 400 });

  const pageContext = sanitizeLeoPageContext(body.pageContext);
  const session = await getOrCreateLeoSession({
    identity,
    sessionId: String(body.sessionId || "").trim() || undefined,
    pageContext,
  });

  await storeLeoMessage({
    identity,
    session,
    role,
    content,
    metadata: { channel: "voice", page_context: pageContext || {} },
  });
  void auditLeoEvent({
    identity,
    session,
    eventType: "voice_transcript_persisted",
    details: { role, content_length: content.length },
  });

  return NextResponse.json({ ok: true, sessionId: session.id, persistence: session.persisted ? "database" : "ephemeral" });
}
