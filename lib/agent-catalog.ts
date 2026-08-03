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

export async function listActiveAgentOfferings() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("agent_catalog_offerings")
    .select("agent_key,display_name,setup_price,monthly_price,currency,metadata")
    .eq("is_active", true)
    .order("display_name");
  if (error) throw error;
  return (data || []) as AgentCatalogOffering[];
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
  const offerings = await listActiveAgentOfferings();
  const offeringMap = new Map(offerings.map((item) => [item.agent_key, item]));
  const selectedKeys = [...new Set(input.agentKeys)].filter((key) => offeringMap.has(key));
  if (!selectedKeys.length) throw new Error("Select at least one active agent offering.");

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
      setup_price: offering.setup_price,
      monthly_price: offering.monthly_price,
      currency: offering.currency,
      status: current && protectedStatuses.has(current.status) ? current.status : "selected",
      configuration: {
        ...(current?.configuration || {}),
        allocation_source: input.allocationSource,
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
  };
}
