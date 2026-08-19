import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMaia } from "@/lib/ai/maia-runtime";

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

async function authorizedBridge(request: NextRequest) {
  const expected = process.env.MAIA_N8N_SHARED_SECRET?.trim();
  const supplied = request.headers.get("x-fluxknight-maia-secret")?.trim();
  return Boolean(expected && supplied && supplied === expected);
}

async function verifyAssignedAgent(organizationId: string, agentId: string) {
  const admin = createAdminClient();
  const { data: agent } = await admin.from("agents").select("id,name,slug,agent_type,status").eq("id", agentId).eq("organization_id", organizationId).maybeSingle();
  if (!agent) return null;
  const { data: selections } = await admin.from("organization_agent_selections").select("agent_key,status,configuration").eq("organization_id", organizationId);
  const assigned = (selections || []).some((selection) => text((selection.configuration as Record<string, unknown> | null)?.provisioned_agent_id) === agentId);
  return assigned ? agent : null;
}

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  const bridge = !session && await authorizedBridge(request);
  const adminSession = !session && !bridge ? await getAdminSession() : null;
  if (!session && !bridge && !adminSession) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = text(body.organizationId) || session?.organizationId || "";
    const agentId = text(body.agentId);
    const message = text(body.message).slice(0, 12000);
    if (!organizationId || !agentId || !message) return NextResponse.json({ error: "organizationId, agentId and message are required." }, { status: 400 });
    if (session && session.organizationId !== organizationId) return NextResponse.json({ error: "Tenant scope violation." }, { status: 403 });
    if (!bridge && adminSession && !session) {
      // Super Admin may test a tenant agent, but the target agent must still belong to that tenant.
    }

    const agent = await verifyAssignedAgent(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "Agent is not currently assigned to this organization." }, { status: 404 });

    const result = await runMaia({
      organizationId,
      agentId,
      message,
      sessionId: text(body.sessionId) || undefined,
      channel: text(body.channel) || "web",
      externalConversationId: text(body.externalConversationId) || undefined,
      autonomous: body.autonomous !== false,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Maia could not complete the request." }, { status: 500 });
  }
}
