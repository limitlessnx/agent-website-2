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
  organization_uuid: string;
  workflow_key: string;
  name: string;
  description?: string | null;
  status?: string | null;
  current_version?: number | null;
  metadata?: Record<string, unknown> | null;
};

type ProjectRow = {
  id: string;
  organization_id: string;
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
    name: `Fluxknight ${options.organizationId} · ${options.workflowKey}`,
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

async function loadInternalProject(projectId: string, organizationId: string) {
  const rows = await supabaseServerRequest<ProjectRow[]>(
    `projects?select=id,name,organization_id,metadata&id=eq.${encodeURIComponent(projectId)}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
  );
  return rows[0] || null;
}

async function loadWorkflowRows(projectId: string, organizationId: string) {
  return supabaseServerRequest<WorkflowRegistryRow[]>(
    `workflow_registry?select=id,organization_uuid,workflow_key,name,description,status,current_version,metadata&project_uuid=eq.${encodeURIComponent(projectId)}&organization_uuid=eq.${encodeURIComponent(organizationId)}&order=name.asc`,
  );
}

async function saveProjectMapping(project: ProjectRow, n8nProjectId: string, n8nProjectName: string) {
  await supabaseServerRequest(`projects?id=eq.${encodeURIComponent(project.id)}&organization_id=eq.${encodeURIComponent(project.organization_id)}`, {
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

async function saveWorkflowMapping(row: WorkflowRegistryRow, workflowId: string, projectId: string, transferPending = false) {
  await supabaseServerRequest(`workflow_registry?id=eq.${encodeURIComponent(row.id)}&organization_uuid=eq.${encodeURIComponent(row.organization_uuid)}`, {
    method: "PATCH",
    body: JSON.stringify({
      external_workflow_id: workflowId,
      metadata: {
        ...(row.metadata || {}),
        n8n_workflow_id: workflowId,
        n8n_create_pending: false,
        n8n_transfer_pending: transferPending,
        n8n_project_id: projectId,
        n8n_last_synced_at: new Date().toISOString(),
        template_version: Number(row.current_version || 1),
      },
      updated_at: new Date().toISOString(),
    }),
  });
}

async function provisionProject(
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

  const internalProject = await loadInternalProject(internalProjectId, organization.organization_id);
  if (!internalProject) throw new Error("Provisioned project could not be loaded from Supabase.");

  // Stable tenant identity prevents two businesses with the same name sharing a project.
  const projectName = String(internalProject.metadata?.n8n_project_name || `Fluxknight ${organization.organization_id}`);
  let n8nProject = await findN8nProjectByName(projectName);
  if (n8nProject && internalProject.metadata?.n8n_project_id && internalProject.metadata.n8n_project_id !== n8nProject.id) throw new Error("Mapped project identity mismatch.");
  if (!n8nProject && internalProject.metadata?.n8n_project_id) throw new Error("Mapped project could not be verified.");
  if (!n8nProject && internalProject.metadata?.n8n_project_create_pending) {
    throw new Error("Reconcile the previous project creation before retrying.");
  }
  let projectCreated = false;

  if (!n8nProject) {
    internalProject.metadata = { ...internalProject.metadata, n8n_project_create_pending: true };
    await saveProgress(internalProject);
    n8nProject = await createN8nProject(projectName);
    projectCreated = true;
  }

  // Persist the remote identity before any workflow work can fail.
  internalProject.metadata = { ...internalProject.metadata, n8n_project_id: n8nProject.id, n8n_project_name: n8nProject.name, n8n_project_create_pending: false };
  await saveProgress(internalProject);
  const registryRows = await loadWorkflowRows(internalProjectId, organization.organization_id);
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
        // A timeout or permission error is not evidence that the workflow disappeared.
        throw new Error("Unable to verify a mapped workflow. Reconcile its remote state before retrying.");
      }
    }

    // The stable name is also recoverable before a failed transfer to the tenant project.
    if (!workflow) workflow = await findN8nWorkflowByName(desired.name);
    if (!workflow && row.metadata?.n8n_create_pending) {
      throw new Error("Reconcile the previous workflow creation before retrying.");
    }

    let created = false;
    if (!workflow) {
      row.metadata = { ...row.metadata, n8n_create_pending: true };
      await supabaseServerRequest(`workflow_registry?id=eq.${encodeURIComponent(row.id)}&organization_uuid=eq.${encodeURIComponent(organization.organization_id)}`, {
        method: "PATCH", body: JSON.stringify({ metadata: row.metadata }),
      });
      workflow = await createN8nWorkflow(desired);
      // Save before transfer so a retry never needs to clone again.
      await saveWorkflowMapping(row, workflow.id, n8nProject.id, true);
      await transferN8nWorkflow(workflow.id, n8nProject.id);
      created = true;
    } else if (options.force) {
      workflow = await updateN8nWorkflow(workflow.id, desired);
    }

    if (!created && (!mappedId || row.metadata?.n8n_transfer_pending)) await transferN8nWorkflow(workflow.id, n8nProject.id);
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

async function saveProgress(project: ProjectRow) {
  await supabaseServerRequest(`projects?id=eq.${encodeURIComponent(project.id)}&organization_id=eq.${encodeURIComponent(project.organization_id)}`, {
    method: "PATCH", body: JSON.stringify({ metadata: project.metadata, updated_at: new Date().toISOString() }),
  });
}

export type OrganizationProvisioningOutcome = {
  status: "provisioning_in_progress" | "needs_attention" | "awaiting_customer_configuration";
  complete: boolean;
  message: string;
};

/** Reuses the existing starter provisioner. Remote calls never activate workflows. */
export async function provisionOrganizationN8nProject(
  organization: ProvisionedOrganization,
  options: { timezone?: string; force?: boolean } = {},
): Promise<OrganizationProvisioningOutcome> {
  const projectId = String(organization.provisioning?.project_id || "");
  const project = await loadInternalProject(projectId, organization.organization_id);
  if (!project) return { status: "needs_attention", complete: false, message: "Starter project is missing. Review the saved organization setup." };
  if (project.metadata?.onboarding_sync_running === true) {
    return { status: "provisioning_in_progress", complete: false, message: "Provisioning is already running. Refresh setup for progress. If interrupted, reconcile the remote state before clearing the claim." };
  }
  // Atomic compare-and-set on existing metadata serializes retries across workers.
  const filter = project.metadata == null ? "metadata=is.null" : `metadata=eq.${encodeURIComponent(JSON.stringify(project.metadata))}`;
  const claimed = await supabaseServerRequest<ProjectRow[]>(`projects?id=eq.${encodeURIComponent(project.id)}&organization_id=eq.${encodeURIComponent(organization.organization_id)}&${filter}`, {
    method: "PATCH", body: JSON.stringify({ metadata: { ...project.metadata, onboarding_sync_running: true, onboarding_sync_started_at: new Date().toISOString(), n8n_sync_status: "provisioning" } }),
  });
  if (!claimed.length) return { status: "provisioning_in_progress", complete: false, message: "Setup changed. Refresh before retrying." };
  let outcome: OrganizationProvisioningOutcome;
  try {
    const result = await provisionProject(organization, options);
    outcome = result.configured
      ? { status: "awaiting_customer_configuration", complete: true, message: "Starter automation deployed. Customer configuration, testing and approval are still required." }
      : { status: "needs_attention", complete: false, message: "Automation provider is not configured. Ask a platform administrator to configure it, then retry setup." };
  } catch {
    // Never return provider response bodies: they may contain credentials or customer data.
    outcome = { status: "needs_attention", complete: false, message: "Automation provisioning did not complete. The organization is saved. Retry setup; ambiguous remote creations require administrator reconciliation." };
  }
  const latest = await loadInternalProject(project.id, organization.organization_id);
  if (!latest) throw new Error("Unable to save provisioning status.");
  latest.metadata = { ...latest.metadata, onboarding_sync_running: false, n8n_sync_status: outcome.complete ? "ready" : "needs_attention", onboarding_provisioning: outcome };
  await saveProgress(latest);
  return outcome;
}
