import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runMaia } from "@/lib/ai/maia-runtime";

async function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && supplied && supplied === secret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

async function isAssigned(admin: ReturnType<typeof createAdminClient>, organizationId: string, agentId: string) {
  const { data } = await admin.from("organization_agent_selections").select("configuration,status").eq("organization_id", organizationId);
  return (data || []).some((row) => ["selected", "provisioning", "paid", "active"].includes(String(row.status || "")) && String((row.configuration as Record<string, unknown> | null)?.provisioned_agent_id || "") === agentId);
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: goals, error } = await admin.from("agent_runtime_goals").select("id,organization_id,agent_id,title,input,priority").eq("status", "queued").or(`next_run_at.is.null,next_run_at.lte.${now}`).order("priority", { ascending: false }).order("created_at").limit(10);
  if (error) return NextResponse.json({ error: "Unable to load autonomous goals." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const goal of goals || []) {
    const claimed = await admin.from("agent_runtime_goals").update({ status: "running", updated_at: new Date().toISOString() }).eq("id", goal.id).eq("status", "queued").select("id").maybeSingle();
    if (!claimed.data) continue;
    try {
      if (!(await isAssigned(admin, goal.organization_id, goal.agent_id))) throw new Error("Autonomous goal target is no longer assigned to this organization.");
      const input = goal.input && typeof goal.input === "object" ? goal.input as Record<string, unknown> : {};
      const instructions = typeof input.instructions === "string" ? input.instructions : "Complete the queued autonomous task using approved tenant tools and stop when the goal is satisfied.";
      const result = await runMaia({ organizationId: goal.organization_id, agentId: goal.agent_id, message: `AUTONOMOUS GOAL: ${goal.title}\n\n${instructions}`, channel: "autonomous", autonomous: true });
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

export async function GET(request: NextRequest) {
  return POST(request);
}
