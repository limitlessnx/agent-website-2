import { NextRequest } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";
import { runtimeStreamResponse, streamTextAsRuntimeEvents } from "@/lib/ai-runtime/stream";
import type { RuntimeStreamEvent } from "@/lib/ai-runtime/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity) return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401, headers: { "content-type": "application/json" } });
  const body = await request.json().catch(() => ({}));
  const objective = String(body.objective || body.message || "").trim();
  if (!objective) return new Response(JSON.stringify({ error: "objective is required." }), { status: 400, headers: { "content-type": "application/json" } });
  if (body.overrideModelId && identity.scope !== "super_admin") return new Response(JSON.stringify({ error: "Only Super Admin can override the runtime model." }), { status: 403, headers: { "content-type": "application/json" } });

  async function* events(): AsyncGenerator<RuntimeStreamEvent> {
    const sdk = new AgentRuntimeSDK();
    const startedAt = new Date().toISOString();
    let executionId = "pending";
    yield { type: "runtime.started", executionId, at: startedAt };
    try {
      const result = await sdk.reason({ identity: identity!, objective, organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined, agentId: typeof body.agentId === "string" ? body.agentId : undefined, sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined, externalConversationId: typeof body.externalConversationId === "string" ? body.externalConversationId : undefined, channel: body.channel || "api", overrideModelId: typeof body.overrideModelId === "string" ? body.overrideModelId : undefined, pageContext: body.pageContext, metadata: body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata : {} });
      executionId = result.executionId;
      yield { type: "runtime.context", executionId, model: { provider: result.model.provider, modelKey: result.model.modelKey, source: result.model.source as "super_admin_override" | "agent_assignment" | "organization_assignment" | "agent_default" | "environment_default" }, toolCount: result.toolCalls.length, at: new Date().toISOString() };
      for await (const event of streamTextAsRuntimeEvents({ executionId, text: result.reply })) yield event;
      for (const tool of result.toolCalls) yield { type: "runtime.tool", executionId, tool: { toolKey: tool.toolKey, status: tool.approval === "none" ? "rejected" : "approval_required", error: tool.approval === "none" ? "Tool proposed; execution must use the runtime tool gateway." : "Human approval required before execution.", approvalRequestId: tool.approvalRequestId }, at: new Date().toISOString() };
      yield { type: "runtime.completed", executionId, at: new Date().toISOString() };
    } catch (error) {
      yield { type: "runtime.failed", executionId, error: error instanceof Error ? error.message : "Runtime stream failed.", at: new Date().toISOString() };
    }
  }

  return runtimeStreamResponse(events());
}
