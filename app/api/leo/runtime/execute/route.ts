import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";
import { createRuntimeToolRegistry } from "@/lib/ai-runtime/tool-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") {
    return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  }

  try {
    const body = record(await request.json().catch(() => ({})));
    const toolKey = String(body.toolKey || body.tool_key || "").trim();
    if (!toolKey) return NextResponse.json({ error: "toolKey is required." }, { status: 400 });

    const executionId = String(body.executionId || body.execution_id || randomUUID()).trim();
    const organizationId = String(body.organizationId || body.organization_id || "").trim() || undefined;
    const agentId = String(body.agentId || body.agent_id || "").trim() || undefined;
    const sessionId = String(body.sessionId || body.session_id || "").trim() || undefined;
    const args = record(body.arguments || body.input);

    if (organizationId) args.organization_id = organizationId;

    const sdk = new AgentRuntimeSDK(createRuntimeToolRegistry());
    const result = await sdk.executeTool({
      identity,
      executionId,
      organizationId,
      agentId,
      sessionId,
      toolKey,
      arguments: args,
      approvalRequestId: typeof body.approvalRequestId === "string" ? body.approvalRequestId : undefined,
      superAdminConfirmed: body.confirmed === true || body.approved === true,
    });

    const status = result.status === "succeeded" ? 200 : result.status === "approval_required" ? 409 : result.status === "rejected" ? 403 : 500;
    return NextResponse.json({ ok: result.status === "succeeded", executionId, ...result }, { status, headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo runtime execution failed.";
    return NextResponse.json({ error: message }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}
