import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import {
  createWorkflowRun,
  getWorkflowByKey,
  updateWorkflowHeartbeat,
  updateWorkflowRun,
} from "@/lib/workflow-registry";

async function authorize(request: NextRequest) {
  const session = await getAdminSession();
  const apiAuth = requireAutomationApiKey(request);
  return Boolean(session || apiAuth.ok);
}

export async function POST(request: NextRequest) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  let runId = "";
  let workflowId = "";

  try {
    const body = await request.json();
    const organizationId = String(body.organization_id || "limitless-realty");
    const workflowKey = String(body.workflow_key || "");
    const payload = body.payload && typeof body.payload === "object" ? body.payload : {};

    if (!workflowKey) {
      return NextResponse.json({ error: "workflow_key is required." }, { status: 400 });
    }

    const workflow = await getWorkflowByKey(organizationId, workflowKey);
    if (!workflow) {
      return NextResponse.json({ error: "Workflow is not registered." }, { status: 404 });
    }
    if (workflow.status !== "active") {
      return NextResponse.json(
        { error: `Workflow is ${workflow.status}, not active.` },
        { status: 409 },
      );
    }
    if (!workflow.endpoint_url) {
      return NextResponse.json({ error: "Workflow endpoint is not configured." }, { status: 409 });
    }

    workflowId = workflow.id;
    const run = await createWorkflowRun(workflow, payload);
    runId = run.id;
    const startedIso = new Date().toISOString();

    await Promise.all([
      updateWorkflowRun(run.id, { status: "running", started_at: startedIso }),
      updateWorkflowHeartbeat(workflow.id, { last_run_at: startedIso }),
    ]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), workflow.timeout_seconds * 1000);

    try {
      const response = await fetch(workflow.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-fluxknight-run-id": run.id,
          "x-fluxknight-workflow-key": workflow.workflow_key,
        },
        body: JSON.stringify({
          organization_id: workflow.organization_id,
          project_id: workflow.project_id,
          workflow_key: workflow.workflow_key,
          workflow_version: workflow.current_version,
          workflow_run_id: run.id,
          payload,
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();
      let result: unknown = responseText;
      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {}

      if (!response.ok) {
        throw new Error(`Workflow endpoint returned ${response.status}: ${responseText.slice(0, 500)}`);
      }

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedAt;
      await Promise.all([
        updateWorkflowRun(run.id, {
          status: "succeeded",
          output_payload: { result },
          duration_ms: durationMs,
          completed_at: completedAt,
        }),
        updateWorkflowHeartbeat(workflow.id, { last_success_at: completedAt }),
      ]);

      return NextResponse.json({
        success: true,
        workflow_run_id: run.id,
        status: "succeeded",
        result,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    const completedAt = new Date().toISOString();
    const durationMs = Date.now() - startedAt;
    const timedOut = error instanceof Error && error.name === "AbortError";
    const message = timedOut
      ? "Workflow execution timed out."
      : error instanceof Error
        ? error.message
        : "Workflow execution failed.";

    if (runId) {
      await updateWorkflowRun(runId, {
        status: timedOut ? "timed_out" : "failed",
        error_message: message,
        duration_ms: durationMs,
        completed_at: completedAt,
      }).catch(() => null);
    }
    if (workflowId) {
      await updateWorkflowHeartbeat(workflowId, {
        last_error_at: completedAt,
      }).catch(() => null);
    }

    return NextResponse.json(
      {
        success: false,
        workflow_run_id: runId || null,
        status: timedOut ? "timed_out" : "failed",
        error: message,
      },
      { status: timedOut ? 504 : 500 },
    );
  }
}
