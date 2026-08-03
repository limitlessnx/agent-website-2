import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type SystemCategory = "core" | "addon" | "enterprise";
export type SystemCatalogItem = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description?: string | null;
  category: SystemCategory;
  status: string;
  featured: boolean;
  capabilities: string[];
  included_agents: string[];
  setup_requirements: string[];
  display_order: number;
};

export type OrganizationSystem = {
  id: string;
  organization_id: string;
  system_id: string;
  status: string;
  requested_at: string;
  activated_at?: string | null;
  last_error?: string | null;
  system_catalog: SystemCatalogItem | SystemCatalogItem[] | null;
};

function relation<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export async function getMarketplaceSystems() {
  return supabaseServerRequest<SystemCatalogItem[]>(
    "system_catalog?status=in.(available,coming_soon)&select=*&order=display_order.asc",
  );
}

export async function getMarketplaceSystem(slug: string) {
  const rows = await supabaseServerRequest<SystemCatalogItem[]>(
    `system_catalog?slug=eq.${encodeURIComponent(slug)}&status=in.(available,coming_soon)&select=*&limit=1`,
  );
  return rows[0] || null;
}

export async function getOrganizationSystems(organizationId: string) {
  const rows = await supabaseServerRequest<OrganizationSystem[]>(
    `organization_systems?organization_id=eq.${encodeURIComponent(organizationId)}&status=neq.archived&select=*,system_catalog(*)&order=updated_at.desc`,
  );
  return rows.map((row) => ({ ...row, system_catalog: relation(row.system_catalog) }));
}

export async function requestOrganizationSystem(
  organizationId: string,
  userId: string,
  system: Pick<SystemCatalogItem, "id" | "slug" | "name" | "included_agents" | "capabilities">,
) {
  const rows = await supabaseServerRequest<OrganizationSystem[]>("organization_systems?on_conflict=organization_id,system_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      organization_id: organizationId,
      system_id: system.id,
      requested_by: userId,
      status: "awaiting_approval",
      requested_at: new Date().toISOString(),
      configuration: {
        system_slug: system.slug,
        system_name: system.name,
        requested_agents: system.included_agents || [],
        capabilities: system.capabilities || [],
      },
      last_error: null,
    }),
  });

  await supabaseServerRequest(
    `client_onboarding_profiles?organization_id=eq.${encodeURIComponent(organizationId)}&user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        requested_agents: system.included_agents || [],
        current_step: 5,
      }),
    },
  ).catch(() => null);

  return rows[0];
}
