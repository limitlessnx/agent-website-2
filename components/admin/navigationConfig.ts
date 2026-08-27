export type AdminNavItem = { label: string; href: string; icon?: string }
export type AdminNavGroup = { id: string; label: string; items: AdminNavItem[] }

// Single route authority for dashboard navigation. Presentation components consume this
// model in later phases; no existing navigation component is replaced in Phase 4A.
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { id: "platform", label: "Fluxknight Platform", items: [
    { label: "Command Center", href: "/dashboard" }, { label: "Agent Leo AI Support", href: "/dashboard/support" },
    { label: "Admin Notifications", href: "/dashboard/notifications" }, { label: "Evaluation Leads", href: "/dashboard/evaluations" },
    { label: "Super Assistant", href: "/dashboard/assistant" }, { label: "Global Activity", href: "/dashboard/activity" },
  ] },
  { id: "realty", label: "Limitless Realty", items: [
    { label: "Leads", href: "/dashboard/limitless/leads" }, { label: "Daily Briefs", href: "/dashboard/limitless/daily-briefs" },
    { label: "Follow-ups", href: "/dashboard/limitless/followups" }, { label: "Properties", href: "/dashboard/limitless/properties" },
    { label: "Knowledge & Media", href: "/dashboard/limitless/knowledge" }, { label: "Campaigns", href: "/dashboard/limitless/campaigns" },
    { label: "Agentic Systems", href: "/dashboard/limitless/agentic-systems" }, { label: "Workflows", href: "/dashboard/limitless/workflows" },
    { label: "Payments", href: "/dashboard/limitless/payments" },
  ] },
  { id: "gencouv", label: "Gencouv", items: [
    { label: "Overview", href: "/dashboard/gencouv" }, { label: "Email Control", href: "/dashboard/gencouv/email-control" },
    { label: "Inbox", href: "/dashboard/gencouv/inbox" }, { label: "Lead Board", href: "/dashboard/gencouv/lead-board" },
    { label: "Sequence Status", href: "/dashboard/gencouv/sequences" }, { label: "Acquisition", href: "/dashboard/gencouv/acquisition" },
    { label: "Operations", href: "/dashboard/gencouv/operations" },
  ] },
  { id: "governance", label: "Platform Governance", items: [
    { label: "AI Model Control", href: "/dashboard/ai-models" }, { label: "Knowledge Center", href: "/dashboard/knowledge" },
    { label: "Memory Center", href: "/dashboard/memory" }, { label: "Platform Settings", href: "/dashboard/settings" },
  ] },
  { id: "onboarding", label: "Client Onboarding", items: [
    { label: "New Client", href: "/dashboard/onboarding" }, { label: "Onboarding Queue", href: "/dashboard/onboarding/queue" },
    { label: "Client Registry", href: "/dashboard/clients" },
  ] },
  { id: "public", label: "Public Website", items: [
    { label: "Homepage", href: "/" }, { label: "Services", href: "/services" }, { label: "Pricing", href: "/pricing" },
    { label: "Industries", href: "/industries" }, { label: "Evaluation", href: "/evaluation" },
  ] },
]

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === "/dashboard" || href === "/") return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function getActiveAdminNavGroup(pathname: string) {
  return ADMIN_NAV_GROUPS.find(group => group.items.some(item => isAdminNavItemActive(pathname, item.href)))?.id
}
