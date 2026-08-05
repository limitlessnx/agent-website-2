import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { executeLeoAction, type LeoAction } from "@/lib/leo-control-plane";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision || "approve");
  if (!["approve", "reject"].includes(decision)) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

  const actions = await supabaseServerRequest<LeoAction[]>(`support_actions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => []);
  const action = actions[0];
  if (!action) return NextResponse.json({ error: "Support action not found." }, { status: 404 });
  if (action.status !== "proposed") return NextResponse.json({ error: `Action is already ${action.status}.` }, { status: 409 });

  if (decision === "reject") {
    const rows = await supabaseServerRequest<LeoAction[]>(`support_actions?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "rejected", approved_by: session.email, approved_at: new Date().toISOString() }),
    });
    await supabaseServerRequest("support_action_events", {
      method: "POST",
      body: JSON.stringify({ action_id: action.id, organization_id: action.organization_id || null, event_type: "rejected", actor: session.email }),
    });
    const message = `Permission rejected for: ${action.title}. No change was made.`;
    await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: action.conversation_id, role: "assistant", content: message }) });
    return NextResponse.json({ ok: true, action: rows[0] || { ...action, status: "rejected" }, message });
  }

  const approvedRows = await supabaseServerRequest<LeoAction[]>(`support_actions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "approved", approved_by: session.email, approved_at: new Date().toISOString() }),
  });
  const approved = approvedRows[0] || { ...action, status: "approved" };
  await supabaseServerRequest("support_action_events", {
    method: "POST",
    body: JSON.stringify({ action_id: action.id, organization_id: action.organization_id || null, event_type: "approved", actor: session.email }),
  });

  try {
    const execution = await executeLeoAction(approved, session.email);
    const message = `Approved and completed: ${action.title}. Leo verified the resulting state.`;
    await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: action.conversation_id, role: "assistant", content: message, diagnostics: execution }) });
    return NextResponse.json({ ok: true, action: approved, execution, message });
  } catch (error) {
    const message = `Approved action failed: ${action.title}. ${error instanceof Error ? error.message : "Unknown execution error."}`;
    await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: action.conversation_id, role: "assistant", content: message }) });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
