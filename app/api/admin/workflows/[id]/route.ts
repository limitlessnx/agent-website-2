import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { activateN8nWorkflow, deactivateN8nWorkflow } from "@/lib/n8n-api";
import { getWorkflowById, updateWorkflow } from "@/lib/workflow-registry";

const allowedStatuses = new Set(["draft", "active", "paused", "disabled", "error"]);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const existing = await getWorkflowById(id);
    if (!existing) {
      return NextResponse.json({ error: "Workflow not found." }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const requestedStatus = body.status ? String(body.status) : undefined;
    if (requestedStatus && !allowedStatuses.has(requestedStatus)) {
      return NextResponse.json({ error: "Invalid workflow status." }, { status: 400 });
    }

    if (requestedStatus && existing.provider === "n8n") {
      if (!existing.external_workflow_id) {
        return NextResponse.json(
          { error: "This n8n workflow is missing its external workflow ID." },
          { status: 409 },
        );
      }

      if (requestedStatus === "active") {
        await activateN8nWorkflow(existing.external_workflow_id);
      }

      if (["paused", "disabled"].includes(requestedStatus)) {
        await deactivateN8nWorkflow(existing.external_workflow_id);
      }
    }

    const workflow = await updateWorkflow(id, {
      ...body,
      metadata: {
        ...(existing.metadata || {}),
        ...(existing.provider === "n8n" && requestedStatus
          ? {
              n8n_active: requestedStatus === "active",
              n8n_status_changed_at: new Date().toISOString(),
            }
          : {}),
      },
    });

    return NextResponse.json({ workflow });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update workflow." },
      { status: 500 },
    );
  }
}
