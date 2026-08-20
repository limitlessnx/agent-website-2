"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { createPaymentPlan, createPaymentRecord, deletePaymentRecord, updatePaymentRecord, updatePaymentPlan, createReminderTemplate, updateReminderTemplate } from "@/lib/limitless-payments";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/limitless/payments");
  return session;
}

function money(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function createPaymentPlanAction(formData: FormData) {
  await requireAdmin();
  const clientName = String(formData.get("client_name") || "").trim();
  const clientPhone = String(formData.get("client_phone") || "").trim();
  const propertyTitle = String(formData.get("property_title") || "").trim();
  if (!clientName || !clientPhone || !propertyTitle) throw new Error("Client name, phone, and property are required.");
  await createPaymentPlan({
    client_name: clientName,
    client_phone: clientPhone,
    client_email: String(formData.get("client_email") || "").trim() || null,
    property_id: String(formData.get("property_id") || "").trim() || null,
    property_title: propertyTitle,
    agreed_price: money(formData.get("agreed_price")),
    installment_amount: money(formData.get("installment_amount")),
    frequency: String(formData.get("frequency") || "custom"),
    next_due_date: String(formData.get("next_due_date") || "") || null,
    final_due_date: String(formData.get("final_due_date") || "") || null,
    assigned_agent: String(formData.get("assigned_agent") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    reminders_enabled: formData.get("reminders_enabled") === "on",
  });
  revalidatePath("/dashboard/limitless/payments");
}

export async function recordPaymentAction(formData: FormData) {
  const session = await requireAdmin();
  const planId = String(formData.get("payment_plan_id") || "");
  const amount = money(formData.get("amount"));
  if (!planId || amount <= 0) throw new Error("Select a payment plan and enter a valid amount.");
  await createPaymentRecord({
    payment_plan_id: planId,
    amount,
    payment_date: String(formData.get("payment_date") || new Date().toISOString().slice(0, 10)),
    payment_method: String(formData.get("payment_method") || "").trim() || null,
    payment_reference: String(formData.get("payment_reference") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
    created_by: session.email,
  });
  revalidatePath("/dashboard/limitless/payments");
}

export async function updatePaymentRecordAction(formData: FormData) {
  await requireAdmin();
  const recordId = String(formData.get("payment_record_id") || "");
  const amount = money(formData.get("amount"));
  if (!recordId || amount <= 0) throw new Error("A valid payment record and amount are required.");
  await updatePaymentRecord(recordId, {
    amount,
    payment_date: String(formData.get("payment_date") || "").trim() || new Date().toISOString().slice(0, 10),
    payment_method: String(formData.get("payment_method") || "").trim() || null,
    payment_reference: String(formData.get("payment_reference") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || null,
  });
  revalidatePath("/dashboard/limitless/payments");
}

export async function deletePaymentRecordAction(formData: FormData) {
  await requireAdmin();
  const recordId = String(formData.get("payment_record_id") || "");
  if (!recordId) throw new Error("Payment record is required.");
  await deletePaymentRecord(recordId);
  revalidatePath("/dashboard/limitless/payments");
}

export async function updatePlanStatusAction(formData: FormData) {
  await requireAdmin();
  const planId = String(formData.get("payment_plan_id") || "");
  const status = String(formData.get("status") || "active");
  await updatePaymentPlan(planId, { status, reminders_enabled: !["completed", "cancelled", "paused"].includes(status) });
  revalidatePath("/dashboard/limitless/payments");
}

export async function saveReminderTemplateAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("template_id") || "");
  const payload = {
    name: String(formData.get("name") || "Reminder"),
    position: Number(formData.get("position") || 1),
    timing_direction: String(formData.get("timing_direction") || "before"),
    timing_days: Number(formData.get("timing_days") || 0),
    channel: String(formData.get("channel") || "placeholder"),
    message_template: String(formData.get("message_template") || "[Reminder message placeholder]"),
    escalation_action: String(formData.get("escalation_action") || "[Escalation placeholder]"),
    enabled: formData.get("enabled") === "on",
  };
  if (id) await updateReminderTemplate(id, payload);
  else await createReminderTemplate(payload);
  revalidatePath("/dashboard/limitless/payments");
}
