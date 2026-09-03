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
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "fluxknight-core",
    label: "Fluxknight Platform",
    sections: [{
      items: [
        { href: "/dashboard", label: "Command Center", exact: true },
        { href: "/dashboard/lifecycle", label: "Customer Lifecycle" },
        { href: "/dashboard/support", label: "Agent Leo AI Support" },
        { href: "/dashboard/notifications", label: "Admin Notifications" },
        { href: "/dashboard/health", label: "Customer Health" },
        { href: "/dashboard/value", label: "Usage & Value" },
        { href: "/dashboard/expansion", label: "Growth Opportunities" },
        { href: "/dashboard/retention", label: "Retention Risk" },
        { href: "/dashboard/evaluations", label: "Evaluation Leads" },
        { href: "/dashboard/agents", label: "Super Assistant" },
        { href: "/dashboard/activity", label: "Global Activity" },
      ],
    }],
  },
  {
    id: "home-agents",
    label: "Home Agents",
    sections: [
      {
        label: "Limitless Realty",
        items: [
          { href: "/dashboard/limitless/leads", label: "Leads" },
          { href: "/dashboard/limitless/daily-briefs", label: "Daily Briefs" },
          { href: "/dashboard/limitless/followups", label: "Follow-ups" },
          { href: "/dashboard/limitless/properties", label: "Properties" },
          { href: "/dashboard/limitless/media", label: "Knowledge & Media" },
          { href: "/dashboard/limitless/campaigns", label: "Campaigns" },
          { href: "/dashboard/limitless/agentic", label: "Agentic Systems" },
          { href: "/dashboard/workflows", label: "Workflows" },
          { href: "/dashboard/limitless/payments", label: "Payments" },
        ],
      },
      {
        label: "Gencouv",
        items: [
          { href: "/dashboard/gencouv", label: "Overview", exact: true },
          { href: "/dashboard/gencouv#email-control", label: "Email Control" },
          { href: "/dashboard/gencouv#gencouv-inbox", label: "Inbox" },
          { href: "/dashboard/gencouv#lead-board", label: "Lead Board" },
          { href: "/dashboard/gencouv#sequence-status", label: "Sequence Status" },
          { href: "/dashboard/gencouv#acquisition", label: "Acquisition" },
          { href: "/dashboard/gencouv#operations", label: "Operations" },
        ],
      },
    ],
  },
  {
    id: "platform-governance",
    label: "Platform Governance",
    sections: [{
      items: [
        { href: "/dashboard/ai-models", label: "AI Model Control" },
        { href: "/dashboard/knowledge", label: "Knowledge Center" },
        { href: "/dashboard/memory", label: "Memory Center" },
        { href: "/dashboard/settings", label: "Platform Settings" },
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
  const groups = [...ADMIN_NAV_GROUPS, CLIENT_ONBOARDING_NAV]
  return groups.find((group) =>
    group.sections.some((section) =>
      section.items.some((item) => isAdminNavItemActive(pathname, item.href, item.exact)),
    ),
  )?.id
}