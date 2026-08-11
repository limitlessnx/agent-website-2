import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = await request.json().catch(() => ({}));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);

    if (!organizationId || !agentId || !executionId) {
      return NextResponse.json({ error: "organization_id, agent_id and execution_id are required." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const snapshot = await supabase
      .from("runtime_context_snapshots")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .eq("execution_id", executionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot.error) throw snapshot.error;
    if (!snapshot.data) return NextResponse.json({ error: "Runtime snapshot not found." }, { status: 404 });
    return NextResponse.json({ ok: true, snapshot: snapshot.data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load runtime snapshot." }, { status: 500 });
  }
}
