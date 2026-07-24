import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listN8nWorkflows } from "@/lib/n8n-api";
import { getWorkflows, registerWorkflow } from "@/lib/workflow-registry";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [n8nWorkflows, registered] = await Promise.all([
      listN8nWorkflows(),
      getWorkflows(),
    ]);

    const byExternalId = new Map(
      registered
        .filter((workflow) => workflow.provider === "n8n" && workflow.external_workflow_id)
        .map((workflow) => [workflow.external_workflow_id, workflow]),
    );

    const synced = [];
    for (const workflow of n8nWorkflows) {
      const existing = byExternalId.get(workflow.id);
      const record = await registerWorkflow({
        organization_id: existing?.organization_id || "limitless-realty",
        project_id: existing?.project_id || "limitless-realty",
        workflow_key: existing?.workflow_key || `n8n-${workflow.id}-${slugify(workflow.name)}`,
        name: workflow.name,
        description: existing?.description || "Imported from n8n public API.",
        provider: "n8n",
        external_workflow_id: workflow.id,
        endpoint_url: existing?.endpoint_url,
        status: workflow.active ? "active" : "paused",
        current_version: existing?.current_version || 1,
        timeout_seconds: existing?.timeout_seconds || 60,
        max_retries: existing?.max_retries ?? 2,
        metadata: {
          ...(existing?.metadata || {}),
          n8n_active: workflow.active,
          n8n_updated_at: workflow.updatedAt || null,
          synced_at: new Date().toISOString(),
        },
      });
      synced.push(record);
    }

    return NextResponse.json({
      ok: true,
      discovered: n8nWorkflows.length,
      synced: synced.length,
      workflows: synced,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sync n8n workflows." },
      { status: 500 },
    );
  }
}
