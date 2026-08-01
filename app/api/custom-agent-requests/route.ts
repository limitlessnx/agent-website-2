import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

function text(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json();
    const title = text(body.title, 160);
    const problem = text(body.problem_statement, 8000);
    if (!title || !problem) return NextResponse.json({ error: "Title and problem statement are required." }, { status: 400 });

    const supabase = await createClient();
    const { data, error } = await supabase.from("custom_agent_requests").insert({
      organization_id: session.organizationId,
      submitted_by: session.userId,
      title,
      problem_statement: problem,
      current_process: text(body.current_process, 8000) || null,
      required_channels: Array.isArray(body.required_channels) ? body.required_channels.map(String).slice(0, 20) : [],
      required_integrations: Array.isArray(body.required_integrations) ? body.required_integrations.map(String).slice(0, 30) : [],
      requirements: { desired_actions: text(body.desired_actions, 8000), expected_volume: text(body.expected_volume, 500) },
      budget_range: text(body.budget_range, 120) || null,
      desired_launch_date: text(body.desired_launch_date, 10) || null,
      status: "submitted",
    }).select("id,status").single();
    if (error) throw error;
    return NextResponse.json({ request: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit request." }, { status: 400 });
  }
}
