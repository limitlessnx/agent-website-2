import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";
import { internalRuntimeIdentity } from "@/lib/ai-runtime/migration";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const legacyExecutionId = text(body.execution_id);
    const runtimeExecutionId = text(body.runtime_execution_id) || legacyExecutionId;
    const toolKey = text(body.tool_key);
    const approvalRequestId = text(body.approval_request_id) || undefined;
    const sessionId = text(body.session_id) || undefined;
    const args = record(body.arguments);

    if (!organizationId || !agentId || !legacyExecutionId || !runtimeExecutionId || !toolKey) {
      return NextResponse.json({ error: "organization_id, agent_id, execution_id, runtime_execution_id and tool_key are required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,status")
      .eq("id", legacyExecutionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (error || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found inside the exact organization and agent boundary." }, { status: 404 });
    }

    const sdk = new AgentRuntimeSDK();
    const result = await sdk.executeTool({
      identity: internalRuntimeIdentity(organizationId, "api"),
      executionId: runtimeExecutionId,
      organizationId,
      agentId,
      sessionId,
      toolKey,
      arguments: args,
      approvalRequestId,
    });

    await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: legacyExecutionId,
      event_type: `phase13.tool.${result.status}`,
      message: `Runtime tool ${toolKey} finished with ${result.status}.`,
      payload: {
        runtime_execution_id: runtimeExecutionId,
        tool_key: toolKey,
        status: result.status,
        approval_request_id: approvalRequestId || null,
      },
    });

    const status = result.status === "succeeded" ? 200 : result.status === "approval_required" ? 409 : result.status === "rejected" ? 403 : 502;
    return NextResponse.json({
      ok: result.status === "succeeded",
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: legacyExecutionId,
      runtime_execution_id: runtimeExecutionId,
      tool_key: toolKey,
      result,
      runtime_phase: 13,
    }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute production runtime tool.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
