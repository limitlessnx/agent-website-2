import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { getOrCreateLeoSession, auditLeoEvent } from "@/lib/leo-session-store";
import { compactLeoWorkspacePortfolio, listLeoWorkspacePortfolio, resolveLeoWorkspaceTarget } from "@/lib/leo-workspace-portfolio";
import { activateLeoCrossWorkspaceSegment, auditLeoCrossWorkspaceOperation, completeLeoCrossWorkspaceSegment, createLeoCrossWorkspaceOperation, loadLeoCrossWorkspaceOperation } from "@/lib/leo-cross-workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const url = new URL(request.url);
  const reference = String(url.searchParams.get("reference") || "").trim();
  if (reference) {
    try { return NextResponse.json({ ok: true, workspace: await resolveLeoWorkspaceTarget(identity, reference) }); }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace resolution failed." }, { status: 400 }); }
  }
  const portfolio = await listLeoWorkspacePortfolio(identity);
  return NextResponse.json({ ok: true, total: portfolio.length, owned: portfolio.filter((item) => item.relation === "owned").length, clients: portfolio.filter((item) => item.relation === "client").length, workspaces: compactLeoWorkspacePortfolio(portfolio) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "create").trim();
  const session = await getOrCreateLeoSession({ identity, sessionId: String(body.sessionId || "").trim() || undefined });
  try {
    if (action === "create") {
      const operation = await createLeoCrossWorkspaceOperation({ identity, session, objective: String(body.objective || ""), workspaceReferences: Array.isArray(body.workspaces) ? body.workspaces.map(String) : undefined, relation: body.relation === "client" || body.relation === "all" ? body.relation : "owned" });
      await auditLeoEvent({ identity, session, eventType: "cross_workspace_operation_created", details: { operation_id: operation.id, objective: operation.objective, organizations: operation.segments.map((item) => item.workspace.organizationId) } });
      return NextResponse.json({ ok: true, sessionId: session.id, operation, audit: auditLeoCrossWorkspaceOperation(operation) });
    }
    const operation = await loadLeoCrossWorkspaceOperation(identity, session.id, String(body.operationId || "").trim() || undefined);
    if (!operation) return NextResponse.json({ error: "Cross-workspace operation was not found." }, { status: 404 });
    if (action === "get" || action === "active") return NextResponse.json({ ok: true, sessionId: session.id, operation, audit: auditLeoCrossWorkspaceOperation(operation) });
    if (action === "activate") {
      const updated = await activateLeoCrossWorkspaceSegment({ identity, session, operation, segmentId: String(body.segmentId || ""), context: body.context && typeof body.context === "object" && !Array.isArray(body.context) ? body.context : undefined });
      await auditLeoEvent({ identity, session, eventType: "cross_workspace_segment_activated", details: { operation_id: updated.id, segment_id: body.segmentId } });
      return NextResponse.json({ ok: true, sessionId: session.id, operation: updated, audit: auditLeoCrossWorkspaceOperation(updated) });
    }
    if (["completed","blocked","canceled"].includes(action)) {
      const updated = await completeLeoCrossWorkspaceSegment({ identity, operation, segmentId: String(body.segmentId || ""), status: action as "completed" | "blocked" | "canceled" });
      await auditLeoEvent({ identity, session, eventType: "cross_workspace_segment_updated", details: { operation_id: updated.id, segment_id: body.segmentId, status: action } });
      return NextResponse.json({ ok: true, sessionId: session.id, operation: updated, audit: auditLeoCrossWorkspaceOperation(updated) });
    }
    return NextResponse.json({ error: "Unsupported cross-workspace action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Cross-workspace operation failed." }, { status: 400 });
  }
}
