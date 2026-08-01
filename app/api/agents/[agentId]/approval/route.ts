import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { agentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const supabase = await createClient();

    const [{ data: agent, error: agentError }, { data: integrations, error: integrationError }, { data: tests, error: testError }] = await Promise.all([
      supabase.from("agents").select("id,name,system_prompt,status,communication_channels,human_handoff_destination,configuration").eq("id", agentId).eq("organization_id", session.organizationId).single(),
      supabase.from("organization_integrations").select("provider,status").eq("organization_id", session.organizationId),
      supabase.from("agent_test_runs").select("id,status,created_at").eq("organization_id", session.organizationId).eq("agent_id", agentId).eq("status", "passed").order("created_at", { ascending: false }).limit(1),
    ]);
    if (agentError) throw agentError;
    if (integrationError) throw integrationError;
    if (testError) throw testError;

    const requiredChannels = Array.isArray(agent.communication_channels) ? agent.communication_channels.map(String) : [];
    const connected = new Set((integrations || []).filter((item) => ["connected", "active", "healthy"].includes(String(item.status))).map((item) => String(item.provider).toLowerCase()));
    const missingChannels = requiredChannels.filter((channel) => !connected.has(channel.toLowerCase()));
    const readiness = {
      prompt_ready: Boolean(agent.system_prompt && agent.system_prompt.trim().length >= 40),
      handoff_ready: Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length),
      test_passed: Boolean(tests?.length),
      required_channels: requiredChannels,
      missing_channels: missingChannels,
    };

    if (!readiness.prompt_ready || !readiness.handoff_ready || !readiness.test_passed || missingChannels.length) {
      return NextResponse.json({ error: "Agent is not ready for approval.", readiness }, { status: 409 });
    }

    const payload = {
      organization_id: session.organizationId,
      agent_id: agentId,
      requested_by: session.userId,
      status: "submitted",
      readiness_snapshot: readiness,
      client_notes: String(body.notes || "").trim() || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase.from("agent_approval_requests")
      .select("id")
      .eq("organization_id", session.organizationId)
      .eq("agent_id", agentId)
      .in("status", ["draft", "submitted", "changes_requested"])
      .maybeSingle();

    const query = existing?.id
      ? supabase.from("agent_approval_requests").update(payload).eq("id", existing.id).eq("organization_id", session.organizationId)
      : supabase.from("agent_approval_requests").insert(payload);
    const { data, error } = await query.select("id,status,submitted_at,readiness_snapshot").single();
    if (error) throw error;

    const { error: statusError } = await supabase.from("agents").update({ status: "testing", updated_at: new Date().toISOString() }).eq("id", agentId).eq("organization_id", session.organizationId);
    if (statusError) throw statusError;
    return NextResponse.json({ approval: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
