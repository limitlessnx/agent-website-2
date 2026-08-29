import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession } from "@/lib/leo-session-store";
import { cancelLeoOperationalTask } from "@/lib/leo-task-plan";
import {
  auditLeoMultiAgentOrchestration,
  cancelLeoMultiAgentOrchestration,
  createLeoMultiAgentOrchestration,
  loadActiveLeoOrchestration,
  refreshLeoMultiAgentOrchestration,
} from "@/lib/leo-multi-agent-orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: Request) {
  try {
    const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
    if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Leo multi-agent orchestration requires super-admin access." }, { status: 403 });
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = String(body.action || "get").trim().toLowerCase();
    const sessionId = String(body.sessionId || body.session_id || "").trim();
    if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
    const session = await getOrCreateLeoSession({ identity, sessionId });

    if (action === "create") {
      const orchestration = await createLeoMultiAgentOrchestration({
        identity,
        session,
        objective: String(body.objective || body.goal || ""),
        workspace: String(body.workspace || "").trim() || undefined,
        organizationId: String(body.organizationId || body.organization_id || "").trim() || undefined,
        context: object(body.context),
      });
      const refreshed = await refreshLeoMultiAgentOrchestration({ identity, session, orchestration });
      await auditLeoEvent({ identity, session, eventType: "multi_agent_orchestration_created", details: { orchestration_id: orchestration.id, task_id: orchestration.taskId, objective: orchestration.objective, specialists: orchestration.delegations.map((item) => item.specialist.key) } });
      return NextResponse.json({ ok: true, ...refreshed, audit: auditLeoMultiAgentOrchestration(refreshed.orchestration, refreshed.task) }, { status: 201 });
    }

    const current = await loadActiveLeoOrchestration(session.id);
    if (!current) return NextResponse.json({ error: "No multi-agent orchestration exists for this Leo session." }, { status: 404 });

    if (action === "get" || action === "refresh") {
      const refreshed = await refreshLeoMultiAgentOrchestration({ identity, session, orchestration: current });
      return NextResponse.json({ ok: true, ...refreshed, audit: auditLeoMultiAgentOrchestration(refreshed.orchestration, refreshed.task) });
    }

    if (action === "cancel") {
      const refreshed = await refreshLeoMultiAgentOrchestration({ identity, session, orchestration: current });
      if (refreshed.task && !["completed", "canceled"].includes(refreshed.task.status)) {
        await cancelLeoOperationalTask({ identity, session, task: refreshed.task, reason: String(body.reason || "Multi-agent orchestration canceled.") });
      }
      const orchestration = await cancelLeoMultiAgentOrchestration({ identity, orchestration: current });
      await auditLeoEvent({ identity, session, eventType: "multi_agent_orchestration_canceled", details: { orchestration_id: current.id, task_id: current.taskId, reason: String(body.reason || "") } });
      return NextResponse.json({ ok: true, orchestration });
    }

    return NextResponse.json({ error: "Unsupported orchestration action. Use create, get, refresh or cancel." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Multi-agent orchestration failed." }, { status: 500 });
  }
}
