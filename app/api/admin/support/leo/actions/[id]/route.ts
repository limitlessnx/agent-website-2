import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type Action = { id: string; conversation_id: string; action_key: string; title: string; description: string; risk_level: string; status: string };

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision || "approve");
  if (!['approve', 'reject'].includes(decision)) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

  const actions = await supabaseServerRequest<Action[]>(`support_actions?id=eq.${encodeURIComponent(id)}&select=*&limit=1`).catch(() => []);
  const action = actions[0];
  if (!action) return NextResponse.json({ error: "Support action not found." }, { status: 404 });
  if (action.status !== "proposed") return NextResponse.json({ error: `Action is already ${action.status}.` }, { status: 409 });

  const status = decision === "approve" ? "approved" : "rejected";
  const rows = await supabaseServerRequest<Action[]>(`support_actions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, approved_by: session.email, approved_at: new Date().toISOString() }),
  });

  const message = decision === "approve"
    ? `Permission granted for: ${action.title}. The action is approved and queued for the secure executor. No production change has been performed yet.`
    : `Permission rejected for: ${action.title}. No change was made.`;

  await supabaseServerRequest("support_messages", {
    method: "POST",
    body: JSON.stringify({ conversation_id: action.conversation_id, role: "assistant", content: message }),
  });

  return NextResponse.json({ ok: true, action: rows[0] || { ...action, status }, message });
}
