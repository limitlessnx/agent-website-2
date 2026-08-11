import { NextRequest, NextResponse } from "next/server";
import { secureEqual } from "@/lib/runtime/auth";
import { verifyLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeAuthorizedLeoTool } from "@/lib/leo-tool-runtime";
import { leoApprovalFor } from "@/lib/leo-core";
import { auditLeoEvent } from "@/lib/leo-session-store";

function authorizeBridge(request: NextRequest) {
  const expected = (process.env.LEO_N8N_SHARED_SECRET || "").trim();
  const supplied = request.headers.get("x-fluxknight-leo-secret") || "";
  return Boolean(expected && secureEqual(expected, supplied));
}

export async function POST(request: NextRequest) {
  if (!authorizeBridge(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const { envelope, identity } = verifyLeoExecutionEnvelope(body);
    const approval = leoApprovalFor(identity, envelope.toolKey);

    if (approval === "confirm" && !envelope.approvalGranted) {
      return NextResponse.json(
        { ok: false, requestId: envelope.requestId, toolKey: envelope.toolKey, status: "confirmation_required", error: "This Leo action requires confirmation." },
        { status: 409 },
      );
    }

    await auditLeoEvent({
      identity,
      eventType: "tool_execution_started",
      toolKey: envelope.toolKey,
      details: { request_id: envelope.requestId, channel: envelope.channel },
    });

    const result = await executeAuthorizedLeoTool({
      identity,
      toolKey: envelope.toolKey,
      arguments: envelope.arguments,
      actor: identity.email || identity.userId || identity.role,
    });

    await auditLeoEvent({
      identity,
      eventType: "tool_execution_completed",
      toolKey: envelope.toolKey,
      details: { request_id: envelope.requestId, latency_ms: Date.now() - startedAt },
    });

    return NextResponse.json({
      ok: true,
      requestId: envelope.requestId,
      toolKey: envelope.toolKey,
      status: approval === "admin" ? "admin_request_recorded" : "completed",
      result,
      executionId: envelope.requestId,
      workflow: "leo_core_v2_executor",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo tool execution failed.";
    return NextResponse.json(
      { ok: false, status: "failed", error: message, latencyMs: Date.now() - startedAt },
      { status: /Unauthorized|signature|expired|Cross-tenant|not permitted/i.test(message) ? 403 : 500 },
    );
  }
}
