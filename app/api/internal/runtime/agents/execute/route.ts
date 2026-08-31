import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PHASE12_AGENT_KINDS,
  runPhase12Agent,
  type Phase12AgentKind,
} from "@/lib/ai-runtime/migration";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const objective = text(body.objective) || text(record(body.input).message) || text(record(body.input).text);
    const requestedKind = text(body.agent_kind) as Phase12AgentKind;
    const kind = PHASE12_AGENT_KINDS.includes(requestedKind) ? requestedKind : "specialist";

    if (!organizationId || !agentId || !executionId || !objective) {
      return NextResponse.json({ error: "organization_id, agent_id, execution_id and objective are required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,conversation_id,status")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (error || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found inside the exact organization and agent boundary." }, { status: 404 });
    }

    const result = await runPhase12Agent({
      kind,
      organizationId,
      agentId,
      channel: "api",
      externalConversationId: text(body.external_conversation_id) || text(execution.conversation_id) || undefined,
      sessionId: text(body.session_id) || undefined,
      objective,
      metadata: {
        legacyExecutionId: executionId,
        source: "phase12-internal-agent-entry",
        input: record(body.input),
      },
    });

    await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: executionId,
      event_type: "phase12.runtime.completed",
      message: "Shared AgentRuntimeSDK completed reasoning.",
      payload: {
        runtime_execution_id: result.executionId,
        runtime_session_id: result.sessionId || null,
        agent_kind: kind,
        model: result.model,
        proposed_tools: result.toolCalls.map((tool) => ({
          tool_key: tool.toolKey,
          approval: tool.approval,
          approval_request_id: tool.approvalRequestId || null,
        })),
      },
    });

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      runtime_execution_id: result.executionId,
      runtime_session_id: result.sessionId || null,
      agent_kind: kind,
      reply: result.reply,
      intent: result.intent,
      confidence: result.confidence,
      needs_human_review: result.needsHumanReview,
      model: result.model,
      tool_calls: result.toolCalls,
      usage: result.usage,
      runtime_phase: 12,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute Phase 12 agent runtime.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
