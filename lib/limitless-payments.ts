import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export type PaymentPlan = {
  id: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  property_id: string | null;
  property_title: string;
  agreed_price: number;
  total_paid: number;
  outstanding_balance: number;
  installment_amount: number;
  frequency: string;
  next_due_date: string | null;
  final_due_date: string | null;
  status: string;
  assigned_agent: string | null;
  notes: string | null;
  reminders_enabled: boolean;
  created_at: string;
};

export type PaymentRecord = {
  id: string;
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
  name: string;
  position: number;
  timing_direction: "before" | "on" | "after";
  timing_days: number;
  channel: "placeholder" | "whatsapp" | "email" | "sms";
  message_template: string;
  escalation_action: string;
  enabled: boolean;
};

export async function getPaymentPlans(limit = 100) {
  return supabaseServerRequest<PaymentPlan[]>(`payment_plans?select=*&order=created_at.desc&limit=${limit}`);
}

export async function getPaymentRecords(limit = 200) {
  return supabaseServerRequest<PaymentRecord[]>(`payment_records?select=*&order=payment_date.desc,created_at.desc&limit=${limit}`);
}

export async function getReminderTemplates() {
  return supabaseServerRequest<ReminderTemplate[]>("reminder_templates?select=*&order=position.asc");
}

export async function createPaymentPlan(payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentPlan[]>("payment_plans", { method: "POST", body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("Payment plan was not created. No record was returned by the database.");
  return rows[0];
}

export async function createPaymentRecord(payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentRecord[]>("payment_records", { method: "POST", body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("Payment was not recorded. No record was returned by the database.");
  return rows[0];
}

export async function updatePaymentRecord(recordId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentRecord[]>(`payment_records?id=eq.${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (rows.length !== 1) {
    throw new Error(rows.length === 0
      ? "Payment could not be updated. The record no longer exists or the database rejected the target row."
      : "Payment update returned an unexpected number of records.");
  }
  return rows[0];
}

export async function deletePaymentRecord(recordId: string) {
  const rows = await supabaseServerRequest<PaymentRecord[]>(`payment_records?id=eq.${encodeURIComponent(recordId)}`, {
    method: "DELETE",
  });
  if (rows.length !== 1) {
    throw new Error(rows.length === 0
      ? "Payment could not be deleted. The record no longer exists or the database rejected the target row."
      : "Payment delete returned an unexpected number of records.");
  }
  return rows[0];
}

export async function updatePaymentPlan(planId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<PaymentPlan[]>(`payment_plans?id=eq.${encodeURIComponent(planId)}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (rows.length !== 1) throw new Error("Payment plan could not be updated. The target plan was not found.");
  return rows[0];
}

export async function createReminderTemplate(payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<ReminderTemplate[]>("reminder_templates", { method: "POST", body: JSON.stringify(payload) });
  if (!rows[0]) throw new Error("Reminder template was not saved.");
  return rows[0];
}

export async function updateReminderTemplate(templateId: string, payload: Record<string, unknown>) {
  const rows = await supabaseServerRequest<ReminderTemplate[]>(`reminder_templates?id=eq.${encodeURIComponent(templateId)}`, { method: "PATCH", body: JSON.stringify(payload) });
  if (rows.length !== 1) throw new Error("Reminder template could not be updated. The target template was not found.");
  return rows[0];
}

export function formatNaira(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(value || 0));
}
