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
    const message = String(body.message || "").trim();
    if (!organizationId || !agentId || message.length < 5) {
      return NextResponse.json({ error: "Organization, agent and a test message of at least 5 characters are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: agent, error: agentError } = await admin
      .from("agents")
      .select("id,name,system_prompt,communication_channels,human_handoff_destination")
      .eq("organization_id", organizationId).eq("id", agentId).maybeSingle();
    if (agentError) throw agentError;
    if (!agent) return NextResponse.json({ error: "Agent not found in this tenant." }, { status: 404 });

    const checks = {
      prompt_present: Boolean(agent.system_prompt?.trim()),
      channels_declared: Array.isArray(agent.communication_channels) && agent.communication_channels.length > 0,
      handoff_configured: Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length),
    };
    const passed = checks.prompt_present && checks.channels_declared && checks.handoff_configured;

    const { data, error } = await admin.from("agent_test_runs").insert({
      organization_id: organizationId,
      agent_id: agentId,
      initiated_by: session.userId,
      test_type: "admin_conversation",
      input: { message },
      output: {
        mode: "configuration_validation",
        agent_name: agent.name,
        response: passed ? "Configuration test passed. No external model execution was invoked." : "Configuration test failed.",
        checks,
      },
      status: passed ? "passed" : "failed",
      score: passed ? 100 : 0,
      notes: "Super Admin configuration validation. Live model execution is not invoked by this gate.",
      completed_at: new Date().toISOString(),
    }).select("id,status,score,created_at").single();
    if (error) throw error;

    const { error: readinessError } = await admin.rpc("refresh_agent_runtime_readiness", {
      p_organization_id: organizationId,
      p_agent_id: agentId,
    });
    if (readinessError) throw readinessError;
    if (passed) {
      await admin.from("client_onboarding_profiles").update({ status: "testing" })
        .eq("organization_id", organizationId).eq("status", "configuration");
    }

    return NextResponse.json({ ok: true, test: data, checks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to run configuration test." }, { status: 400 });
  }
}
