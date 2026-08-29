import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { getOrCreateLeoSession, auditLeoEvent } from "@/lib/leo-session-store";
import { createLeoMultiAgentOrchestration, refreshLeoMultiAgentOrchestration } from "@/lib/leo-multi-agent-orchestrator";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { createLeoAutonomousGoal, evaluateLeoAutonomousGoals, listLeoAutonomousGoals, setLeoAutonomousGoalStatus, summarizeLeoGoalHealth } from "@/lib/leo-autonomous-goals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function rec(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

export async function GET() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo goals require super-admin access." }, { status: 403 });
  const goals = await listLeoAutonomousGoals(identity, true);
  return NextResponse.json({ ok: true, goals, health: summarizeLeoGoalHealth(goals) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo goals require super-admin access." }, { status: 403 });
    const body = await request.json().catch(() => ({})); const action = String(body.action || "evaluate").toLowerCase();
    if (action === "create") {
      const goal = await createLeoAutonomousGoal(identity, rec(body.goal || body));
      return NextResponse.json({ ok: true, goal }, { status: 201 });
    }
    if (["pause","resume","retire"].includes(action)) {
      const id = String(body.goalId || body.goal_id || "").trim(); if (!id) return NextResponse.json({ error: "goalId is required." }, { status: 400 });
      const goal = await setLeoAutonomousGoalStatus(identity, id, action === "pause" ? "paused" : action === "retire" ? "retired" : "active");
      return NextResponse.json({ ok: true, goal });
    }
    if (action === "evaluate") {
      const snapshot = await scanLeoProactiveSignals({ limit: 100 });
      const goals = await evaluateLeoAutonomousGoals(identity, snapshot.signals);
      return NextResponse.json({ ok: true, generatedAt: snapshot.generatedAt, goals, health: summarizeLeoGoalHealth(goals) });
    }
    if (action === "intervene") {
      const goalId = String(body.goalId || body.goal_id || "").trim(); const sessionId = String(body.sessionId || body.session_id || "").trim();
      if (!goalId || !sessionId) return NextResponse.json({ error: "goalId and sessionId are required." }, { status: 400 });
      const goals = await listLeoAutonomousGoals(identity, true); const goal = goals.find((item) => item.id === goalId || item.key === goalId);
      if (!goal || goal.status !== "active") return NextResponse.json({ error: "Active autonomous goal was not found." }, { status: 404 });
      if (!goal.lastEvaluation || goal.lastEvaluation.state === "healthy" || !goal.lastEvaluation.recommendedObjective) return NextResponse.json({ error: "This goal has no current intervention requiring action." }, { status: 409 });
      const session = await getOrCreateLeoSession({ identity, sessionId });
      const orchestration = await createLeoMultiAgentOrchestration({ identity, session, objective: goal.lastEvaluation.recommendedObjective, workspace: goal.workspace, organizationId: goal.organizationId, context: { goal_id: goal.id, goal_key: goal.key, signal_ids: goal.lastEvaluation.matchingSignalIds } });
      const refreshed = await refreshLeoMultiAgentOrchestration({ identity, session, orchestration });
      await auditLeoEvent({ identity, session, eventType: "autonomous_goal_intervention_created", details: { goal_id: goal.id, goal_key: goal.key, orchestration_id: orchestration.id, task_id: orchestration.taskId, signal_ids: goal.lastEvaluation.matchingSignalIds } });
      return NextResponse.json({ ok: true, goal, orchestration: refreshed.orchestration, task: refreshed.task }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported goal action. Use create, pause, resume, retire, evaluate or intervene." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Super Leo autonomous goal operation failed." }, { status: 500 });
  }
}
