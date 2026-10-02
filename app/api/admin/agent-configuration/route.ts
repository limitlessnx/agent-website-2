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

function knowledgeText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  return Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== null && item !== undefined && String(item).trim())
    .map(([key, item]) => `${key.replaceAll("_", " ")}: ${Array.isArray(item) ? item.join(", ") : String(item)}`)
    .join("\n");
}

function buildSuggestedPrompt(agent: { name: string; agent_type: string | null }, profile: any) {
  const businessName = text(profile?.business_name) || "this organization";
  const role = agent.name || agent.agent_type || "AI agent";
  const knowledge = knowledgeText(profile?.business_knowledge);
  const lines = [
    `You are the ${role} for ${businessName}.`,
    text(profile?.business_description) ? `Business: ${text(profile.business_description)}` : "",
    text(profile?.ai_requirements) ? `What this AI should handle: ${text(profile.ai_requirements)}` : "",
    knowledge ? `Approved business knowledge:\n${knowledge}` : "",
    Array.isArray(profile?.business_goals) && profile.business_goals.length ? `Requested outcomes: ${profile.business_goals.join(", ")}` : "",
    `Primary channel: WhatsApp.`,
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

async function assignedAgentIds(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin.from("organization_agent_selections").select("configuration,status").eq("organization_id", organizationId);
  if (error) throw error;
  return (data || [])
    .filter((row) => ["selected", "provisioning", "paid", "active"].includes(text(row.status)))
    .map((row) => text((row.configuration as Record<string, unknown> | null)?.provisioned_agent_id))
    .filter(Boolean);
}

async function ensureAssignedAgent(admin: ReturnType<typeof createAdminClient>, organizationId: string, agentId: string) {
  const ids = await assignedAgentIds(admin, organizationId);
  if (!ids.includes(agentId)) throw new Error("Only marketplace agents assigned to this tenant can be configured.");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = text(request.nextUrl.searchParams.get("organizationId"));
    if (!organizationId) return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    const admin = createAdminClient();
    await ensureOrg(admin, organizationId);
    const ids = await assignedAgentIds(admin, organizationId);

    const [agentsResult, profileResult, legacyResult, workflowsResult, assignmentsResult, routesResult] = await Promise.all([
      ids.length ? admin.from("agents").select("id,name,agent_type,status,system_prompt,communication_channels,configuration").eq("organization_id", organizationId).in("id", ids).order("created_at") : Promise.resolve({ data: [], error: null }),
      admin.from("client_onboarding_profiles").select("business_name,business_description,ai_requirements,business_knowledge,business_goals,whatsapp_preferences").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("client_onboarding_submissions").select("business_information,business_services,communication_details,automation_requirements,business_resources").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("workflow_definitions").select("id,workflow_key,name,description,provider,agent_type,channel,role,status").eq("status", "ready").order("name"),
      admin.from("agent_workflow_assignments").select("id,agent_id,workflow_definition_id,role,status").eq("organization_id", organizationId),
      admin.from("agent_orchestration_routes").select("id,source_agent_id,source_workflow_definition_id,target_type,target_agent_id,target_workflow_definition_id,target_channel,trigger_event,status,configuration").eq("organization_id", organizationId).order("created_at"),
    ]);
    for (const result of [agentsResult, profileResult, legacyResult, workflowsResult, assignmentsResult, routesResult]) if (result.error) throw result.error;
    const profile = profileResult.data || legacyResult.data;
    const agents = (agentsResult.data || []).map((agent) => ({ ...agent, suggested_prompt: buildSuggestedPrompt(agent, profile) }));
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
    await ensureAssignedAgent(admin, organizationId, agentId);

    const { data: currentAgent, error: currentAgentError } = await admin
      .from("agents")
      .select("configuration")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (currentAgentError) throw currentAgentError;
    if (!currentAgent) throw new Error("Assigned agent not found.");

    const { error: updateError } = await admin.from("agents").update({
      system_prompt: text(body.systemPrompt),
      communication_channels: channels,
      configuration: {
        ...((currentAgent.configuration as Record<string, unknown> | null) || {}),
        configuration_source: "super_admin",
        brief_prompt_generated: false,
        manually_configured_at: new Date().toISOString(),
      },
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
      const { error } = await admin.from("organization_integrations").upsert({ organization_id: organizationId, provider, display_name: provider === "elevenlabs" ? "ElevenLabs" : provider.charAt(0).toUpperCase() + provider.slice(1), status: "disconnected", configuration: { required_by_agent_configuration: true }, health: { state: "not_checked" } }, { onConflict: "organization_id,provider", ignoreDuplicates: true });
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
    await ensureAssignedAgent(admin, organizationId, sourceAgentId);
    const targetChannel = text(body.targetChannel);
    if (targetType === "channel" && !ALLOWED_CHANNELS.has(targetChannel)) throw new Error("Unsupported target channel.");
    if (targetType === "agent") await ensureAssignedAgent(admin, organizationId, text(body.targetAgentId));
    const { data, error } = await admin.from("agent_orchestration_routes").insert({ organization_id: organizationId, source_agent_id: sourceAgentId, source_workflow_definition_id: text(body.sourceWorkflowDefinitionId) || null, target_type: targetType, target_agent_id: targetType === "agent" ? text(body.targetAgentId) || null : null, target_workflow_definition_id: targetType === "workflow" ? text(body.targetWorkflowDefinitionId) || null : null, target_channel: targetType === "channel" ? targetChannel : null, trigger_event: text(body.triggerEvent) || "success", status: "active", configuration: { source: "super_admin" } }).select("*").single();
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
