import type { Lead, PropertyRecord } from "@/lib/limitless-data";
import type { PortalAgent, PortalWorkflow, PortalWorkflowRun } from "@/lib/client-portal-data";
import type { FluxPlanCode } from "@/lib/fluxknight-plans";

export type OrganizationDashboardAppointment = {
  id: string;
  title: string;
  start_at: string | null;
  status: string;
  customer_name: string | null;
  location: string | null;
};

export type OrganizationDashboardData = {
  businessName: string;
  industryName: string;
  description: string;
  planCode: FluxPlanCode | null;
  fluxCredits: number | null;
  fluxCreditPercentUsed: number;
  properties: PropertyRecord[];
  leads: Lead[];
  appointments: OrganizationDashboardAppointment[];
  agents: PortalAgent[];
  workflows: PortalWorkflow[];
  runs: PortalWorkflowRun[];
  whatsappConnected: boolean;
};

export function leadPipelineStatus(lead: Lead) {
  const status = `${lead.status || "new"} ${lead.score || ""}`.toLowerCase();
  if (status.includes("negotiat") || status.includes("hot")) return "Negotiation";
  if (status.includes("inspection") || status.includes("viewing")) return "Viewing Scheduled";
  if (status.includes("qualif") || status.includes("warm")) return "Qualified";
  return "New Enquiries";
}

export function formatDashboardPrice(value?: string) {
  return value?.trim() || "Price pending";
}
