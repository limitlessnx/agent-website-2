import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_CHANNELS = new Set(["whatsapp", "web", "telegram", "email", "voice", "sms"]);

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function buildSuggestedPrompt(agent: { name: string; agent_type: string | null }, submission: any) {
  const info = submission?.business_information || {};
  const services = submission?.business_services || {};
  const comms = submission?.communication_details || {};
  const automation = submission?.automation_requirements || {};
  const resources = submission?.business_resources || {};
  const businessName = text(info.businessName) || "this organization";
  const role = agent.name || agent.agent_type || "AI agent";
  const lines = [
    `You are the ${role} for ${businessName}.`,
    text(info.businessDescription) ? `Business: ${text(info.businessDescription)}` : "",
    text(services.productsServices) ? `Products/services: ${text(services.productsServices)}` : "",
    text(services.targetCustomers) ? `Target customers: ${text(services.targetCustomers)}` : "",
    text(services.productDetails) ? `Commercial details: ${text(services.productDetails)}` : "",
    text(comms.businessHours) ? `Business hours: ${text(comms.businessHours)}` : "",
    text(automation.goals) ? `Primary goals: ${text(automation.goals)}` : "",
    text(automation.tasks) ? `Primary tasks: ${text(automation.tasks)}` : "",
    text(automation.handoffRules) ? `Human handoff rules: ${text(automation.handoffRules)}` : "",
    text(automation.systemMessage) ? `Tone and behaviour requested by the client: ${text(automation.systemMessage)}` : "",
    text(resources.businessDetails) ? `Additional approved business rules: ${text(resources.businessDetails)}` : "",
    "Use only approved tenant knowledge and connected tenant tools. Do not invent prices, policies, availability or facts. Ask for missing information when needed.",
    "Keep this tenant's data isolated from every other organization. Escalate to the configured human contact whenever a request requires approval, pricing discretion, an exception, or information you cannot verify.",
  ];
  return lines.filter(Boolean).join("\n\n");
}

