import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { resolveLeoIdentity } from "@/lib/leo-core";
import { LeoExecutionGateway, type LeoExecutionRequest } from "@/lib/leo-execution";
import { LeoN8nExecutor } from "@/lib/leo-n8n";
import { auditLeoRuntimeConfiguration, loadLeoRuntimeConfiguration } from "@/lib/leo-runtime-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const identity = await resolveLeoIdentity({ channel: "api", allowPublic: false });
  if (!identity || identity.scope !== "super_admin") {
    return NextResponse.json({ error: "Super Admin authorization required." }, { status: 403 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const workflowKey = String(body.workflowKey || "").trim();
    if (!workflowKey) return NextResponse.json({ error: "workflowKey is required." }, { status: 400 });

    const config = loadLeoRuntimeConfiguration();
    const readiness = auditLeoRuntimeConfiguration(config);
    if (!readiness.ready) return NextResponse.json({ error: "Runtime configuration is not ready.", blockers: readiness.blockers }, { status: 503 });

    const workflow = config.n8n.workflows[workflowKey];
    if (!workflow) return NextResponse.json({ error: "n8n workflow is not registered." }, { status: 404 });

    const executionId = String(body.executionId || randomUUID());
    const risk = workflow.consequential ? "consequential" : "read_only";
    const approved = body.approved === true;
    const requestPayload: LeoExecutionRequest = {
      executionId,
      organizationId: typeof body.organizationId === "string" ? body.organizationId : undefined,
      agentRole: String(body.agentRole || "leo"),
      action: `n8n.${workflowKey}`,
      risk,
      input: body.input ?? {},
      approval: approved ? { approved: true, approvedBy: identity.userId || identity.email || "super_admin", approvedAt: new Date().toISOString() } : undefined,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
    };

    const n8n = new LeoN8nExecutor(config);
    const gateway = new LeoExecutionGateway(config);
    gateway.register(requestPayload.action, async (execution) => n8n.execute(workflowKey, execution));
    const result = await gateway.execute(identity, requestPayload);
    const status = result.status === "succeeded" ? 200 : result.status === "rejected" ? 409 : 502;
    return NextResponse.json({ ok: result.status === "succeeded", result }, { status, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Runtime execution failed." }, { status: 500 });
  }
}
