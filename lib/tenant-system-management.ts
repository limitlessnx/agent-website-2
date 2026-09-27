import { createAdminClient } from "@/lib/supabase/admin";
import { activateN8nWorkflow } from "@/lib/n8n-api";

type InstallationRow = {
  id: string;
  organization_id: string;
  system_id: string;
  status: string;
  metadata?: Record<string, unknown> | null;
};

type ProvisioningJobRow = {
  id: string;
  organization_automation_id: string;
  status: string;
  payload?: Record<string, unknown> | null;
  last_error?: string | null;
};

type OrganizationAutomationRow = {
  id: string;
  backend_workflow_id?: string | null;
  status: string;
};

export async function listTenantSystems(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_systems")
    .select("id,organization_id,system_id,status,configuration,requested_at,approved_at,activated_at,last_error,metadata,system_catalog(id,slug,name,summary,category,status,included_agents,capabilities,setup_requirements)")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw error;
  return data || [];
}

export async function requestTenantSystem(input: {
  organizationId: string;
  systemSlug: string;
  configuration?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("request_organization_system_installation", {
    p_organization_id: input.organizationId,
    p_system_slug: input.systemSlug,
    p_configuration: input.configuration || {},
    p_actor_user_id: null,
  });
  if (error) throw error;
  return data;
}

async function getInstallation(installationId: string) {
  const { data, error } = await createAdminClient()
    .from("organization_systems")
    .select("id,organization_id,system_id,status,metadata")
    .eq("id", installationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Organization system installation not found.");
  return data as InstallationRow;
}

export async function testTenantSystem(installationId: string) {
  const admin = createAdminClient();
  const installation = await getInstallation(installationId);
  if (!["testing", "needs_attention"].includes(installation.status)) {
    throw new Error("System must finish provisioning before testing.");
  }

  const { data: mappings, error: mappingError } = await admin
    .from("system_automation_templates")
    .select("automation_template_id,required")
    .eq("system_id", installation.system_id);
  if (mappingError) throw mappingError;

  const { data: catalog, error: catalogError } = await admin
    .from("system_catalog")
    .select("included_agents")
    .eq("id", installation.system_id)
    .single();
  if (catalogError) throw catalogError;

  const requiredAgentCount = Array.isArray(catalog?.included_agents) ? catalog.included_agents.length : 0;
  const agentReadiness: Array<Record<string, unknown>> = [];
  let provisionedAgentCount = 0;
  let agentRuntimeReady = requiredAgentCount === 0;

  if (requiredAgentCount > 0) {
    const { data: selections, error: selectionsError } = await admin
      .from("organization_agent_selections")
      .select("id,agent_key,status,configuration")
      .eq("organization_id", installation.organization_id)
      .eq("system_catalog_id", installation.system_id)
      .in("status", ["selected", "paid", "provisioning", "active"]);
    if (selectionsError) throw selectionsError;

    const agentIds = [...new Set((selections || [])
      .map((selection) => String(((selection.configuration || {}) as Record<string, unknown>).provisioned_agent_id || ""))
      .filter(Boolean))];
    provisionedAgentCount = agentIds.length;

    if (agentIds.length) {
      const [{ data: agents, error: agentsError }, { data: readiness, error: readinessError }] = await Promise.all([
        admin.from("agents")
          .select("id,name,status")
          .eq("organization_id", installation.organization_id)
          .in("id", agentIds),
        admin.from("agent_runtime_readiness")
          .select("agent_id,readiness_score,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,blockers,refreshed_at")
          .eq("organization_id", installation.organization_id)
          .in("agent_id", agentIds),
      ]);
      if (agentsError) throw agentsError;
      if (readinessError) throw readinessError;

      const readinessByAgent = new Map((readiness || []).map((row) => [String(row.agent_id), row]));
      for (const agent of agents || []) {
        const state = readinessByAgent.get(String(agent.id));
        const ready = Boolean(
          ["testing", "published", "active"].includes(String(agent.status || "").toLowerCase())
          && state?.readiness_score === 100
          && state?.business_profile_ready
          && state?.prompt_ready
          && state?.knowledge_ready
          && state?.integrations_ready
          && state?.test_ready
          && state?.approval_ready
          && state?.workflow_ready
        );
        agentReadiness.push({
          agent_id: agent.id,
          name: agent.name,
          status: agent.status,
          readiness_score: state?.readiness_score ?? 0,
          blockers: state?.blockers || ["readiness_snapshot_missing"],
          ready,
        });
      }
    }

    agentRuntimeReady =
      provisionedAgentCount >= requiredAgentCount
      && agentReadiness.length >= requiredAgentCount
      && agentReadiness.every((item) => item.ready === true);
  }

  const requiredTemplateIds = new Set(
    (mappings || []).filter((item) => item.required).map((item) => String(item.automation_template_id)),
  );

  const { data: jobs, error: jobsError } = await admin
    .from("automation_provisioning_jobs")
    .select("id,organization_automation_id,status,payload,last_error")
    .eq("organization_id", installation.organization_id)
    .contains("payload", { organization_system_id: installation.id });
  if (jobsError) throw jobsError;

  const typedJobs = (jobs || []) as ProvisioningJobRow[];
  const automationIds = [...new Set(typedJobs.map((job) => job.organization_automation_id).filter(Boolean))];
  let automations: OrganizationAutomationRow[] = [];

  if (automationIds.length) {
    const { data, error } = await admin
      .from("organization_automations")
      .select("id,automation_template_id,backend_workflow_id,status")
      .eq("organization_id", installation.organization_id)
      .in("id", automationIds);
    if (error) throw error;
    automations = (data || []) as OrganizationAutomationRow[];
  }

  const installedRequired = new Set(
    (automations as Array<OrganizationAutomationRow & { automation_template_id?: string }>)
      .filter((item) => item.backend_workflow_id && item.automation_template_id)
      .map((item) => String(item.automation_template_id)),
  );

  const missingRequired = [...requiredTemplateIds].filter((id) => !installedRequired.has(id));
  const failedJobs = typedJobs.filter((job) => job.status === "failed");
  const passed = missingRequired.length === 0 && failedJobs.length === 0 && agentRuntimeReady;

  const details = {
    required_agent_count: requiredAgentCount,
    provisioned_agent_count: provisionedAgentCount,
    agent_runtime_ready: agentRuntimeReady,
    agent_readiness: agentReadiness,
    required_template_count: requiredTemplateIds.size,
    installed_required_count: installedRequired.size,
    missing_required_template_ids: missingRequired,
    failed_job_ids: failedJobs.map((job) => job.id),
    workflow_ids: automations.map((item) => item.backend_workflow_id).filter(Boolean),
    error: passed ? null : "System readiness checks failed. Required workflows and agent runtime readiness must pass before activation.",
  };

  const { data, error } = await admin.rpc("record_organization_system_test", {
    p_installation_id: installationId,
    p_passed: passed,
    p_details: details,
    p_actor_user_id: null,
  });
  if (error) throw error;

  return { passed, details, result: data };
}

export async function activateTenantSystem(installationId: string) {
  const admin = createAdminClient();
  const installation = await getInstallation(installationId);
  if (installation.status === "active") {
    await admin.rpc("sync_organization_system_event_routes", { p_organization_id: installation.organization_id });
    return { ok: true, idempotent: true, organization_system_id: installationId, status: "active" };
  }
  if (installation.status !== "testing" || installation.metadata?.test_passed !== true) {
    throw new Error("System must pass testing before activation.");
  }

  const { data: jobs, error: jobsError } = await admin
    .from("automation_provisioning_jobs")
    .select("organization_automation_id,payload,status")
    .eq("organization_id", installation.organization_id)
    .contains("payload", { organization_system_id: installation.id });
  if (jobsError) throw jobsError;

  const automationIds = [...new Set((jobs || []).map((job) => job.organization_automation_id).filter(Boolean))];
  let automations: OrganizationAutomationRow[] = [];
  if (automationIds.length) {
    const { data, error } = await admin
      .from("organization_automations")
      .select("id,backend_workflow_id,status")
      .eq("organization_id", installation.organization_id)
      .in("id", automationIds);
    if (error) throw error;
    automations = (data || []) as OrganizationAutomationRow[];
  }

  const workflowIds = [...new Set(automations.map((item) => item.backend_workflow_id).filter((value): value is string => Boolean(value)))];
  for (const workflowId of workflowIds) {
    await activateN8nWorkflow(workflowId);
  }

  if (automationIds.length) {
    const { error } = await admin
      .from("organization_automations")
      .update({ status: "active", activated_at: new Date().toISOString(), last_error: null })
      .eq("organization_id", installation.organization_id)
      .in("id", automationIds);
    if (error) throw error;
  }

  const { data, error } = await admin.rpc("activate_organization_system_record", {
    p_installation_id: installationId,
    p_actor_user_id: null,
  });
  if (error) throw error;

  const { data: routeSync, error: routeError } = await admin.rpc("sync_organization_system_event_routes", {
    p_organization_id: installation.organization_id,
  });
  if (routeError) throw routeError;

  return { activation: data, route_sync: routeSync };
}
