import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const agentId = String(body.agentId || "").trim();
    const decision = String(body.decision || "").trim();
    if (!organizationId || !agentId || !["approved", "changes_requested"].includes(decision)) {
      return NextResponse.json({ error: "Organization, agent and a valid approval decision are required." }, { status: 400 });
    }
    const admin = createAdminClient();
    const { data: requestRow, error: requestError } = await admin.from("agent_approval_requests")
      .select("id,status,readiness_snapshot").eq("organization_id", organizationId).eq("agent_id", agentId)
      .in("status", ["submitted", "changes_requested"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (requestError) throw requestError;
    if (!requestRow) return NextResponse.json({ error: "No pending approval request exists for this agent." }, { status: 409 });

    const { data: updated, error: updateError } = await admin.from("agent_approval_requests").update({
      status: decision,
      reviewed_by: session.userId,
      reviewer_notes: String(body.notes || "").trim() || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", requestRow.id).eq("organization_id", organizationId).select("id,status,reviewed_at").single();
    if (updateError) throw updateError;

    await admin.from("agents").update({ status: decision === "approved" ? "published" : "testing", updated_at: new Date().toISOString() })
      .eq("id", agentId).eq("organization_id", organizationId);
    await admin.rpc("refresh_agent_runtime_readiness", { p_organization_id: organizationId, p_agent_id: agentId });
    return NextResponse.json({ ok: true, approval: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to decide approval." }, { status: 400 });
  }
}
