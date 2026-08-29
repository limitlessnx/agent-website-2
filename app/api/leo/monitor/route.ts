import { NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { scanLeoProactiveSignals } from "@/lib/leo-proactive-monitor";
import { acknowledgeLeoProactiveSignal, getPersistedLeoSignal, recordLeoProactiveAlertDelivery, reconcileLeoProactiveSignals } from "@/lib/leo-proactive-signal-store";
import { actionBlueprintForLeoSignal, alertPolicyForLeoSignal, recommendationForLeoSignal, sortDeliverableSignals } from "@/lib/leo-proactive-policy";
import { createLeoOperationalTask } from "@/lib/leo-task-plan";
import { auditLeoEvent, getOrCreateLeoSession } from "@/lib/leo-session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireSuperAdmin() {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  return identity?.scope === "super_admin" ? identity : null;
}
function actorFor(identity: NonNullable<Awaited<ReturnType<typeof requireSuperAdmin>>>) { return identity.email || identity.userId || "super_admin"; }
function lifecycleSummary(signals: Awaited<ReturnType<typeof reconcileLeoProactiveSignals>>) {
  return { new: signals.filter((item) => item.lifecycle === "new").length, active: signals.filter((item) => item.lifecycle === "active").length, acknowledged: signals.filter((item) => item.lifecycle === "acknowledged").length };
}
function enrichSignals(signals: Awaited<ReturnType<typeof reconcileLeoProactiveSignals>>) {
  return signals.map((signal) => ({ ...signal, alertPolicy: alertPolicyForLeoSignal(signal), analysis: recommendationForLeoSignal(signal), actionAvailable: Boolean(actionBlueprintForLeoSignal(signal)) }));
}

export async function GET(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) return NextResponse.json({ error: "Super Leo proactive monitoring requires super-admin access." }, { status: 403 });
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 50, 100));
  const snapshot = await scanLeoProactiveSignals({ limit });
  const persisted = await reconcileLeoProactiveSignals(snapshot, actorFor(identity));
  const signals = enrichSignals(persisted);
  const alerts = sortDeliverableSignals(persisted.filter((item) => alertPolicyForLeoSignal(item).deliver)).slice(0, 8).map((item) => ({ ...item, alertPolicy: alertPolicyForLeoSignal(item), analysis: recommendationForLeoSignal(item), actionAvailable: Boolean(actionBlueprintForLeoSignal(item)) }));
  return NextResponse.json({ ok: true, ...snapshot, signals, alerts, lifecycle: lifecycleSummary(persisted), policy: { interrupt: alerts.filter((item) => item.alertPolicy.mode === "interrupt").length, surface: alerts.filter((item) => item.alertPolicy.mode === "surface").length, quiet: signals.filter((item) => item.alertPolicy.mode === "quiet").length } }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const identity = await requireSuperAdmin();
  if (!identity) return NextResponse.json({ error: "Super Leo proactive monitoring requires super-admin access." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || "").trim().toLowerCase();
  const signalId = String(body.signalId || body.signal_id || "").trim();
  const actor = actorFor(identity);
  try {
    if (action === "acknowledge") {
      const signal = await acknowledgeLeoProactiveSignal(signalId, actor);
      return NextResponse.json({ ok: true, signal });
    }
    if (action === "mark_alerted") {
      const signal = await recordLeoProactiveAlertDelivery(signalId, actor);
      return NextResponse.json({ ok: true, signal });
    }
    if (action === "prepare_task") {
      const signal = await getPersistedLeoSignal(signalId);
      if (!signal || signal.lifecycle === "resolved") return NextResponse.json({ error: "Active proactive signal was not found." }, { status: 404 });
      const blueprint = actionBlueprintForLeoSignal(signal);
      if (!blueprint?.steps.length) return NextResponse.json({ error: "This signal has no safe controlled action plan. Review its evidence manually." }, { status: 409 });
      const sessionId = String(body.sessionId || body.session_id || "").trim();
      if (!sessionId) return NextResponse.json({ error: "sessionId is required to prepare a Leo operational task." }, { status: 400 });
      const session = await getOrCreateLeoSession({ identity, sessionId });
      const task = await createLeoOperationalTask({ identity, session, goal: blueprint.goal, workspace: blueprint.workspace, steps: blueprint.steps });
      await auditLeoEvent({ identity, session, eventType: "proactive_signal_task_prepared", details: { signal_id: signal.id, signal_category: signal.category, signal_severity: signal.severity, task_id: task.id, step_count: task.steps.length, note: blueprint.note || null } });
      return NextResponse.json({ ok: true, task, blueprint, analysis: recommendationForLeoSignal(signal) }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported monitor action. Use acknowledge, mark_alerted or prepare_task." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update proactive signal." }, { status: 400 });
  }
}
