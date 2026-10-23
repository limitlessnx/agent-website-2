import type { PortalAgent, PortalWorkflow, PortalWorkflowRun } from "@/lib/client-portal-data";

export type PhotographyCustomer = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PhotographyBooking = {
  id: string;
  title: string;
  start_at: string | null;
  status: string;
  customer_name: string | null;
  location: string | null;
  assigned_photographer_id?: string | null;
  deposit_status?: string | null;
  delivery_status?: string | null;
  metadataLoaded?: boolean;
};

export type PhotographyDashboardData = {
  businessName: string;
  planCode: string | null;
  fluxCredits: number | null;
  fluxCreditPercentUsed: number;
  whatsappConnected: boolean;
  customers: PhotographyCustomer[];
  bookings: PhotographyBooking[];
  agents: PortalAgent[];
  workflows: PortalWorkflow[];
  runs: PortalWorkflowRun[];
  catalogueCategories: Array<{ name: string; image: string; itemCount: number }>;
};

export function photographyBookingStatus(status: string) {
  const value = status.toLowerCase();
  if (value.includes("confirm")) return "Confirmed";
  if (value.includes("progress") || value.includes("active")) return "In progress";
  if (value.includes("cancel")) return "Cancelled";
  return "Pending";
}

export function photographyCustomerStage(customer: PhotographyCustomer) {
  const value = `${customer.status || "new"} ${JSON.stringify(customer.metadata || {})}`.toLowerCase();
  if (value.includes("book") || value.includes("confirm")) return "Booked";
  if (value.includes("follow") || value.includes("warm")) return "Follow-up";
  if (value.includes("client") || value.includes("customer")) return "Client";
  return "New enquiry";
}
