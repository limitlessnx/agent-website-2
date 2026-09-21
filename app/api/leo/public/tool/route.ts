import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertLeoToolAllowed, leoApprovalFor, type LeoIdentity } from "@/lib/leo-core";
import { createLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n } from "@/lib/leo-n8n-executor";
import { capturePublicLeoLead } from "@/lib/leo-lead-capture";
import { auditLeoEvent, getOrCreateLeoSession, updateLeoPublicLeadState } from "@/lib/leo-session-store";

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

    if (tool.key === "leo.public.lead.capture") {
      const session = sessionId ? await getOrCreateLeoSession({ identity, sessionId }) : null;
      if (session?.leadCaptured) {
        return NextResponse.json({ ok: true, status: "already_captured", toolKey: tool.key, leadCaptured: true, leadId: session.leadId || null });
      }
      const result = await capturePublicLeoLead(args);
      let updated = session;
      if (result.ok && session) {
        updated = await updateLeoPublicLeadState({
          identity,
          session,
          leadProfile: {
            name: String(args.name || ""),
            email: String(args.email || ""),
            phone: String(args.phone || ""),
            organization: String(args.organization || args.business_name || ""),
            business_type: String(args.business_type || ""),
            main_goal: String(args.main_goal || ""),
          },
          captured: true,
          leadId: result.leadId,
        });
      }
      await auditLeoEvent({ identity, session: updated || undefined, eventType: result.ok ? "public_tool_completed" : "public_tool_failed", toolKey: tool.key, details: { status: result.status } });
      return NextResponse.json({ ...result, toolKey: tool.key, scope: "public", leadCaptured: Boolean(updated?.leadCaptured) || result.ok, leadId: updated?.leadId || (result.ok ? result.leadId : null) }, { status: result.ok ? 200 : 400 });
    }

    const requestId = String(body.requestId || body.request_id || randomUUID()).trim();
    const envelope = createLeoExecutionEnvelope({
      requestId,
      sessionId: sessionId || null,
      identity,
      toolKey: tool.key,
      arguments: args,
      approvalGranted: approval === "none" || confirmed,
    });
    const result = await executeLeoEnvelopeViaN8n(envelope);
    return NextResponse.json({ ...result, approval, channel: identity.channel, scope: "public" }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Public Leo could not execute this action.";
    console.error("[leo/public/tool] execution failed", { diagnosticId, message, stack: error instanceof Error ? error.stack : undefined });
    return NextResponse.json({ error: message, diagnosticId }, { status: /not permitted/i.test(message) ? 403 : 500 });
  }
}
