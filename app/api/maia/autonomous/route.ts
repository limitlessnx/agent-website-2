import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMaia } from "@/lib/ai/maia-runtime";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(secret && supplied && supplied === secret);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: goals, error } = await admin
    .from("agent_runtime_goals")
    .select("id,organization_id,agent_id,title,input,priority")
    .eq("status", "queued")
    .or(`next_run_at.is.null,next_run_at.lte.${now}`)
    .order("priority", { ascending: false })
    .order("created_at")
    .limit(10);
  if (error) return NextResponse.json({ error: "Unable to load autonomous goals." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const goal of goals || []) {
    const claimed = await admin.from("agent_runtime_goals").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", goal.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      const input = goal.input && typeof goal.input === "object" ? goal.input as Record<string, unknown> : {};
      const instructions = typeof input.instructions === "string" ? input.instructions : "Complete the queued autonomous task using approved tenant tools and stop when the goal is satisfied.";
      const result = await runMaia({
        organizationId: goal.organization_id,
        agentId: goal.agent_id,
        message: `AUTONOMOUS GOAL: ${goal.title}\n\n${instructions}`,
        channel: "autonomous",
        autonomous: true,
      });
      await admin.from("agent_runtime_goals").update({ status: "completed", output: { result }, updated_at: new Date().toISOString() }).eq("id", goal.id);
      results.push({ id: goal.id, status: "completed", steps: result.steps });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Autonomous goal failed.";
      await admin.from("agent_runtime_goals").update({ status: "failed", output: { error: message }, updated_at: new Date().toISOString() }).eq("id", goal.id);
      results.push({ id: goal.id, status: "failed", error: message });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}
