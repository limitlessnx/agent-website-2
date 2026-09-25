export type AdminNavItem = {
  label: string
  href: string
  exact?: boolean
  external?: boolean
  meta?: string
}

export type AdminNavSection = {
  label?: string
  items: AdminNavItem[]
}

export type AdminNavGroup = {
  id: string
  label: string
  sections: AdminNavSection[]
}

/**
 * Canonical navigation inventory for the Fluxknight admin dashboard.
 *
 * The dashboard is one platform with many organization workspaces. Routes are
 * preserved, but navigation is grouped by operator intent rather than by the
 * historical implementation phases that created each page.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    sections: [{
      items: [
        { href: "/dashboard", label: "Command Center", exact: true },
      ],
    }],
  },
  {
    id: "operations",
    label: "Operations",
    sections: [{
      items: [
        { href: "/dashboard/control-center", label: "Lifecycle Control" },
        { href: "/dashboard/lifecycle", label: "Customer Lifecycle" },
        { href: "/dashboard/workflows", label: "Automations" },
        { href: "/dashboard/agents", label: "Agents" },
        { href: "/dashboard/conversations", label: "Conversations" },
        { href: "/dashboard/activity", label: "Activity" },
      ],
    }],
  },
  {
    id: "customers",
    label: "Customers",
    sections: [{
      items: [
        { href: "/dashboard/health", label: "Customer Health" },
        { href: "/dashboard/retention", label: "Retention" },
        { href: "/dashboard/expansion", label: "Growth" },
        { href: "/dashboard/value", label: "Usage & Value" },
        { href: "/dashboard/evaluations", label: "Evaluation Leads" },
      ],
    }],
  },
  {
    id: "system-organizations",
    label: "System Organizations",
    sections: [{
      items: [
        { href: "/dashboard/switch/system/fluxknight", label: "Fluxknight" },
        { href: "/dashboard/switch/system/limitless-realty", label: "Limitless Realty" },
        { href: "/dashboard/switch/system/gencouv", label: "Gencouv" },
      ],
    }],
  },
  {
    id: "tenant-organizations",
    label: "Tenant Organizations",
    sections: [{
      items: [
        { href: "/dashboard/clients", label: "Tenant Registry", exact: true },
        { href: "/dashboard/onboarding#new-client", label: "Add Tenant" },
      ],
    }],
  },
  {
    id: "platform",
    label: "Platform",
    sections: [{
      items: [
        { href: "/dashboard/billing", label: "Billing & Credits" },
        { href: "/dashboard/knowledge", label: "Knowledge" },
        { href: "/dashboard/ai-models", label: "AI Models" },
        { href: "/dashboard/memory", label: "Memory" },
        { href: "/dashboard/settings", label: "Settings" },
      ],
    }],
  },
]

export const PUBLIC_SITE_NAV: AdminNavItem[] = [
  { href: "/", label: "Homepage", external: true },
  { href: "/services", label: "Services", external: true },
  { href: "/pricing", label: "Pricing", external: true },
  { href: "/industries", label: "Industries", external: true },
  { href: "/evaluation", label: "Evaluation", external: true },
]

export const CLIENT_ONBOARDING_NAV: AdminNavGroup = {
  id: "client-onboarding",
  label: "Client Onboarding",
  sections: [
    {
      label: "Onboarding",
      items: [
        { href: "/dashboard/onboarding#new-client", label: "New Client" },
        { href: "/dashboard/onboarding#queue", label: "Onboarding Queue" },
        { href: "/dashboard/clients", label: "Client Registry", exact: true },
      ],
    },
    {
      label: "Client Workspaces",
      items: [],
    },
  ],
}

export function buildClientWorkspaceNav(tenants: Array<{ organizationId: string; name: string; status: string }>): AdminNavSection {
  return {
    label: "Client Workspaces",
    items: tenants.map((tenant) => ({
      href: `/dashboard/clients?organizationId=${encodeURIComponent(tenant.organizationId)}`,
      label: tenant.name,
      meta: tenant.status.replaceAll("_", " "),
    })),
  }
}

export function isAdminNavItemActive(pathname: string, href: string, exact = false) {
  const route = href.split("#")[0].split("?")[0]
  return exact ? pathname === route : pathname === route || pathname.startsWith(`${route}/`)
}

export function getActiveAdminNavGroup(pathname: string) {
  return ADMIN_NAV_GROUPS.find((group) =>
    group.sections.some((section) =>
      section.items.some((item) => isAdminNavItemActive(pathname, item.href, item.exact)),
    ),
  )?.id
}
