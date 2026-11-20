import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id), agentId = text(body.agent_id), executionId = text(body.execution_id);
    const status = text(body.status) || "succeeded";
    if (![organizationId, agentId, executionId].every(id => uuid.test(id)) || !["succeeded", "failed", "blocked", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Valid execution identity and completion status are required." }, { status: 400 });
    }
    if (body.output !== undefined && (!body.output || typeof body.output !== "object" || Array.isArray(body.output))) {
      return NextResponse.json({ error: "Execution output must be an object." }, { status: 400 });
    }
    const failed = status === "failed" || status === "blocked";
    const { data, error } = await createAdminClient().rpc("complete_runtime_execution", {
      p_organization_id: organizationId, p_agent_id: agentId, p_execution_id: executionId, p_status: status,
      p_output: record(body.output), p_error_code: failed ? text(body.error_code) || null : null,
      p_error_message: failed ? text(body.error_message) || null : null,
    });
    if (error) {
      const known = ["completion_scope_mismatch", "completion_input_invalid", "completion_input_conflict", "completion_evidence_unavailable", "legacy_completion_requires_review"];
      const code = known.includes(error.message) ? error.message : "completion_persistence_unavailable";
      return NextResponse.json({ ok: false, error: code, needs_attention: true, do_not_redispatch: true }, { status: code === "completion_scope_mismatch" ? 404 : 409 });
    }
    if (!data || typeof data !== "object" || Array.isArray(data) || data.ok !== true) {
      return NextResponse.json({ ok: false, error: "completion_evidence_unavailable", needs_attention: true, do_not_redispatch: true }, { status: 409 });
    }
    return NextResponse.json(data);
  } catch (error) {
    const unauthorized = error instanceof Error && error.message === "Unauthorized.";
    return NextResponse.json({ ok: false, error: unauthorized ? "Unauthorized." : "completion_persistence_unavailable", needs_attention: !unauthorized, do_not_redispatch: true }, { status: unauthorized ? 401 : 409 });
  }
}
