import {
  createN8nProject,
  createN8nWorkflow,
  findN8nProjectByName,
  findN8nWorkflowByName,
  getN8nWorkflow,
  isN8nApiConfigured,
  transferN8nWorkflow,
  updateN8nWorkflow,
} from "@/lib/n8n-api";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type ProvisionedOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  provisioning?: Record<string, unknown>;
};

type WorkflowRegistryRow = {
  id: string;
  workflow_key: string;
  name: string;
  description?: string | null;
  status?: string | null;
  current_version?: number | null;
  metadata?: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  name: string;
  metadata?: Record<string, unknown> | null;
};

function appBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (configured) return configured.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || "";
  return vercel ? `https://${vercel.replace(/\/$/, "")}` : "";
}

function workflowDefinition(options: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  workflowKey: string;
  workflowName: string;
  timezone: string;
}) {
  const baseUrl = appBaseUrl();
  const nodes: Array<Record<string, unknown>> = [
    {
      id: "manual-trigger",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [240, 300],
      parameters: {},
    },
    {
      id: "organization-context",
      name: "Organization Context",
      type: "n8n-nodes-base.set",
      typeVersion: 3.4,
      position: [470, 300],
      parameters: {
        assignments: {
          assignments: [
            { id: "organization-id", name: "organization_id", value: options.organizationId, type: "string" },
            { id: "organization-name", name: "organization_name", value: options.organizationName, type: "string" },
            { id: "organization-slug", name: "organization_slug", value: options.organizationSlug, type: "string" },
            { id: "workflow-key", name: "workflow_key", value: options.workflowKey, type: "string" },
          ],
        },
        options: {},
      },
    },
  ];

  const connections: Record<string, unknown> = {
    "Manual Trigger": {
      main: [[{ node: "Organization Context", type: "main", index: 0 }]],
    },
  };

  if (baseUrl) {
    nodes.push({
      id: "load-live-configuration",
      name: "Load Live Organization Configuration",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [710, 300],
      parameters: {
        url: `${baseUrl}/api/internal/organizations/${encodeURIComponent(options.organizationId)}/workflow-config`,
        sendHeaders: true,
        headerParameters: {
          parameters: [
            {
              name: "x-fluxknight-workflow-key",
              value: "={{ $env.FLUXKNIGHT_WORKFLOW_SYNC_KEY }}",
            },
          ],
        },
        options: {},
      },
    });
    connections["Organization Context"] = {
      main: [[{ node: "Load Live Organization Configuration", type: "main", index: 0 }]],
    };
  }

  return {
    name: `${options.organizationName} · ${options.workflowName}`,
    nodes,
    connections,
    settings: {
      executionOrder: "v1",
      timezone: options.timezone || "Africa/Lagos",
      saveDataErrorExecution: "all",
      saveDataSuccessExecution: "all",
    },
  };
}

async function loadInternalProject(projectId: string) {
  const rows = await supabaseServerRequest<ProjectRow[]>(
    `projects?select=id,name,metadata&id=eq.${encodeURIComponent(projectId)}&limit=1`,
  );
  return rows[0] || null;
}

async function loadWorkflowRows(projectId: string) {
  return supabaseServerRequest<WorkflowRegistryRow[]>(
    `workflow_registry?select=id,workflow_key,name,description,status,current_version,metadata&project_uuid=eq.${encodeURIComponent(projectId)}&order=name.asc`,
  );
}

async function saveProjectMapping(project: ProjectRow, n8nProjectId: string, n8nProjectName: string) {
  await supabaseServerRequest(`projects?id=eq.${encodeURIComponent(project.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      metadata: {
        ...(project.metadata || {}),
        n8n_project_id: n8nProjectId,
        n8n_project_name: n8nProjectName,
        n8n_last_synced_at: new Date().toISOString(),
        n8n_sync_status: "ready",
      },
      updated_at: new Date().toISOString(),
    }),
  });
}

async function saveWorkflowMapping(row: WorkflowRegistryRow, workflowId: string, projectId: string) {
  await supabaseServerRequest(`workflow_registry?id=eq.${encodeURIComponent(row.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      external_workflow_id: workflowId,
      metadata: {
        ...(row.metadata || {}),
        n8n_workflow_id: workflowId,
        n8n_project_id: projectId,
        n8n_last_synced_at: new Date().toISOString(),
        template_version: Number(row.current_version || 1),
      },
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function provisionOrganizationN8nProject(
  organization: ProvisionedOrganization,
  options: { timezone?: string; force?: boolean } = {},
) {
  if (!isN8nApiConfigured()) {
    return {
      configured: false,
      created: false,
      reason: "N8N_BASE_URL and N8N_API_KEY are not configured.",
      workflows: [],
    };
  }

  const internalProjectId = String(organization.provisioning?.project_id || "").trim();
  if (!internalProjectId) throw new Error("Provisioning result does not contain the internal project ID.");

  const internalProject = await loadInternalProject(internalProjectId);
  if (!internalProject) throw new Error("Provisioned project could not be loaded from Supabase.");

  const projectName = organization.organization_name.trim();
  let n8nProject = await findN8nProjectByName(projectName);
  let projectCreated = false;

  if (!n8nProject) {
    n8nProject = await createN8nProject(projectName);
    projectCreated = true;
  }

  const registryRows = await loadWorkflowRows(internalProjectId);
  const workflowResults: Array<Record<string, unknown>> = [];

  for (const row of registryRows) {
    const desired = workflowDefinition({
      organizationId: organization.organization_id,
      organizationName: organization.organization_name,
      organizationSlug: organization.organization_slug,
      workflowKey: row.workflow_key,
      workflowName: row.name,
      timezone: options.timezone || "Africa/Lagos",
    });

    const mappedId = String(row.metadata?.n8n_workflow_id || "").trim();
    let workflow = null;

    if (mappedId) {
      try {
        workflow = await getN8nWorkflow(mappedId);
      } catch {
        workflow = null;
      }
    }

    if (!workflow) workflow = await findN8nWorkflowByName(desired.name, n8nProject.id);

    let created = false;
    if (!workflow) {
      workflow = await createN8nWorkflow(desired);
      await transferN8nWorkflow(workflow.id, n8nProject.id);
      created = true;
    } else if (options.force || workflow.name !== desired.name) {
      workflow = await updateN8nWorkflow(workflow.id, desired);
    }

    await saveWorkflowMapping(row, workflow.id, n8nProject.id);
    workflowResults.push({
      registryId: row.id,
      workflowId: workflow.id,
      name: desired.name,
      created,
      active: Boolean(workflow.active),
    });
  }

  await saveProjectMapping(internalProject, n8nProject.id, n8nProject.name);

  return {
    configured: true,
    created: projectCreated,
    n8nProject: { id: n8nProject.id, name: n8nProject.name },
    workflows: workflowResults,
  };
}
