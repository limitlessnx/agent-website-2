import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { agentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const message = String(body.message || "").trim();
    if (!message) return NextResponse.json({ error: "Enter a test message." }, { status: 400 });

    const supabase = await createClient();
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id,name,system_prompt,status,communication_channels,human_handoff_destination")
      .eq("id", agentId)
      .eq("organization_id", session.organizationId)
      .single();
    if (agentError) throw agentError;
    if (!agent.system_prompt) return NextResponse.json({ error: "Save the agent prompt before testing." }, { status: 409 });

    const passed = message.length >= 5;
    const output = {
      mode: "configuration_preview",
      agent_name: agent.name,
      response: `Test accepted for ${agent.name}. Live model execution remains disabled until workflow connection is approved.`,
      checks: {
        prompt_present: Boolean(agent.system_prompt),
        channels_declared: Array.isArray(agent.communication_channels) && agent.communication_channels.length > 0,
        handoff_configured: Boolean(agent.human_handoff_destination && Object.keys(agent.human_handoff_destination).length),
      },
    };

    const { data, error } = await supabase.from("agent_test_runs").insert({
      organization_id: session.organizationId,
      agent_id: agentId,
      initiated_by: session.userId,
      test_type: "conversation",
      input: { message },
      output,
      status: passed ? "passed" : "failed",
      score: passed ? 100 : 0,
      notes: "Configuration validation only; no external model or workflow invoked.",
      completed_at: new Date().toISOString(),
    }).select("id,status,score,output,created_at").single();
    if (error) throw error;

    return NextResponse.json({ test: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
