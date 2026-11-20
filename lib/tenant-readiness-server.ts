import { getIndustryExperience } from "@/lib/industryExperience";
import { getHotelInventoryReadiness } from "@/lib/hotel-inventory-readiness";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationPackageSnapshot } from "@/lib/organization-package-service";
import { evaluateTenantReadiness, type ReadinessCheck } from "@/lib/tenant-readiness";

// Preserve unknown industry identity; unrelated unknown labels must not both match "general".
function industryIdentity(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const experience = getIndustryExperience(raw);
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  return experience.slug === "general" && !["general", "business"].includes(key) ? key : experience.slug;
}

/** Caller must authorize platform admin access before requesting a tenant snapshot. */
export async function getTenantReadiness(organizationId: string) {
  const admin = createAdminClient();
  const results = await Promise.all([
    admin.from("organizations").select("id,status,metadata").eq("id", organizationId).maybeSingle(),
    admin.from("organization_memberships").select("id,membership_roles(roles(slug))").eq("organization_id", organizationId).eq("status", "active"),
    admin.from("organization_template_assignments").select("status,metadata,organization_templates(agents,industry,status)").eq("organization_id", organizationId),
    admin.from("organization_subscriptions").select("status,current_period_end,trial_ends_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(1),
    admin.from("agents").select("id,slug,configuration,updated_at").eq("organization_id", organizationId),
    admin.from("agent_runtime_readiness").select("agent_id,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,workflow_ready").eq("organization_id", organizationId),
    admin.from("agent_test_runs").select("agent_id,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    admin.from("agent_approval_requests").select("agent_id,status,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    admin.from("projects").select("metadata").eq("organization_id", organizationId).eq("slug", "platform-starter"),
    admin.from("client_onboarding_profiles").select("status,industry").eq("organization_id", organizationId).limit(1),
    admin.from("agent_families").select("id,template_id,agent_templates(status)").eq("organization_id", organizationId),
    admin.from("organization_systems").select("status").eq("organization_id", organizationId),
    admin.from("automation_provisioning_jobs").select("status").eq("organization_id", organizationId),
  ]);
  const [org, members, assignments, subscriptions, agents, runtime, tests, approvals, projects, profiles, families, systems, jobs] = results;
  let unavailable = results.some(result => Boolean(result.error));
  const pkg = await getOrganizationPackageSnapshot(organizationId).catch(() => { unavailable = true; return null; });
  const agentRows = agents.data || [];
  const allRuntime = (key: string) => agentRows.length > 0 && agentRows.every(agent => (runtime.data || []).some(row => row.agent_id === agent.id && (row as Record<string, unknown>)[key] === true));
  const latestPass = (rows: Array<{ agent_id: string; status: string; created_at: string }>, status: string) => agentRows.length > 0 && agentRows.every(agent => {
    const latest = rows.find(row => row.agent_id === agent.id);
    return latest?.status === status && Date.parse(latest.created_at) >= Date.parse(agent.updated_at);
  });
  const industry = String((org.data?.metadata as Record<string, unknown> | null)?.industry || (org.data?.metadata as Record<string, unknown> | null)?.industry_slug || profiles.data?.[0]?.industry || "");
  const identity = industryIdentity(industry);
  const currentAssignments = (assignments.data || []).filter(row => !["archived", "inactive"].includes(row.status));
  const activeAssignments = currentAssignments.filter(row => row.status === "active");
  const assignmentFailed = currentAssignments.some(row => row.status === "failed");
  const assignmentInProgress = currentAssignments.some(row => ["provisioning", "pending", "queued", "running"].includes(row.status));
  const matchingAssignments = activeAssignments.filter(row => {
    const template = row.organization_templates as unknown as { industry?: string; status?: string } | null;
    return Boolean(identity && template?.status === "active" && industryIdentity(template.industry) === identity);
  });
  const templateMismatch = matchingAssignments.length !== activeAssignments.length;
  const templateReady = !templateMismatch && currentAssignments.every(row => row.status === "active") && Boolean(matchingAssignments.length || families.data?.some(row => row.template_id && (row.agent_templates as unknown as { status: string } | null)?.status === "published"));
  const requiredKeys = matchingAssignments.flatMap(row => {
    const template = row.organization_templates as unknown as { agents?: string[] } | null;
    return template?.agents || [];
  });
  const agentsReady = templateReady && agentRows.length > 0 && requiredKeys.every(key => agentRows.some(agent => (agent.configuration as Record<string, unknown> | null)?.agent_key === key || agent.slug === key.replaceAll("_", "-")));
  const subscription = subscriptions.data?.[0];
  const expiry = subscription?.status === "trialing" ? subscription.trial_ends_at : subscription?.current_period_end;
  const subscriptionReady = Boolean(subscription && ["active", "trialing"].includes(subscription.status) && expiry && Date.parse(expiry) > Date.now());
  const effective = new Map((pkg?.packageEntitlements || []).map(row => [String(row.feature_key), row.enabled === true]));
  for (const row of pkg?.organizationOverrides || []) if (!row.expires_at || Date.parse(String(row.expires_at)) > Date.now()) effective.set(String(row.feature_key), row.enabled === true);
  let catalogReady = false;
  let catalogRequired = false;
  if (identity === "hotels") {
    catalogRequired = true;
    const value = await getHotelInventoryReadiness(organizationId, admin).catch(() => { unavailable = true; return null; });
    catalogReady = Boolean(value && Number(value.activeRoomTypes) > 0 && Number(value.activeRooms) > 0 && value.unpublishedRoomTypes === 0);
  } else if (identity === "photography-studio" || identity === "real-estate") {
    catalogRequired = true;
    // Existing tenant photography pages use photography_catalogue_items; legacy admin
    // studio pages use studio_catalog_items. Read both without copying either catalog.
    const tables = identity === "photography-studio" ? ["photography_catalogue_items", "studio_catalog_items"] : ["properties"];
    const catalogs = await Promise.all(tables.map(table => admin.from(table).select("id").eq("organization_id", organizationId).eq("status", "active").limit(1)));
    if (catalogs.some(result => result.error)) unavailable = true;
    catalogReady = !catalogs.some(result => result.error) && catalogs.some(result => Boolean(result.data?.length));
  }
  const base = `/dashboard/clients/${encodeURIComponent(organizationId)}/setup`;
  const checks: ReadinessCheck[] = [];
  const add = (key: string, label: string, ready: boolean, action: string, anchor = "brief") => checks.push({ key, label, ready, action, href: `${base}#${anchor}` });
  const inactive = Boolean(org.data && org.data.status !== "active");
  if (inactive) add("lifecycle", "Organization lifecycle", false, `Organization is ${org.data!.status}. Review its lifecycle in organization management before testing or activation.`);
  add("owner", "Organization and owner", Boolean(org.data && members.data?.some(row => (row.membership_roles as unknown as Array<{ roles: { slug: string } | null }>).some(binding => binding.roles?.slug === "owner"))), "Assign an active owner in Team & Access.");
  add("template", "Industry template", templateReady, templateMismatch ? `Review the active starter assignment: its template must be active and match ${industry || "the business industry"}. Preserve published agents and customer configuration during correction.` : "Apply the correct industry template; use starter configuration only.");
  add("subscription", "Subscription and entitlements", subscriptionReady && [...effective.values()].some(Boolean), "Review the current subscription and effective package entitlements.", "launch");
  add("agents", "Required AI agents", agentsReady && allRuntime("prompt_ready"), "Allocate and configure every required AI agent.", "agents");
  add("integrations", "Communication integrations", allRuntime("integrations_ready"), "Connect the communication channels required by the assigned agents.", "whatsapp");
  add("knowledge", "Business knowledge and catalogs", allRuntime("knowledge_ready") && allRuntime("business_profile_ready"), "Review approved business knowledge and the industry catalog in the tenant workspace.", "brief");
  if (catalogRequired) add("catalog", "Industry catalog", catalogReady, "Review this business's own inventory and published catalog in its industry workspace.");
  const metadata = (projects.data || []).map(row => row.metadata as Record<string, unknown> | null);
  const running = metadata.find(row => row?.onboarding_sync_running === true);
  const started = Date.parse(String(running?.onboarding_sync_started_at));
  const stale = Boolean(running && (!Number.isFinite(started) || Date.now() - started > 15 * 60_000));
  const deploymentFailed = systems.data?.some(row => row.status === "needs_attention") || jobs.data?.some(row => row.status === "failed");
  const deploymentRunning = systems.data?.some(row => row.status === "provisioning") || jobs.data?.some(row => ["queued", "running"].includes(row.status));
  const syncState = inactive || stale || deploymentFailed || assignmentFailed || metadata.some(row => row?.n8n_sync_status === "needs_attention") ? "needs_attention" : running || deploymentRunning || assignmentInProgress ? "provisioning" : "";
  add("automation", "Automation deployment", allRuntime("workflow_ready") && !syncState, "Review deployment evidence and retry the saved starter setup if needed.", "configuration");
  add("tests", "Test results", latestPass(tests.data || [], "passed"), "Run controlled tests for every agent after its latest configuration change.", "testing");
  add("approval", "Activation approval", latestPass(approvals.data || [], "approved"), "Obtain approval for the current agent configuration before activation.", "launch");
  for (const check of checks) if (["owner", "subscription", "template", "catalog", "lifecycle"].includes(check.key)) check.href = `/dashboard/clients/${encodeURIComponent(organizationId)}/manage`;
  if (unavailable) add("evidence", "Readiness evidence", false, "Readiness could not be fully loaded. Refresh or ask an administrator to review access.");
  return evaluateTenantReadiness({ checks, provisioning: templateMismatch ? "needs_attention" : syncState, live: profiles.data?.[0]?.status === "live", hasSetup: Boolean(assignments.data?.length || agentRows.length), unavailable });
}
