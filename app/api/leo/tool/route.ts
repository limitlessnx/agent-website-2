import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  assertLeoToolAllowed,
  leoApprovalFor,
  resolveLeoIdentity,
  type LeoChannel,
} from "@/lib/leo-core";
import { createLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n } from "@/lib/leo-n8n-executor";
import { auditLeoEvent } from "@/lib/leo-session-store";

function channel(value: unknown): LeoChannel {
  return value === "voice" ? "voice" : value === "api" ? "api" : "chat";
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identity = await resolveLeoIdentity({ channel: channel(body.channel), allowPublic: true });
    if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

    const toolKey = String(body.toolKey || body.tool_key || "").trim();
    if (!toolKey) return NextResponse.json({ error: "toolKey is required." }, { status: 400 });
    const tool = assertLeoToolAllowed(identity, toolKey);
    const approval = leoApprovalFor(identity, tool.key);
    const confirmed = body.confirmed === true;

    if (approval === "confirm" && !confirmed) {
      return NextResponse.json({
        ok: true,
        status: "confirmation_required",
        toolKey: tool.key,
        title: tool.title,
        message: `Confirm ${tool.title.toLowerCase()} before Leo executes it.`,
      });
    }

    const requestId = String(body.requestId || body.request_id || randomUUID()).trim();
    const sessionId = String(body.sessionId || body.session_id || "").trim() || null;
    const envelope = createLeoExecutionEnvelope({
      requestId,
      sessionId,
      identity,
      toolKey: tool.key,
      arguments: object(body.arguments),
      approvalGranted: approval === "none" || confirmed,
    });

    await auditLeoEvent({
      identity,
      eventType: "tool_execution_dispatched",
      toolKey: tool.key,
      details: { request_id: requestId, channel: identity.channel, approval },
    });

    const result = await executeLeoEnvelopeViaN8n(envelope);
    return NextResponse.json({
      ...result,
      approval,
      channel: identity.channel,
      scope: identity.scope,
    }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo could not execute this action.";
    return NextResponse.json({ error: message }, { status: /not permitted|Cross-tenant|Unauthorized/i.test(message) ? 403 : 500 });
  }
}
