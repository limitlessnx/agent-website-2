import { createAdminClient } from "@/lib/supabase/admin";

export type AgentCatalogOffering = {
  agent_key: string;
  display_name: string;
  setup_price: number;
  monthly_price: number;
  currency: string;
  metadata: Record<string, unknown>;
};

export type AgentSelection = {
  id: string;
  organization_id: string;
  agent_key: string;
  display_name: string;
  status: string;
  setup_price: number;
  monthly_price: number;
  currency: string;
  configuration: Record<string, unknown>;
};

export type AgentAllocationContext = {
  packageName: string | null;
  packageSlug: string | null;
  maxAgents: number | null;
  unlimited: boolean;
};

function marketplaceKey(slug: string) {
  return slug.trim().toLowerCase().replace(/-/g, "_");
}

export async function listActiveAgentOfferings() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("system_catalog")
    .select("id,slug,name,summary,capabilities,setup_requirements,display_order,metadata")
    .eq("status", "available")
    .eq("category", "core")
    .order("display_order");
  if (error) throw error;

  return (data || []).map((item) => ({
    agent_key: marketplaceKey(String(item.slug)),
    display_name: String(item.name),
    setup_price: 0,
    monthly_price: 0,
    currency: "NGN",
    metadata: {
      ...(item.metadata || {}),
      catalog_source: "system_catalog",
      system_catalog_id: item.id,
      system_slug: item.slug,
      summary: item.summary,
      capabilities: item.capabilities || [],
      setup_requirements: item.setup_requirements || [],
      display_order: item.display_order,
    },
  })) as AgentCatalogOffering[];
}

export async function getOrganizationAgentAllocationContext(organizationId: string): Promise<AgentAllocationContext> {
  const admin = createAdminClient();

  const { data: submission, error: submissionError } = await admin
    .from("client_onboarding_submissions")
    .select("package_id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (submissionError) throw submissionError;

  if (!submission?.package_id) {
    return { packageName: null, packageSlug: null, maxAgents: null, unlimited: false };
  }

  const { data: servicePackage, error: packageError } = await admin
    .from("service_packages")
    .select("name,slug")
    .eq("id", submission.package_id)
    .maybeSingle();
  if (packageError) throw packageError;

  const packageName = servicePackage?.name ? String(servicePackage.name) : null;
  const packageSlug = servicePackage?.slug ? String(servicePackage.slug) : null;
  if (!packageSlug) return { packageName, packageSlug: null, maxAgents: null, unlimited: false };

  const { data: billingPlan, error: planError } = await admin
    .from("billing_plans")
    .select("id")
    .eq("slug", packageSlug)
    .eq("status", "active")
    .maybeSingle();
  if (planError) throw planError;
  if (!billingPlan?.id) return { packageName, packageSlug, maxAgents: null, unlimited: false };

  const { data: entitlement, error: entitlementError } = await admin
    .from("plan_entitlements")
    .select("enabled,limit_value")
    .eq("plan_id", billingPlan.id)
    .eq("feature_key", "agents")
    .maybeSingle();
  if (entitlementError) throw entitlementError;

  if (!entitlement?.enabled) return { packageName, packageSlug, maxAgents: 0, unlimited: false };
  if (entitlement.limit_value === null || entitlement.limit_value === undefined || entitlement.limit_value === "") {
    return { packageName, packageSlug, maxAgents: null, unlimited: true };
  }

  const parsed = Number(entitlement.limit_value);
  return {
    packageName,
    packageSlug,
    maxAgents: Number.isFinite(parsed) ? parsed : null,
    unlimited: false,
  };
}

export async function listOrganizationAgentSelections(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_agent_selections")
    .select("id,organization_id,agent_key,display_name,status,setup_price,monthly_price,currency,configuration")
    .eq("organization_id", organizationId)
    .order("created_at");
  if (error) throw error;
  return (data || []) as AgentSelection[];
}

export async function saveOrganizationAgentSelections(input: {
  organizationId: string;
  agentKeys: string[];
  allocationSource: "tenant" | "admin";
}) {
  const admin = createAdminClient();
  const [offerings, allocationContext] = await Promise.all([
    listActiveAgentOfferings(),
    getOrganizationAgentAllocationContext(input.organizationId),
  ]);
  const offeringMap = new Map(offerings.map((item) => [item.agent_key, item]));
  const selectedKeys = [...new Set(input.agentKeys)].filter((key) => offeringMap.has(key));
  if (!selectedKeys.length) throw new Error("Select at least one marketplace agent.");

  // Commercial plan limits may still be used for tenant self-service, but a Super Admin
  // can allocate whatever workforce the organization actually needs.
  if (input.allocationSource !== "admin" && !allocationContext.unlimited && allocationContext.maxAgents !== null && selectedKeys.length > allocationContext.maxAgents) {
    throw new Error(`${allocationContext.packageName || "This plan"} allows ${allocationContext.maxAgents} agent${allocationContext.maxAgents === 1 ? "" : "s"}.`);
  }

  const { data: existing, error: existingError } = await admin
    .from("organization_agent_selections")
    .select("id,agent_key,status,configuration")
    .eq("organization_id", input.organizationId);
  if (existingError) throw existingError;

  const protectedStatuses = new Set(["paid", "provisioning", "active"]);
  const existingMap = new Map((existing || []).map((item) => [item.agent_key, item]));
  const rows = selectedKeys.map((agentKey) => {
    const offering = offeringMap.get(agentKey)!;
    const current = existingMap.get(agentKey);
    return {
      organization_id: input.organizationId,
      agent_key: agentKey,
      display_name: offering.display_name,
      setup_price: 0,
      monthly_price: 0,
      currency: offering.currency,
      status: current && protectedStatuses.has(current.status) ? current.status : "selected",
      configuration: {
        ...(current?.configuration || {}),
        allocation_source: input.allocationSource,
        admin_plan_override: input.allocationSource === "admin",
        catalog_source: "system_catalog",
        system_catalog_id: offering.metadata.system_catalog_id,
        system_slug: offering.metadata.system_slug,
        allocated_at: new Date().toISOString(),
      },
    };
  });

  const { error: upsertError } = await admin
    .from("organization_agent_selections")
    .upsert(rows, { onConflict: "organization_id,agent_key" });
  if (upsertError) throw upsertError;

  const removableIds = (existing || [])
    .filter((item) => !selectedKeys.includes(item.agent_key) && !protectedStatuses.has(item.status))
    .map((item) => item.id);
  if (removableIds.length) {
    const { error: removeError } = await admin
      .from("organization_agent_selections")
      .delete()
      .eq("organization_id", input.organizationId)
      .in("id", removableIds);
    if (removeError) throw removeError;
  }

  return {
    selections: await listOrganizationAgentSelections(input.organizationId),
    catalog: offerings,
    allocationContext,
  };
}
