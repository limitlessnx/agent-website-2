/** Exact configured system slugs only. Display names never confer internal status. */
export type SystemOrganizationId = "fluxknight" | "limitless-realty" | "gencouv";
export const SYSTEM_ORGANIZATIONS: Array<{ id: SystemOrganizationId; name: string; href: string }> = [
  { id: "fluxknight", name: "Fluxknight", href: "/dashboard" },
  { id: "limitless-realty", name: "Limitless Realty", href: "/dashboard/limitless/leads" },
  { id: "gencouv", name: "Gencouv", href: "/dashboard/gencouv" },
];
export type OrganizationCategory = "platform" | "internal" | "customer";
export function organizationCategory(slug?: string | null): OrganizationCategory {
  if (slug === "fluxknight") return "platform";
  return SYSTEM_ORGANIZATIONS.some(item => item.id === slug) ? "internal" : "customer";
}
export const organizationCategoryLabels: Record<OrganizationCategory, string> = {
  platform: "Platform administration", internal: "Internal organization", customer: "Customer tenant",
};
export function isOrganizationId(id: unknown): boolean {
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