async function ensureOrg(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin.from("organizations").select("id,name").eq("id", organizationId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Organization not found.");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = text(request.nextUrl.searchParams.get("organizationId"));
    if (!organizationId) return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    const admin = createAdminClient();
    await ensureOrg(admin, organizationId);

    const [agentsResult, submissionResult, workflowsResult, assignmentsResult, routesResult] = await Promise.all([
      admin.from("agents").select("id,name,agent_type,status,system_prompt,communication_channels").eq("organization_id", organizationId).order("created_at"),
      admin.from("client_onboarding_submissions").select("business_information,business_services,communication_details,automation_requirements,business_resources").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("workflow_definitions").select("id,workflow_key,name,description,provider,agent_type,channel,role,status").eq("status", "ready").order("name"),
      admin.from("agent_workflow_assignments").select("id,agent_id,workflow_definition_id,role,status").eq("organization_id", organizationId),
      admin.from("agent_orchestration_routes").select("id,source_agent_id,source_workflow_definition_id,target_type,target_agent_id,target_workflow_definition_id,target_channel,trigger_event,status,configuration").eq("organization_id", organizationId).order("created_at"),
    ]);
    for (const result of [agentsResult, submissionResult, workflowsResult, assignmentsResult, routesResult]) if (result.error) throw result.error;
    const agents = (agentsResult.data || []).map((agent) => ({ ...agent, suggested_prompt: buildSuggestedPrompt(agent, submissionResult.data) }));
    return NextResponse.json({ agents, workflows: workflowsResult.data || [], assignments: assignmentsResult.data || [], routes: routesResult.data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load agent configuration.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = text(body.organizationId);
    const agentId = text(body.agentId);
    if (!organizationId || !agentId) return NextResponse.json({ error: "Organization and agent are required." }, { status: 400 });
    const channels = Array.isArray(body.communicationChannels) ? [...new Set(body.communicationChannels.map(String).filter((v) => ALLOWED_CHANNELS.has(v)))] : [];
    const workflowIds = Array.isArray(body.workflowDefinitionIds) ? [...new Set(body.workflowDefinitionIds.map(String).filter(Boolean))] : [];
    const admin = createAdminClient();
    await ensureOrg(admin, organizationId);

    const { data: agent, error: agentError } = await admin.from("agents").select("id").eq("id", agentId).eq("organization_id", organizationId).maybeSingle();
    if (agentError) throw agentError;
    if (!agent) throw new Error("Agent not found for this organization.");

    const { error: updateError } = await admin.from("agents").update({
      system_prompt: text(body.systemPrompt),
      communication_channels: channels,
      updated_at: new Date().toISOString(),
    }).eq("id", agentId).eq("organization_id", organizationId);
    if (updateError) throw updateError;

    const { data: existingAssignments, error: assignmentReadError } = await admin.from("agent_workflow_assignments").select("id,workflow_definition_id").eq("organization_id", organizationId).eq("agent_id", agentId);
    if (assignmentReadError) throw assignmentReadError;
    const removeIds = (existingAssignments || []).filter((a) => !workflowIds.includes(a.workflow_definition_id)).map((a) => a.id);
    if (removeIds.length) {
      const { error } = await admin.from("agent_workflow_assignments").delete().in("id", removeIds);
      if (error) throw error;
    }
    const existingIds = new Set((existingAssignments || []).map((a) => a.workflow_definition_id));
    const addIds = workflowIds.filter((id) => !existingIds.has(id));
    if (addIds.length) {
      const rows = addIds.map((workflowDefinitionId) => ({ organization_id: organizationId, agent_id: agentId, workflow_definition_id: workflowDefinitionId, role: "linked", status: "assigned", configuration: { source: "super_admin" }, readiness: { state: "assigned" }, assigned_at: new Date().toISOString() }));
      const { error } = await admin.from("agent_workflow_assignments").insert(rows);
      if (error) throw error;
    }

    const providerMap: Record<string, string> = { whatsapp: "whatsapp", telegram: "telegram", email: "email", voice: "elevenlabs", sms: "sms" };
    for (const channel of channels) {
      const provider = providerMap[channel];
      if (!provider) continue;
      const { error } = await admin.from("organization_integrations").upsert({
        organization_id: organizationId,
        provider,
        display_name: provider === "elevenlabs" ? "ElevenLabs" : provider.charAt(0).toUpperCase() + provider.slice(1),
        status: "disconnected",
        configuration: { required_by_agent_configuration: true },
        health: { state: "not_checked" },
      }, { onConflict: "organization_id,provider", ignoreDuplicates: true });
      if (error) throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save agent configuration.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = text(body.organizationId);
    const sourceAgentId = text(body.sourceAgentId);
    const targetType = text(body.targetType);
    if (!organizationId || !sourceAgentId || !["agent", "workflow", "channel"].includes(targetType)) return NextResponse.json({ error: "A valid route source and target are required." }, { status: 400 });
    const admin = createAdminClient();
    await ensureOrg(admin, organizationId);
    const targetChannel = text(body.targetChannel);
    if (targetType === "channel" && !ALLOWED_CHANNELS.has(targetChannel)) throw new Error("Unsupported target channel.");
    const { data, error } = await admin.from("agent_orchestration_routes").insert({
      organization_id: organizationId,
      source_agent_id: sourceAgentId,
      source_workflow_definition_id: text(body.sourceWorkflowDefinitionId) || null,
      target_type: targetType,
      target_agent_id: targetType === "agent" ? text(body.targetAgentId) || null : null,
      target_workflow_definition_id: targetType === "workflow" ? text(body.targetWorkflowDefinitionId) || null : null,
      target_channel: targetType === "channel" ? targetChannel : null,
      trigger_event: text(body.triggerEvent) || "success",
      status: "active",
      configuration: { source: "super_admin" },
    }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, route: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create orchestration route.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = text(request.nextUrl.searchParams.get("organizationId"));
    const routeId = text(request.nextUrl.searchParams.get("routeId"));
    if (!organizationId || !routeId) return NextResponse.json({ error: "Organization and route are required." }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin.from("agent_orchestration_routes").delete().eq("id", routeId).eq("organization_id", organizationId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove orchestration route.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}
