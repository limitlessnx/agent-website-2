import { NextRequest, NextResponse } from "next/server";
import { executeLeoAction, isKnownLeoAction, requiresApproval, type LeoAction } from "@/lib/leo-control-plane";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

function authorized(request: NextRequest) {
  const expected = process.env.LEO_GATEWAY_SECRET || process.env.RUNTIME_GATEWAY_SECRET;
  const provided = request.headers.get("x-leo-gateway-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(expected && provided && expected === provided);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mode = String(body.mode || "propose");

  if (mode === "execute") {
    const actionId = String(body.action_id || "").trim();
    if (!actionId) return NextResponse.json({ error: "action_id is required." }, { status: 400 });
    const rows = await supabaseServerRequest<LeoAction[]>(`support_actions?id=eq.${encodeURIComponent(actionId)}&select=*&limit=1`).catch(() => []);
    const action = rows[0];
    if (!action) return NextResponse.json({ error: "Action not found." }, { status: 404 });
    try {
      const result = await executeLeoAction(action, String(body.actor || "leo-n8n"));
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Action failed." }, { status: 500 });
    }
  }

  const conversationId = String(body.conversation_id || "").trim();
  const actionKey = String(body.action_key || "").trim();
  const title = String(body.title || actionKey).trim();
  const description = String(body.description || "").trim();
  const organizationId = String(body.organization_id || "").trim() || null;
  const payload = typeof body.payload === "object" && body.payload ? body.payload : {};
  if (!conversationId || !actionKey) return NextResponse.json({ error: "conversation_id and action_key are required." }, { status: 400 });
  if (!isKnownLeoAction(actionKey)) return NextResponse.json({ error: `Unsupported action: ${actionKey}` }, { status: 400 });

  const risk = String(body.risk_level || (requiresApproval(actionKey) ? "medium" : "low"));
  const created = await supabaseServerRequest<LeoAction[]>("support_actions", {
    method: "POST",
    body: JSON.stringify({
      conversation_id: conversationId,
      organization_id: organizationId,
      action_key: actionKey,
      title,
      description,
      risk_level: risk,
      status: requiresApproval(actionKey) ? "proposed" : "approved",
      payload: { ...payload, organization_id: payload.organization_id || organizationId }
    }),
  });
  const action = created[0];
  if (!action) return NextResponse.json({ error: "Unable to create action." }, { status: 500 });

  await supabaseServerRequest("support_action_events", {
    method: "POST",
    body: JSON.stringify({
      action_id: action.id,
      organization_id: organizationId,
      event_type: requiresApproval(actionKey) ? "proposed" : "approved",
      actor: String(body.actor || "leo-n8n"),
      details: { source: "leo_internal_api" }
    }),
  });

  if (!requiresApproval(actionKey)) {
    const result = await executeLeoAction(action, String(body.actor || "leo-n8n"));
    return NextResponse.json({ ok: true, action, execution: result });
  }
  return NextResponse.json({ ok: true, action, approval_required: true });
}
