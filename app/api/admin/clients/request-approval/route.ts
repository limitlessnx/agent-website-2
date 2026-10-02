import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const agentId = String(body.agentId || "").trim();
    if (!organizationId || !agentId) return NextResponse.json({ error: "Organization and agent are required." }, { status: 400 });

    const admin = createAdminClient();
    const [{ data: agent, error: agentError }, { data: tests, error: testError }, { data: integrations, error: integrationError }] = await Promise.all([
      admin.from("agents").select("id,name,system_prompt,communication_channels,human_handoff_destination").eq("organization_id", organizationId).eq("id", agentId).maybeSingle(),
      admin.from("agent_test_runs").select("id,status,created_at").eq("organization_id", organizationId).eq("agent_id", agentId).eq("status", "passed").order("created_at", { ascending: false }).limit(1),
      admin.from("organization_integrations").select("provider,status").eq("organization_id", organizationId),
    ]);
    if (agentError) throw agentError;
    if (testError) throw testError;
    if (integrationError) throw integrationError;
    if (!agent) return NextResponse.json({ error: "Agent not found in this tenant." }, { status: 404 });

    const requiredChannels = Array.isArray(agent.communication_channels) ? agent.communication_channels.map(String) : [];
    const connected = new Set((integrations || []).filter((item) => ["connected", "active", "healthy"].includes(String(item.status))).map((item) => String(item.provider).toLowerCase()));
    const missingChannels = requiredChannels.filter((channel) => !connected.has(channel.toLowerCase()));
    const readiness = {
      prompt_ready: Boolean(agent.system_prompt?.trim()),
      handoff_ready: Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length),
      test_passed: Boolean(tests?.length),
      required_channels: requiredChannels,
      missing_channels: missingChannels,
    };
    if (!readiness.prompt_ready || !readiness.handoff_ready || !readiness.test_passed || missingChannels.length) {
      return NextResponse.json({ error: "Agent is not ready for approval.", readiness }, { status: 409 });
    }

    const { data: existing } = await admin.from("agent_approval_requests").select("id")
      .eq("organization_id", organizationId).eq("agent_id", agentId)
      .in("status", ["draft", "submitted", "changes_requested"]).maybeSingle();

    const payload = {
      organization_id: organizationId, agent_id: agentId, requested_by: null,
      status: "submitted", readiness_snapshot: readiness,
      client_notes: String(body.notes || "").trim() || null,
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    const query = existing?.id
      ? admin.from("agent_approval_requests").update(payload).eq("id", existing.id).eq("organization_id", organizationId)
      : admin.from("agent_approval_requests").insert(payload);
    const { data, error } = await query.select("id,status,submitted_at,readiness_snapshot").single();
    if (error) throw error;

    const { error: statusError } = await admin.from("agents").update({ status: "testing", updated_at: new Date().toISOString() })
      .eq("id", agentId).eq("organization_id", organizationId);
    if (statusError) throw statusError;

    await admin.rpc("refresh_agent_runtime_readiness", { p_organization_id: organizationId, p_agent_id: agentId });
    await admin.from("client_onboarding_profiles").update({ status: "awaiting_approval" })
      .eq("organization_id", organizationId).in("status", ["testing", "configuration"]);
    return NextResponse.json({ ok: true, approval: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit approval." }, { status: 400 });
  }
}
