import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertLeoToolAllowed, leoApprovalFor, resolveLeoIdentity, type LeoChannel } from "@/lib/leo-core";
import { createLeoExecutionEnvelope } from "@/lib/leo-execution-envelope";
import { executeLeoEnvelopeViaN8n } from "@/lib/leo-n8n-executor";
import { auditLeoEvent, getOrCreateLeoSession, updateLeoPublicLeadState } from "@/lib/leo-session-store";
import { capturePublicLeoLead } from "@/lib/leo-lead-capture";
import { createAdminClient } from "@/lib/supabase/admin";

function channel(value: unknown): LeoChannel { return value === "voice" ? "voice" : value === "api" ? "api" : "chat"; }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

async function globalSystemSnapshot() {
  const supabase = createAdminClient();
  const [organizations, agents, integrations, workflows, runs] = await Promise.all([
    supabase.from("organizations").select("id,name,slug,status").order("name").limit(100),
    supabase.from("agents").select("id,organization_id,name,status,agent_type,updated_at").order("updated_at", { ascending: false }).limit(150),
    supabase.from("organization_integrations").select("id,organization_id,provider,display_name,status,last_checked_at").order("provider").limit(150),
    supabase.from("workflow_registry").select("id,organization_uuid,name,workflow_key,status,provider,last_run_at,last_error_at").order("last_error_at", { ascending: false, nullsFirst: false }).limit(150),
    supabase.from("workflow_runs").select("id,organization_uuid,workflow_key,status,error_message,created_at").order("created_at", { ascending: false }).limit(75),
  ]);
  for (const item of [organizations, agents, integrations, workflows, runs]) if (item.error) throw item.error;
  const orgs = organizations.data || [], agentRows = agents.data || [], integrationRows = integrations.data || [], workflowRows = workflows.data || [], runRows = runs.data || [];
  const failedRuns = runRows.filter((row) => ["failed", "timed_out", "error"].includes(String(row.status || "").toLowerCase()));
  const unhealthyIntegrations = integrationRows.filter((row) => !["connected", "active", "healthy", "ok"].includes(String(row.status || "").toLowerCase()));
  const inactiveAgents = agentRows.filter((row) => !["active", "running", "online"].includes(String(row.status || "").toLowerCase()));
  const unhealthyWorkflows = workflowRows.filter((row) => ["failed", "error", "disabled", "inactive"].includes(String(row.status || "").toLowerCase()) || row.last_error_at);
  return { scope: "global", summary: { organizations: orgs.length, agents: agentRows.length, inactive_agents: inactiveAgents.length, integrations: integrationRows.length, unhealthy_integrations: unhealthyIntegrations.length, workflows: workflowRows.length, unhealthy_workflows: unhealthyWorkflows.length, recent_runs: runRows.length, failed_recent_runs: failedRuns.length, overall_status: failedRuns.length || unhealthyWorkflows.length || unhealthyIntegrations.length ? "attention_required" : "healthy" }, organizations: orgs, agents: agentRows, integrations: integrationRows, workflows: workflowRows, recentRuns: runRows };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const identity = await resolveLeoIdentity({ channel: channel(body.channel), allowPublic: true });
    if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });
    const toolKey = String(body.toolKey || body.tool_key || "").trim();
    if (!toolKey) return NextResponse.json({ error: "toolKey is required." }, { status: 400 });
    const tool = assertLeoToolAllowed(identity, toolKey);
    const approval = leoApprovalFor(identity, tool.key);
    const confirmed = body.confirmed === true;
    if (approval === "confirm" && !confirmed) return NextResponse.json({ ok: true, status: "confirmation_required", toolKey: tool.key, title: tool.title, message: `Confirm ${tool.title.toLowerCase()} before Leo executes it.` });
    const args = object(body.arguments);

    if (tool.key === "leo.public.lead.capture") {
      const sessionId = String(body.sessionId || body.session_id || "").trim();
      const session = identity.scope === "public" && sessionId ? await getOrCreateLeoSession({ identity, sessionId }) : null;
      if (session?.leadCaptured) {
        await auditLeoEvent({ identity, session, eventType: "tool_execution_skipped", toolKey: tool.key, details: { channel: identity.channel, status: "already_captured", lead_id: session.leadId } });
        return NextResponse.json({ ok: true, status: "already_captured", toolKey: tool.key, approval, channel: identity.channel, scope: identity.scope, leadCaptured: true, leadId: session.leadId || null }, { status: 200 });
      }
      const result = await capturePublicLeoLead(args);
      let updatedSession = session;
      if (identity.scope === "public" && sessionId && result.ok && session) {
        updatedSession = await updateLeoPublicLeadState({ identity, session, leadProfile: {
          name: String(args.name || ""), email: String(args.email || "").toLowerCase(), phone: String(args.phone || ""), organization: String(args.organization || args.business_name || ""),
          business_type: String(args.business_type || ""), main_goal: String(args.main_goal || ""), current_tools: String(args.current_tools || ""), lead_volume: String(args.lead_volume || ""), timeline: String(args.timeline || ""), budget: String(args.budget || ""), preferred_contact_time: String(args.preferred_contact_time || ""),
        }, captured: true, leadId: result.leadId });
      }
      await auditLeoEvent({ identity, session: updatedSession || undefined, eventType: result.ok ? "tool_execution_completed" : "tool_execution_failed", toolKey: tool.key, details: { channel: identity.channel, status: result.status, lead_id: result.ok ? result.leadId : undefined } });
      return NextResponse.json({ ...result, toolKey: tool.key, approval, channel: identity.channel, scope: identity.scope, leadCaptured: Boolean(updatedSession?.leadCaptured) || result.ok, leadId: updatedSession?.leadId || (result.ok ? result.leadId : null) }, { status: result.ok ? 200 : 400 });
    }

    if (tool.key === "leo.tenant.inspect" && identity.scope === "super_admin" && !String(args.organization_id || "").trim()) {
      const snapshot = await globalSystemSnapshot();
      await auditLeoEvent({ identity, eventType: "tool_execution_completed", toolKey: tool.key, details: { channel: identity.channel, scope: identity.scope, global: true } });
      return NextResponse.json({ ok: true, result: snapshot, approval, channel: identity.channel, scope: identity.scope }, { status: 200 });
    }

    const requestId = String(body.requestId || body.request_id || randomUUID()).trim();
    const sessionId = String(body.sessionId || body.session_id || "").trim() || null;
    const envelope = createLeoExecutionEnvelope({ requestId, sessionId, identity, toolKey: tool.key, arguments: args, approvalGranted: approval === "none" || confirmed });
    await auditLeoEvent({ identity, eventType: "tool_execution_dispatched", toolKey: tool.key, details: { request_id: requestId, channel: identity.channel, approval } });
    const result = await executeLeoEnvelopeViaN8n(envelope);
    return NextResponse.json({ ...result, approval, channel: identity.channel, scope: identity.scope }, { status: result.ok ? 200 : 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leo could not execute this action.";
    return NextResponse.json({ error: message }, { status: /not permitted|Cross-tenant|Unauthorized/i.test(message) ? 403 : 500 });
  }
}
