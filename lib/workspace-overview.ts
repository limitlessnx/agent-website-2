import type { IndustryExperience } from "@/lib/industryExperience";
import type { getPortalCapabilities } from "@/lib/portal-access";
import { planIncludesFeature } from "@/lib/fluxknight-plans";
import type { ClientPortalSummary } from "@/lib/client-portal-data";

export type WorkspaceCapabilities = Awaited<ReturnType<typeof getPortalCapabilities>>;
export type WorkspaceModule = {
  key: string;
  title: string;
  description: string;
  status: "available" | "setup" | "unavailable" | "plan" | "preview";
  statusLabel: string;
  href?: string;
  action?: string;
};

export function getWorkspaceHealth(summary: ClientPortalSummary, accessUnavailable: boolean) {
  if (accessUnavailable || (summary.unavailableSources?.length || 0) > 0) return { state: "unavailable", label: "Status unavailable", description: "Some workspace information could not be loaded." } as const;
  if (summary.runs.some((run) => ["failed", "timed_out", "cancelled", "error"].includes(run.status.toLowerCase())) || summary.agents.some((agent) => ["error", "disabled", "paused"].includes(agent.status.toLowerCase()))) return { state: "attention", label: "Needs attention", description: "Recorded setup or automation issues need review." } as const;
  if (!summary.agents.length && !summary.workflows.length) return { state: "setup", label: "Setup required", description: "Review your business information and installed systems." } as const;
  return { state: "observed", label: "No recent issues recorded", description: "No failures were found in the loaded setup and recent activity." } as const;
}

/** Presentation only: destinations retain their own server-side authorization. */
export function getWorkspaceModules(input: {
  experience: IndustryExperience;
  capabilities: WorkspaceCapabilities | null;
  preview?: boolean;
  planCode?: string | null;
  trial?: boolean;
}): WorkspaceModule[] {
  const { experience, capabilities: caps } = input;
  if (!caps) return [];
  const modules: WorkspaceModule[] = [];
  function add(key: string, title: string, description: string, allowed: boolean, href: string, action = "Open") {
    if (allowed) modules.push({ key, title, description, href, action, status: "available", statusLabel: "Available" });
  }
  add("customers", experience.customerLabel, "Review customer records, enquiries and your team's handoffs.", caps.customers, "/portal/customers", "Open CRM");
  add("conversations", "Conversations", "Review customer conversations and permitted replies.", caps.conversations, "/portal/conversations", "View conversations");
  add("information", "Business information", `Review your business profile, ${experience.inventoryLabel.toLowerCase()} information and handoff contacts. Specialist catalogs stay in their configured systems.`, caps.isOwner || caps.permissions.some((key) => ["organization.view", "organization.read", "organization.manage"].includes(key)), "/portal/settings", "Review business information");
  if (experience.features.appointments && (caps.permissions.some((key) => ["appointments.view", "appointments.manage"].includes(key)) || input.preview)) {
    const status = caps.systemStates?.["appointment-system"];
    modules.push({
      key: "appointments", title: experience.appointmentLabel,
      description: caps.systemsUnavailable ? "Calendar availability could not be checked. Reload before relying on setup status."
        : status === "active" ? "Review calendar-backed requests and appointments."
        : status ? "Review your installed Appointment System before using its calendar."
        : "An Appointment System must be configured before calendar-backed intake is available.",
      status: caps.systemsUnavailable ? "unavailable" : status === "active" ? "available" : "setup",
      statusLabel: caps.systemsUnavailable ? "Status unavailable" : status === "active" ? "Available" : "Setup required",
      href: !caps.systemsUnavailable && status === "active" && caps.appointments ? "/portal/appointments" : caps.systems ? "/portal/systems" : undefined,
      action: status === "active" ? "Open calendar" : "Review setup",
    });
  }
  add("systems", "AI team & systems", "Review installed agents, setup approvals and automation controls.", caps.systems, "/portal/systems", "Review systems");
  if (caps.systems) modules.push({
    key: "followups", title: "Follow-ups & reminders",
    description: !input.planCode ? "Your plan could not be verified. Review plan access before enabling automation."
      : input.trial || !planIncludesFeature(input.planCode, "follow_ups") ? "An eligible plan and approved setup are required. Existing customer records remain accessible."
      : "Included plan access does not activate automation. Review the installed systems and approval requirements.",
    status: !input.planCode ? "unavailable" : input.trial || !planIncludesFeature(input.planCode, "follow_ups") ? "plan" : "setup",
    statusLabel: !input.planCode ? "Plan unavailable" : input.trial || !planIncludesFeature(input.planCode, "follow_ups") ? "Plan required" : "Review configuration",
    href: input.planCode && !input.trial && planIncludesFeature(input.planCode, "follow_ups") ? "/portal/systems" : caps.billing ? "/portal/billing" : undefined,
    action: input.planCode && !input.trial && planIncludesFeature(input.planCode, "follow_ups") ? "Review follow-ups" : "Review plan",
  });
  add("integrations", "Connections", "Review communication channels and calendar authorization.", caps.integrations, "/portal/integrations", "Review connections");
  add("analytics", "Analytics", "Review the operational reports your role permits.", caps.analytics, "/portal/analytics", "View analytics");
  add("team", "Team & access", "Review team membership. Access changes remain subject to your role and plan.", caps.team, "/portal/team", "View team");
  add("billing", "Plan & usage", "Review the current plan, included access and credit usage.", caps.billing, "/portal/billing", "Review usage");
  if (input.preview) return modules.map((module) => ({ ...module, href: undefined, action: undefined, status: "preview", statusLabel: "Read-only preview" }));
  return modules;
}
