import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const requestedStatus = text(body.status);
    const status = ["succeeded", "failed", "blocked", "cancelled"].includes(requestedStatus)
      ? requestedStatus
      : "succeeded";
    const output = record(body.output);

    if (!organizationId || !agentId || !executionId) {
      return NextResponse.json({ error: "Missing execution completion fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,started_at,created_at")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionError || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const startMs = new Date(execution.started_at || execution.created_at).getTime();
    const latencyMs = Number.isFinite(startMs) ? Math.max(0, Date.now() - startMs) : null;
    const errorMessage = status === "failed" || status === "blocked" ? text(body.error_message) || null : null;
    const errorCode = status === "failed" || status === "blocked" ? text(body.error_code) || null : null;

    const { data: completed, error: completeError } = await supabase
      .from("runtime_executions")
      .update({
        status,
        output,
        error_code: errorCode,
        error_message: errorMessage,
        latency_ms: latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .select("id,status,latency_ms,completed_at")
      .single();
    if (completeError) throw completeError;

    await Promise.all([
      supabase.from("usage_ledger").insert({
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        usage_type: "workflow_execution",
        quantity: 1,
        unit_cost_minor: 0,
        metadata: { status, workflow_key: "ai_sales_qualification_v2" },
      }),
      supabase.from("runtime_progress_events").insert({
        organization_id: organizationId,
        execution_id: executionId,
        event_type: `execution.${status}`,
        message: `Runtime execution ${status}.`,
        payload: { latency_ms: latencyMs, error_code: errorCode },
      }),
      supabase
        .from("command_queue")
        .update({ status: status === "succeeded" ? "succeeded" : "failed", completed_at: new Date().toISOString(), last_error: errorMessage })
        .eq("organization_id", organizationId)
        .eq("execution_id", executionId)
        .in("status", ["queued", "claimed", "running"]),
    ]);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      ...completed,
      output,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to complete runtime execution.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
