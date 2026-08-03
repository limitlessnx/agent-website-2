import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import type { SupportAction } from "@/lib/support-agent";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const decision = String(body.decision || "approve");
  if (!["approve", "reject"].includes(decision)) return NextResponse.json({ error: "Invalid decision." }, { status: 400 });

  const actions = await supabaseServerRequest<SupportAction[]>(
    `support_actions?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(session.organizationId)}&select=*&limit=1`,
  ).catch(() => []);
  const action = actions[0];
  if (!action) return NextResponse.json({ error: "Support action not found in this tenant workspace." }, { status: 404 });
  if (action.status !== "proposed") return NextResponse.json({ error: `Action is already ${action.status}.` }, { status: 409 });

  const status = decision === "approve" ? "approved" : "rejected";
  const rows = await supabaseServerRequest<SupportAction[]>(
    `support_actions?id=eq.${encodeURIComponent(id)}&organization_id=eq.${encodeURIComponent(session.organizationId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, approved_by: session.email, approved_at: new Date().toISOString() }),
    },
  );

  const message = decision === "approve"
    ? `Request recorded for: ${action.title}. A platform admin must review before any production change is made.`
    : `Request rejected for: ${action.title}. No change was made.`;

  await supabaseServerRequest("support_messages", {
    method: "POST",
    body: JSON.stringify({ conversation_id: action.conversation_id, role: "assistant", content: message }),
  });

  return NextResponse.json({ ok: true, action: rows[0] || { ...action, status }, message });
}
