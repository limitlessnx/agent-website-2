import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type PaymentPlan = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  property_id: string | null;
  property_title: string;
  payment_type: "installment" | "outright";
  agreed_price: number;
  currency: string;
  total_paid: number;
  outstanding_balance: number;
  installment_amount?: number;
  frequency: "weekly" | "biweekly" | "monthly" | string;
  start_at: string;
  end_at: string | null;
  next_reminder_at: string | null;
  last_reminder_at: string | null;
  reminder_template_id: string | null;
  final_due_date?: string | null;
  status: "active" | "paused" | "completed" | "cancelled" | string;
  assigned_agent: string | null;
  handover_agent_name: string | null;
  handover_agent_phone: string | null;
  notes: string | null;
  reminders_enabled: boolean;
  created_at: string;
  updated_at?: string;
};

export type PaymentRecord = {
  id: string;
  organization_id: string;
  payment_plan_id: string;
  amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_reference: string | null;
  notes: string | null;
  created_by?: string | null;
  created_at: string;
};

export type ReminderTemplate = {
  id: string;
  organization_id: string;
  name: string;
  position: number;
  timing_direction: "before" | "on" | "after";
  timing_days: number;
  channel: "placeholder" | "whatsapp" | "email" | "sms";
  message_template: string;
  escalation_action: string;
  enabled: boolean;
};

function scope(organizationId: string) {
  if (!organizationId || organizationId.startsWith("unavailable:")) {
    throw new Error("Active organization context is required.");
  }
  return encodeURIComponent(organizationId);
}

export async function getPaymentPlans(organizationId: string, limit = 100) {
  return supabaseServerRequest<PaymentPlan[]>(
    `payment_plans?organization_id=eq.${scope(organizationId)}&select=*&order=created_at.desc&limit=${limit}`,
  );
}

export async function getPaymentRecords(organizationId: string, limit = 200) {
  return supabaseServerRequest<PaymentRecord[]>(
    `payment_records?organization_id=eq.${scope(organizationId)}&select=*&order=payment_date.desc,created_at.desc&limit=${limit}`,
  );
}

export async function getReminderTemplates(organizationId: string) {
  return supabaseServerRequest<ReminderTemplate[]>(
    `reminder_templates?organization_id=eq.${scope(organizationId)}&select=*&order=position.asc`,
  );
}

export async function createPaymentPlan(payload: Record<string, unknown>) {
  if (!payload.organization_id) throw new Error("organization_id is required for a payment plan.");
  const rows = await supabaseServerRequest<PaymentPlan[]>("payment_plans", { method: "POST", body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("Payment plan was not created. No record was returned by the database.");
  return rows[0];
}

export async function createPaymentRecord(payload: Record<string, unknown>) {
  if (!payload.organization_id) throw new Error("organization_id is required for a payment record.");
  const rows = await supabaseServerRequest<PaymentRecord[]>("payment_records", { method: "POST", body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("Payment was not recorded. No record was returned by the database.");
  return rows[0];
}

export async function updatePaymentRecord(organizationId: string, recordId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentRecord[]>(
    `payment_records?organization_id=eq.${scope(organizationId)}&id=eq.${encodeURIComponent(recordId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  if (rows.length !== 1) {
    throw new Error(rows.length === 0
      ? "Payment could not be updated. The record no longer exists or is outside the active tenant."
      : "Payment update returned an unexpected number of records.");
  }
  return rows[0];
}

export async function deletePaymentRecord(organizationId: string, recordId: string) {
  const rows = await supabaseServerRequest<PaymentRecord[]>(
    `payment_records?organization_id=eq.${scope(organizationId)}&id=eq.${encodeURIComponent(recordId)}`,
    { method: "DELETE" },
  );
  if (rows.length !== 1) {
    throw new Error(rows.length === 0
      ? "Payment could not be deleted. The record no longer exists or is outside the active tenant."
      : "Payment delete returned an unexpected number of records.");
  }
  return rows[0];
}

export async function updatePaymentPlan(organizationId: string, planId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentPlan[]>(
    `payment_plans?organization_id=eq.${scope(organizationId)}&id=eq.${encodeURIComponent(planId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  if (rows.length !== 1) throw new Error("Payment plan could not be updated. The target plan was not found in the active tenant.");
  return rows[0];
}

export async function createReminderTemplate(organizationId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<ReminderTemplate[]>(
    "reminder_templates",
    { method: "POST", body: JSON.stringify({ ...payload, organization_id: organizationId }) },
  );
  if (!rows[0]) throw new Error("Reminder template was not saved.");
  return rows[0];
}

export async function updateReminderTemplate(organizationId: string, templateId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<ReminderTemplate[]>(
    `reminder_templates?organization_id=eq.${scope(organizationId)}&id=eq.${encodeURIComponent(templateId)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  if (rows.length !== 1) throw new Error("Reminder template could not be updated. The target template was not found in the active tenant.");
  return rows[0];
}

export function formatMoney(value: number | string | null | undefined, currency = "NGN") {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function formatNaira(value: number | string | null | undefined) {
  return formatMoney(value, "NGN");
}
