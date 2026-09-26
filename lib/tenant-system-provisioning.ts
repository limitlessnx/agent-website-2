import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import {
  createN8nProject,
  createN8nWorkflow,
  findN8nProjectByName,
  getN8nWorkflow,
  transferN8nWorkflow,
} from "@/lib/n8n-api";

type Organization = { id: string; name: string; slug: string };
type OrganizationSystem = {
  id: string;
  organization_id: string;
  system_id: string;
  status: string;
  configuration?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};
type SystemCatalog = { id: string; name: string; slug: string; included_agents?: unknown[] | null };
type AgentSelectionLite = { id: string; system_catalog_id?: string | null; configuration?: Record<string, unknown> | null };
type SystemTemplateMap = {
  automation_template_id: string;
  required: boolean;
  display_order: number;
  configuration_overrides?: Record<string, unknown> | null;
};
type AutomationTemplate = {
  id: string;
  name: string;
  slug: string;
  latest_approved_version: number;
};
type AutomationVersion = {
  id: string;
  version: number;
  source_n8n_workflow_id: string;
  source_n8n_workflow_name: string;
  configuration_defaults?: Record<string, unknown> | null;
};
type OrganizationAutomation = {
  id: string;
  backend_workflow_id?: string | null;
  backend_workflow_name?: string | null;
  status: string;
};
type ProvisioningJob = { id: string; status: string };

function replaceTenantPlaceholders(value: unknown, replacements: Record<string, string>): unknown {
  if (typeof value === "string") {
    return Object.entries(replacements).reduce(
      (result, [needle, replacement]) => result.split(needle).join(replacement),
      value,
    );
  }
  if (Array.isArray(value)) return value.map((item) => replaceTenantPlaceholders(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        replaceTenantPlaceholders(item, replacements),
      ]),
    );
  }
  return value;
}

async function one<T>(path: string) {
  const rows = await supabaseServerRequest<T[]>(path);
  return rows[0] || null;
}

async function patch<T>(table: string, id: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<T[]>(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return rows[0] || null;
}

async function assertProvisionable(installationId: string) {
  const rows = await supabaseServerRequest<Record<string, unknown>[]>(
    "rpc/assert_organization_system_provisionable",
    { method: "POST", body: JSON.stringify({ p_installation_id: installationId }) },
  );
  return rows[0] || null;
}

function agentKeyFromName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function ensureIncludedAgentSelections(organization: Organization, system: SystemCatalog) {
  const includedAgents = Array.isArray(system.included_agents)
    ? system.included_agents.map((value) => String(value).trim()).filter(Boolean)
    : [];
  if (!includedAgents.length) return { included_agents: [], provisioning: null };

  for (const displayName of includedAgents) {
    const agentKey = agentKeyFromName(displayName);
    if (!agentKey) continue;

    const existing = await one<AgentSelectionLite>(
      `organization_agent_selections?organization_id=eq.${encodeURIComponent(organization.id)}&agent_key=eq.${encodeURIComponent(agentKey)}&select=id,system_catalog_id,configuration&limit=1`,
    );

    if (existing) {
      const bindings = new Set(
        Array.isArray(existing.configuration?.system_bindings)
          ? (existing.configuration?.system_bindings as unknown[]).map(String)
          : [],
      );
      bindings.add(system.id);
      await patch("organization_agent_selections", existing.id, {
        configuration: {
          ...(existing.configuration || {}),
          system_bindings: [...bindings],
          last_bound_system_slug: system.slug,
        },
      });
      continue;
    }

    await supabaseServerRequest<AgentSelectionLite[]>("organization_agent_selections", {
      method: "POST",
      body: JSON.stringify({
        organization_id: organization.id,
        system_catalog_id: system.id,
        agent_key: agentKey,
        display_name: displayName,
        status: "selected",
        setup_price: 0,
        monthly_price: 0,
        currency: "NGN",
        configuration: {
          allocation_source: "system_provisioning",
          system_bindings: [system.id],
          system_slug: system.slug,
        },
      }),
    });
  }

  const provisioning = await supabaseServerRequest<Record<string, unknown>>(
    "rpc/provision_selected_agent_allocations",
    {
      method: "POST",
      body: JSON.stringify({
        p_organization_id: organization.id,
        p_actor_user_id: null,
      }),
    },
  );

  return { included_agents: includedAgents, provisioning };
}

async function ensureOrganizationAutomation(input: {
  organizationId: string;
  template: AutomationTemplate;
  version: AutomationVersion;
  configuration: Record<string, unknown>;
}) {
  const rows = await supabaseServerRequest<OrganizationAutomation[]>(
    "organization_automations?on_conflict=organization_id,automation_template_id",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        organization_id: input.organizationId,
        automation_template_id: input.template.id,
        automation_template_version_id: input.version.id,
        display_name: input.template.name,
        status: "provisioning",
        client_configuration: input.configuration,
        provisioned_version: input.version.version,
        activated_at: null,
        last_error: null,
      }),
    },
  );
  return rows[0];
}

