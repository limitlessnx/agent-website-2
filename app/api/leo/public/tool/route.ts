import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertLeoToolAllowed, leoApprovalFor, type LeoIdentity } from "@/lib/leo-core";
import { executePublicLeoTool } from "@/lib/leo-public-tools";
import { auditLeoEvent, getOrCreateLeoSession, updateLeoPublicEmailCandidate, updateLeoPublicLeadState } from "@/lib/leo-session-store";

const PUBLIC_IDENTITY: LeoIdentity = {
  scope: "public",
  role: "visitor",
  channel: "voice",
  globalScope: false,
};

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  const diagnosticId = randomUUID();
  try {
    const body = await request.json().catch(() => ({}));
    const toolKey = String(body.toolKey || body.tool_key || "").trim();
    if (!toolKey) return NextResponse.json({ error: "toolKey is required.", diagnosticId }, { status: 400 });

    const identity: LeoIdentity = { ...PUBLIC_IDENTITY, channel: body.channel === "chat" ? "chat" : "voice" };
    const tool = assertLeoToolAllowed(identity, toolKey);
    if (!tool.key.startsWith("leo.public.")) {
      return NextResponse.json({ error: "This tool is not available to Public Leo.", diagnosticId }, { status: 403 });
    }

    const approval = leoApprovalFor(identity, tool.key);
    const confirmed = body.confirmed === true;
    const args = object(body.arguments);
    const sessionId = String(body.sessionId || body.session_id || "").trim();

    if (approval === "confirm" && !confirmed) {
      return NextResponse.json({
        ok: true,
        status: "confirmation_required",
        toolKey: tool.key,
        title: tool.title,
        message: "Confirm " + tool.title.toLowerCase() + " before Leo executes it.",
      });
    }

    let session = sessionId ? await getOrCreateLeoSession({ identity, sessionId }) : null;
    if (tool.key === "leo.public.lead.capture" && session?.leadCaptured) {
      return NextResponse.json({ ok: true, status: "already_captured", toolKey: tool.key, leadCaptured: true, leadId: session.leadId || null });
    }

    if (identity.channel === "voice" && tool.key === "leo.public.lead.capture") {
      const candidateEmail = String(args.email || "").trim().toLowerCase();
      const voiceTurnId = Number(body.voiceTurnId);
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail);
      if (!session || !validEmail || !Number.isFinite(voiceTurnId)) {
        return NextResponse.json({ ok: false, status: "email_confirmation_required", email: candidateEmail || null }, { status: 400 });
      }

      const explicitlyConfirmed = args.email_confirmed === true;
      const sameCandidate = session.pendingEmailCandidate === candidateEmail;
      const laterUserTurn = typeof session.pendingEmailTurnId === "number" && voiceTurnId > session.pendingEmailTurnId;

      if (!explicitlyConfirmed || !sameCandidate || !laterUserTurn) {
        session = await updateLeoPublicEmailCandidate({ identity, session, email: candidateEmail, turnId: voiceTurnId });
        return NextResponse.json({
          ok: true,
          status: "email_confirmation_required",
          email: candidateEmail,
          emailConfirmed: false,
        });
      }
    }

    const result = await executePublicLeoTool({ toolKey: tool.key, args, sessionId });
    let updated = session;
    if (result.ok && tool.key === "leo.public.lead.capture" && session) {
      session = await updateLeoPublicEmailCandidate({ identity, session, email: null, turnId: null });
      updated = await updateLeoPublicLeadState({
        identity,
        session,
        leadProfile: {
          name: String(args.name || ""),
          email: String(args.email || ""),
          phone: String(args.phone || ""),
          organization: String(args.organization || args.business_name || ""),
          business_type: String(args.industry || args.business_type || ""),
          main_goal: String(args.main_goal || ""),
        },
        captured: true,
        leadId: "leadId" in result ? String(result.leadId || "") : null,
      });
    }

    await auditLeoEvent({
      identity,
      session: updated || undefined,
      eventType: result.ok ? "public_tool_completed" : "public_tool_failed",
      toolKey: tool.key,
      details: { status: String(result.status || "unknown"), local: true },
    });

    return NextResponse.json(
      { ...result, toolKey: tool.key, scope: "public", localExecution: true },
      { status: result.ok ? 200 : 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public Leo could not execute this action.";
    console.error("[leo/public/tool] execution failed", { diagnosticId, message, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: message, diagnosticId }, { status: /not permitted/i.test(message) ? 403 : 500 });
  }
}
