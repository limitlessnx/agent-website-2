import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
}

async function ensureAssigned(admin: ReturnType<typeof createAdminClient>, organizationId: string, agentId: string) {
  const { data: agent } = await admin.from("agents").select("id,name,agent_type,status").eq("id", agentId).eq("organization_id", organizationId).maybeSingle();
  if (!agent) throw new Error("Agent not found for this organization.");
  const { data: selections } = await admin.from("organization_agent_selections").select("configuration").eq("organization_id", organizationId);
  const assigned = (selections || []).some((row) => text((row.configuration as Record<string, unknown> | null)?.provisioned_agent_id) === agentId);
  if (!assigned) throw new Error("Only assigned marketplace agents can use the runtime.");
  return agent;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = text(request.nextUrl.searchParams.get("organizationId"));
    const agentId = text(request.nextUrl.searchParams.get("agentId"));
    if (!organizationId || !agentId) return NextResponse.json({ error: "Organization and agent are required." }, { status: 400 });
    const admin = createAdminClient();
    const agent = await ensureAssigned(admin, organizationId, agentId);
    const [{ data: profile }, { data: models }, { data: toolRuns }, { data: goals }] = await Promise.all([
      admin.from("agent_runtime_profiles").select("enabled,autonomy_mode,max_steps,model_strategy,memory_enabled,tool_policy,version,updated_at").eq("organization_id", organizationId).eq("agent_id", agentId).maybeSingle(),
      admin.from("organization_ai_model_assignments").select("model_id,ai_model_catalog!inner(id,provider,model_key,display_name,status)").eq("organization_id", organizationId).eq("ai_model_catalog.status", "active"),
      admin.from("agent_runtime_tool_runs").select("tool_name,status,approval_required,started_at").eq("organization_id", organizationId).eq("agent_id", agentId).order("started_at", { ascending: false }).limit(12),
      admin.from("agent_runtime_goals").select("id,title,status,priority,next_run_at,created_at").eq("organization_id", organizationId).eq("agent_id", agentId).order("created_at", { ascending: false }).limit(12),
    ]);
    return NextResponse.json({ agent, profile: profile || { enabled: true, autonomy_mode: "autonomous", max_steps: 8, model_strategy: "best_available", memory_enabled: true, tool_policy: {} }, models: models || [], toolRuns: toolRuns || [], goals: goals || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Maia runtime.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => ({}));
    const organizationId = text(body.organizationId);
    const agentId = text(body.agentId);
    if (!organizationId || !agentId) return NextResponse.json({ error: "Organization and agent are required." }, { status: 400 });
    const admin = createAdminClient();
    await ensureAssigned(admin, organizationId, agentId);
    const autonomyMode = ["supervised", "autonomous"].includes(text(body.autonomyMode)) ? text(body.autonomyMode) : "autonomous";
    const strategy = ["best_available", "fastest", "reasoning", "balanced"].includes(text(body.modelStrategy)) ? text(body.modelStrategy) : "best_available";
    const maxSteps = Math.max(1, Math.min(Number(body.maxSteps || 8), 20));
    const payload = {
      organization_id: organizationId,
      agent_id: agentId,
      enabled: body.enabled !== false,
      autonomy_mode: autonomyMode,
      max_steps: maxSteps,
      model_strategy: strategy,
      memory_enabled: body.memoryEnabled !== false,
      tool_policy: body.toolPolicy && typeof body.toolPolicy === "object" ? body.toolPolicy : {},
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await admin.from("agent_runtime_profiles").upsert(payload, { onConflict: "organization_id,agent_id" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save Maia runtime.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}
