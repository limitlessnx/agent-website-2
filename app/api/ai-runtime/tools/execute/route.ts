import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK } from "@/lib/ai-runtime/sdk";
import { createRuntimeToolRegistry } from "@/lib/ai-runtime/tool-registry";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function assertTenantAgent(organizationId: string, agentId: string) {
  const rows = await supabaseServerRequest<Array<{ id: string }>>(`agents?select=id&id=eq.${encodeURIComponent(agentId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`).catch(() => []);
  if (!rows[0]) throw new Error("Agent does not belong to the authenticated organization.");
}

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api" });
  if (!identity) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = record(await request.json().catch(() => ({})));
    const executionId = text(body.executionId || body.execution_id);
    const agentId = text(body.agentId || body.agent_id);
    const sessionId = text(body.sessionId || body.session_id) || undefined;
    const toolKey = text(body.toolKey || body.tool_key);
    const args = record(body.arguments);
    const approvalRequestId = text(body.approvalRequestId || body.approval_request_id) || undefined;
    const requestedOrganizationId = text(body.organizationId || body.organization_id);

    if (!executionId || !toolKey) return NextResponse.json({ error: "executionId and toolKey are required." }, { status: 400 });

    let organizationId: string | undefined;
    if (identity.scope === "tenant") {
      organizationId = identity.organizationId;
      if (!organizationId) throw new Error("Authenticated tenant identity has no organization.");
      if (requestedOrganizationId && requestedOrganizationId !== organizationId) throw new Error("Cross-organization tool execution is forbidden.");
      if (agentId) await assertTenantAgent(organizationId, agentId);
    } else if (identity.scope === "super_admin") {
      organizationId = requestedOrganizationId || undefined;
      if (organizationId && agentId) await assertTenantAgent(organizationId, agentId);
    } else {
      return NextResponse.json({ error: "This identity cannot execute production runtime tools." }, { status: 403 });
    }

    const sdk = new AgentRuntimeSDK(createRuntimeToolRegistry());
    const result = await sdk.executeTool({
      identity,
      executionId,
      organizationId,
      agentId: agentId || undefined,
      sessionId,
      toolKey,
      arguments: args,
      approvalRequestId,
      superAdminConfirmed: identity.scope === "super_admin" && body.confirmed === true,
    });

    const status = result.status === "succeeded" ? 200 : result.status === "approval_required" ? 409 : result.status === "rejected" ? 403 : 500;
    return NextResponse.json({ ok: result.status === "succeeded", executionId, ...result }, { status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Production runtime execution failed.";
    const status = /forbidden|does not belong|cannot execute|not permitted/i.test(message) ? 403 : 409;
    return NextResponse.json({ error: message }, { status });
  }
}
