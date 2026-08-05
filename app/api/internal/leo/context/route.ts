import { NextRequest, NextResponse } from "next/server";
import { collectSupportDiagnostics } from "@/lib/support-agent";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

function authorized(request: NextRequest) {
  const expected = process.env.LEO_GATEWAY_SECRET || process.env.RUNTIME_GATEWAY_SECRET;
  const provided = request.headers.get("x-leo-gateway-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(expected && provided && expected === provided);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const organizationId = String(body.organization_id || "").trim() || undefined;
  const conversationId = String(body.conversation_id || "").trim();
  const diagnostics = await collectSupportDiagnostics("admin", organizationId);
  const history = conversationId
    ? await supabaseServerRequest<any[]>(`support_messages?conversation_id=eq.${encodeURIComponent(conversationId)}&select=role,content,created_at&order=created_at.asc&limit=40`).catch(() => [])
    : [];
  return NextResponse.json({
    ok: true,
    organization_id: organizationId || null,
    conversation_id: conversationId || null,
    diagnostics,
    history,
    available_actions: [
      { key: "inspect_tenant", risk: "low", approval_required: false },
      { key: "inspect_agent", risk: "low", approval_required: false },
      { key: "inspect_workflow", risk: "low", approval_required: false },
      { key: "inspect_workflow_failures", risk: "low", approval_required: false },
      { key: "verify_tenant_integrations", risk: "low", approval_required: false },
      { key: "pause_tenant", risk: "high", approval_required: true },
      { key: "resume_tenant", risk: "high", approval_required: true },
      { key: "pause_agent", risk: "medium", approval_required: true },
      { key: "resume_agent", risk: "medium", approval_required: true },
      { key: "activate_workflow", risk: "high", approval_required: true },
      { key: "deactivate_workflow", risk: "high", approval_required: true },
      { key: "retry_failed_execution", risk: "medium", approval_required: true },
      { key: "resync_workflow_registry", risk: "medium", approval_required: true }
    ]
  });
}
