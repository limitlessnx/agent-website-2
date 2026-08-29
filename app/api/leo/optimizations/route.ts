import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession } from "@/lib/leo-session-store";
import { dismissLeoOptimizationProposal, listLeoOptimizationProposals, prepareLeoOptimizationIntervention, refreshLeoOptimizationProposals } from "@/lib/leo-autonomous-optimization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") !== "false";
  const workspace = url.searchParams.get("workspace")?.trim() || undefined;
  const organizationId = url.searchParams.get("organization_id")?.trim() || undefined;
  const proposals = refresh ? await refreshLeoOptimizationProposals({ identity, workspace, organizationId }) : await listLeoOptimizationProposals(identity);
  return NextResponse.json({ ok: true, proposals, mode: "proposal_only" }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "refresh").toLowerCase();
  try {
    if (action === "refresh") {
      const proposals = await refreshLeoOptimizationProposals({ identity, workspace: String(body.workspace || "").trim() || undefined, organizationId: String(body.organizationId || body.organization_id || "").trim() || undefined });
      return NextResponse.json({ ok: true, proposals, mode: "proposal_only" });
    }
    const proposalId = String(body.proposalId || body.proposal_id || "").trim();
    if (!proposalId) return NextResponse.json({ error: "proposalId is required." }, { status: 400 });
    if (action === "dismiss") {
      const proposal = await dismissLeoOptimizationProposal(identity, proposalId);
      await auditLeoEvent({ identity, eventType: "leo_optimization_dismissed", details: { proposal_id: proposalId } });
      return NextResponse.json({ ok: true, proposal });
    }
    if (action === "prepare_intervention") {
      const sessionId = String(body.sessionId || body.session_id || "").trim();
      if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      const session = await getOrCreateLeoSession({ identity, sessionId });
      const result = await prepareLeoOptimizationIntervention({ identity, session, proposalId });
      await auditLeoEvent({ identity, session, eventType: "leo_optimization_intervention_prepared", details: { proposal_id: proposalId, orchestration_id: result.orchestration.id, task_id: result.task?.id || null, approval_bypass: false } });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    }
    return NextResponse.json({ error: "Unsupported action. Use refresh, dismiss or prepare_intervention." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Optimization operation failed." }, { status: 400 });
  }
}
