import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.RUNTIME_GATEWAY_SECRET || "";
  const supplied = request.headers.get("x-runtime-secret") || "";
  if (!expected || !secureEqual(expected, supplied)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const organizationId = String(body.organization_id || "");
  const agentId = String(body.agent_id || "");
  const conversationId = body.conversation_id ? String(body.conversation_id) : null;
  const idempotencyKey = String(body.idempotency_key || "");
  if (!organizationId || !agentId || !idempotencyKey) return NextResponse.json({ error: "organization_id, agent_id and idempotency_key are required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("enqueue_agent_execution", {
    p_organization_id: organizationId,
    p_agent_id: agentId,
    p_conversation_id: conversationId,
    p_input: typeof body.input === "object" && body.input ? body.input : {},
    p_idempotency_key: idempotencyKey,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ execution_id: data, status: "queued", execution_enabled: false }, { status: 202 });
}
