import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["draft", "testing"]);

export async function GET(_: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { agentId } = await context.params;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agents")
      .select("id,name,description,system_prompt,status,agent_type,language,temperature,communication_channels,escalation_rules,human_handoff_destination,configuration")
      .eq("id", agentId)
      .eq("organization_id", session.organizationId)
      .single();
    if (error) throw error;
    return NextResponse.json({ agent: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ agentId: string }> }) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { agentId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name || "").trim();
    const systemPrompt = String(body.system_prompt || "").trim();
    if (!name || !systemPrompt) return NextResponse.json({ error: "Agent name and system prompt are required." }, { status: 400 });

    const language = String(body.language || "en").slice(0, 20);
    const temperature = Math.min(1, Math.max(0, Number(body.temperature ?? 0.3)));
    const channels = Array.isArray(body.communication_channels) ? body.communication_channels.map(String).slice(0, 10) : [];
    const qualificationQuestions = Array.isArray(body.qualification_questions) ? body.qualification_questions.map(String).filter(Boolean).slice(0, 20) : [];
    const workingHours = typeof body.working_hours === "object" && body.working_hours ? body.working_hours : {};
    const escalationRules = typeof body.escalation_rules === "object" && body.escalation_rules ? body.escalation_rules : {};
    const handoff = typeof body.human_handoff_destination === "object" && body.human_handoff_destination ? body.human_handoff_destination : {};
    const channelInstructions = typeof body.channel_instructions === "object" && body.channel_instructions ? body.channel_instructions : {};

    const supabase = await createClient();
    const { data: current, error: readError } = await supabase
      .from("agents")
      .select("status,configuration")
      .eq("id", agentId)
      .eq("organization_id", session.organizationId)
      .single();
    if (readError) throw readError;
    if (!allowedStatuses.has(current.status)) return NextResponse.json({ error: "Only draft or testing agents can be edited." }, { status: 409 });

    const configuration = {
      ...(current.configuration || {}),
      qualification_questions: qualificationQuestions,
      working_hours: workingHours,
      channel_instructions: channelInstructions,
      configured_by: session.userId,
      configured_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("agents")
      .update({
        name,
        description: String(body.description || "").trim() || null,
        system_prompt: systemPrompt,
        language,
        temperature,
        communication_channels: channels,
        escalation_rules: escalationRules,
        human_handoff_destination: handoff,
        configuration,
        status: "testing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("organization_id", session.organizationId)
      .select("id,status,updated_at")
      .single();
    if (error) throw error;
    return NextResponse.json({ ok: true, agent: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}
