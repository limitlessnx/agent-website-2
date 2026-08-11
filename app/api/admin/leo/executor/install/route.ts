import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import {
  activateN8nWorkflow,
  createN8nWorkflow,
  findN8nWorkflowByName,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import workflowDefinition from "@/n8n/workflows/agent-leo-core-v2-executor.json";

const WORKFLOW_NAME = "Fluxknight - Leo Core v2 Permanent Executor";

function workflowPayload() {
  return {
    name: WORKFLOW_NAME,
    nodes: workflowDefinition.nodes,
    connections: workflowDefinition.connections,
    settings: workflowDefinition.settings,
  };
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const existing = await findN8nWorkflowByName(WORKFLOW_NAME);
    const payload = workflowPayload();
    const workflow = existing
      ? await updateN8nWorkflow(existing.id, payload)
      : await createN8nWorkflow(payload);

    const active = workflow.active ? workflow : await activateN8nWorkflow(workflow.id);

    return NextResponse.json({
      ok: true,
      action: existing ? "updated" : "created",
      workflow: {
        id: active.id,
        name: active.name,
        active: active.active,
      },
      webhookPath: "fluxknight-leo-executor-v2",
      oldWorkflowRetained: true,
      message: "Leo Core v2 permanent executor is installed and active. The previous Leo workflow remains untouched until verification is complete.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to install Leo Core v2 executor." },
      { status: 500 },
    );
  }
}