async function ensureProvisioningJob(input: {
  installationId: string;
  organizationId: string;
  organizationAutomationId: string;
  versionId: string;
  version: number;
  templateId: string;
  actorUserId?: string | null;
}) {
  const idempotencyKey = `system:${input.installationId}:automation:${input.templateId}:v${input.version}`;
  const rows = await supabaseServerRequest<ProvisioningJob[]>(
    "automation_provisioning_jobs?on_conflict=idempotency_key",
    {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        organization_id: input.organizationId,
        organization_automation_id: input.organizationAutomationId,
        automation_template_version_id: input.versionId,
        idempotency_key: idempotencyKey,
        status: "queued",
        available_at: new Date().toISOString(),
        payload: {
          organization_system_id: input.installationId,
          requested_by: input.actorUserId || null,
        },
        last_error: null,
      }),
    },
  );
  return rows[0];
}

export async function provisionTenantSystem(installationId: string, actorUserId?: string | null) {
  const installation = await one<OrganizationSystem>(
    `organization_systems?id=eq.${encodeURIComponent(installationId)}&select=*&limit=1`,
  );
  if (!installation) throw new Error("Organization system installation was not found.");
  if (installation.status === "active") {
    return {
      organization_system_id: installation.id,
      status: "active",
      idempotent: true,
      automations: [],
    };
  }

  await assertProvisionable(installationId);

  const [organization, system] = await Promise.all([
    one<Organization>(`organizations?id=eq.${encodeURIComponent(installation.organization_id)}&select=id,name,slug&limit=1`),
    one<SystemCatalog>(`system_catalog?id=eq.${encodeURIComponent(installation.system_id)}&select=id,name,slug,included_agents&limit=1`),
  ]);
  if (!organization || !system) throw new Error("Tenant organization or marketplace system is missing.");

  const agentProvisioning = await ensureIncludedAgentSelections(organization, system);

  const mappings = await supabaseServerRequest<SystemTemplateMap[]>(
    `system_automation_templates?system_id=eq.${encodeURIComponent(system.id)}&select=*&order=display_order.asc`,
  );
  if (!mappings.length) {
    await patch("organization_systems", installation.id, {
      status: "needs_attention",
      last_error: "No approved backend templates are mapped to this system.",
    });
    throw new Error("No approved backend templates are mapped to this system.");
  }

  await patch("organization_systems", installation.id, {
    status: "provisioning",
    approved_at: new Date().toISOString(),
    activated_at: null,
    last_error: null,
    metadata: {
      ...(installation.metadata || {}),
      test_passed: false,
      provisioning_started_at: new Date().toISOString(),
    },
  });

  const projectName = `Fluxknight Tenant - ${organization.name}`;
  const project = (await findN8nProjectByName(projectName)) || (await createN8nProject(projectName));
  const results: Array<Record<string, unknown>> = [];

  for (const mapping of mappings) {
    const template = await one<AutomationTemplate>(
      `automation_templates?id=eq.${encodeURIComponent(mapping.automation_template_id)}&status=eq.available&select=*&limit=1`,
    );
    if (!template) {
      if (mapping.required) throw new Error("A required automation template is unavailable.");
      continue;
    }

    const version = await one<AutomationVersion>(
      `automation_template_versions?automation_template_id=eq.${encodeURIComponent(template.id)}&version=eq.${template.latest_approved_version}&status=eq.approved&select=*&limit=1`,
    );
    if (!version?.source_n8n_workflow_id) {
      if (mapping.required) throw new Error(`${template.name} has no approved n8n source workflow.`);
      continue;
    }

    const configuration = {
      ...(version.configuration_defaults || {}),
      ...(installation.configuration || {}),
      ...(mapping.configuration_overrides || {}),
      organization_id: organization.id,
      organization_slug: organization.slug,
      organization_name: organization.name,
      system_slug: system.slug,
      system_installation_id: installation.id,
    };

    const organizationAutomation = await ensureOrganizationAutomation({
      organizationId: organization.id,
      template,
      version,
      configuration,
    });
    if (!organizationAutomation) throw new Error(`Unable to create ${template.name} installation.`);

    if (organizationAutomation.backend_workflow_id) {
      await patch("organization_automations", organizationAutomation.id, {
        status: "paused",
        activated_at: null,
        last_error: null,
      });
      results.push({
        automation: template.slug,
        status: "already_provisioned",
        workflow_id: organizationAutomation.backend_workflow_id,
      });
      continue;
    }

    const job = await ensureProvisioningJob({
      installationId: installation.id,
      organizationId: organization.id,
      organizationAutomationId: organizationAutomation.id,
      versionId: version.id,
      version: version.version,
      templateId: template.id,
      actorUserId,
    });
    if (!job) throw new Error(`Unable to queue ${template.name}.`);

    await patch("automation_provisioning_jobs", job.id, {
      status: "running",
      attempts: 1,
      locked_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    });

    try {
      const source = await getN8nWorkflow(version.source_n8n_workflow_id);
      const workflowName = `${organization.name} - ${template.name} - v${version.version}`;
      const replacements = {
        "{{ORGANIZATION_ID}}": organization.id,
        "{{ORGANIZATION_SLUG}}": organization.slug,
        "{{ORGANIZATION_NAME}}": organization.name,
        "{{SYSTEM_INSTALLATION_ID}}": installation.id,
      };
      const nodes = replaceTenantPlaceholders(source.nodes || [], replacements) as unknown[];
      const connections = replaceTenantPlaceholders(source.connections || {}, replacements) as Record<string, unknown>;
      const settings = replaceTenantPlaceholders(source.settings || {}, replacements) as Record<string, unknown>;

      const clone = await createN8nWorkflow({ name: workflowName, nodes, connections, settings });
      if (project.id) await transferN8nWorkflow(clone.id, project.id);

      await patch("organization_automations", organizationAutomation.id, {
        status: "paused",
        backend_workflow_id: clone.id,
        backend_workflow_name: workflowName,
        activated_at: null,
        last_error: null,
        last_provisioning_job_id: job.id,
      });
      await patch("automation_provisioning_jobs", job.id, {
        status: "completed",
        result: { workflow_id: clone.id, workflow_name: workflowName, n8n_project_id: project.id },
        completed_at: new Date().toISOString(),
        last_error: null,
      });
      results.push({ automation: template.slug, status: "provisioned", workflow_id: clone.id });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to provision ${template.name}.`;
      await Promise.all([
        patch("organization_automations", organizationAutomation.id, { status: "needs_attention", last_error: message }),
        patch("automation_provisioning_jobs", job.id, {
          status: "failed",
          last_error: message,
          completed_at: new Date().toISOString(),
        }),
      ]);
      if (mapping.required) {
        await patch("organization_systems", installation.id, { status: "needs_attention", last_error: message });
        throw new Error(message);
      }
      results.push({ automation: template.slug, status: "failed", error: message });
    }
  }

  const failed = results.filter((item) => item.status === "failed");
  const finalStatus = failed.length ? "needs_attention" : "testing";
  await patch("organization_systems", installation.id, {
    status: finalStatus,
    activated_at: null,
    last_error: failed.length ? "One or more optional automations require attention." : null,
    metadata: {
      ...(installation.metadata || {}),
      n8n_project_id: project.id,
      provisioning_results: results,
      agent_provisioning: agentProvisioning,
      test_passed: false,
      provisioning_completed_at: new Date().toISOString(),
    },
  });

  return {
    organization_system_id: installation.id,
    organization: organization.name,
    system: system.name,
    status: finalStatus,
    included_agents: agentProvisioning.included_agents,
    agent_provisioning: agentProvisioning.provisioning,
    automations: results,
  };
}
