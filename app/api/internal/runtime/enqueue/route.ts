import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecretFromHeaders } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecretFromHeaders(request.headers);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const organizationId = String(body.organization_id || "");
    const agentId = String(body.agent_id || "");
    const conversationId = body.conversation_id ? String(body.conversation_id) : null;
    const idempotencyKey = String(body.idempotency_key || "");
    if (!organizationId || !agentId || !idempotencyKey) return NextResponse.json({ error: "organization_id, agent_id and idempotency_key are required." }, { status: 400 });

    const { data, error } = await createAdminClient().rpc("enqueue_agent_execution", {
      p_organization_id: organizationId,
      p_agent_id: agentId,
      p_conversation_id: conversationId,
      p_input: typeof body.input === "object" && body.input ? body.input : {},
      p_idempotency_key: idempotencyKey,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ execution_id: data, status: "queued", execution_enabled: false }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to queue runtime execution.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
