"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { normalizeLeadPhone, saveProgressiveLead } from "@/lib/lead-profile-service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPaymentPlan,
  createPaymentRecord,
  deletePaymentRecord,
  updatePaymentRecord,
  updatePaymentPlan,
  createReminderTemplate,
  updateReminderTemplate,
} from "@/lib/limitless-payments";

const CADENCES = new Set(["weekly", "biweekly", "monthly"]);

function money(value: FormDataEntryValue | null) {
  const parsed = Number(String(value || "0").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function cadenceDays(frequency: string) {
  if (frequency === "weekly") return 7;
  if (frequency === "monthly") return 30;
  return 14;
}

function startAtFromForm(value: string) {
  if (!value) return new Date().toISOString();
  const date = new Date(`${value}T08:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid installment start date.");
  return date.toISOString();
}

function reminderStartAtFromForm(mode: string, dateValue: string, timeValue: string) {
  if (mode === "immediate") return new Date().toISOString();
  if (!dateValue || !timeValue) throw new Error("Choose the first reminder date and time, or select Send immediately.");
  const date = new Date(dateValue + "T" + timeValue + ":00+01:00");
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid first reminder date and time.");
  if (date.getTime() <= Date.now()) throw new Error("The scheduled first reminder must be in the future. Select Send immediately for an immediate reminder.");
  return date.toISOString();
}

function endAtFromForm(value: string) {
  if (!value) return null;
  const date = new Date(value + "T23:59:59.999Z");
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid installment end date.");
  return date.toISOString();
}

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/login?next=/dashboard/limitless/payments");
  return session;
}

async function resolveScope() {
  const { organizationId, name } = await resolveAdminOrganizationScope();
  if (!organizationId || organizationId.startsWith("unavailable:")) {
    throw new Error("Active organization context is required.");
  }
  return { organizationId, companyName: name };
}

export async function createPaymentPlanAction(formData: FormData) {
  const session = await requireAdmin();
  const { organizationId } = await resolveScope();

  const contactId = String(formData.get("contact_id") || "").trim() || null;
  const manualName = String(formData.get("client_name_manual") || "").trim();
  const manualPhone = String(formData.get("client_phone_manual") || "").trim();
  const manualEmail = String(formData.get("client_email_manual") || "").trim();
  let clientName = String(formData.get("client_name") || manualName).trim();
  let clientPhone = String(formData.get("client_phone") || manualPhone).trim();
  let clientEmail = String(formData.get("client_email") || manualEmail).trim() || null;

  if (contactId) {
    const { data: contact, error } = await createAdminClient()
      .from("leads")
      .select("id,name,phone,email")
      .eq("organization_id", organizationId)
      .eq("id", contactId)
      .maybeSingle();
    if (error) throw error;
    if (!contact) throw new Error("The selected contact is not available in the active organization.");
    clientName = String(contact.name || "").trim();
    clientPhone = String(contact.phone || "").trim();
    clientEmail = contact.email ? String(contact.email) : null;
  }

  const propertyTitle = String(formData.get("property_title") || "").trim();
  const agreedAmount = money(formData.get("agreed_price"));
  const initialPaid = money(formData.get("amount_paid"));
  const frequency = String(formData.get("frequency") || "biweekly").trim();
  const startAt = startAtFromForm(String(formData.get("start_date") || ""));
  const endAt = endAtFromForm(String(formData.get("end_date") || ""));
  const reminderStartMode = String(formData.get("reminder_start_mode") || "scheduled").trim();
  const remindersEnabled = formData.get("reminders_enabled") === "on";
  const firstReminderAt = remindersEnabled
    ? reminderStartAtFromForm(reminderStartMode, String(formData.get("reminder_start_date") || ""), String(formData.get("reminder_start_time") || ""))
    : null;
  const handoverAgentName = String(formData.get("handover_agent_name") || "Limitless Realty Handover").trim();
  const handoverAgentPhone = String(formData.get("handover_agent_phone") || "2348127753308").trim();
  const currency = String(formData.get("currency") || "NGN").trim().toUpperCase() || "NGN";

  if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) {
    throw new Error("The installment end date cannot be before the start date.");
  }
  if (!clientName || !clientPhone || !propertyTitle) throw new Error("Client, phone, and property/service context are required.");
  if (agreedAmount <= 0) throw new Error("The agreed amount must be greater than zero.");
  if (initialPaid < 0 || initialPaid > agreedAmount) throw new Error("Amount paid must be between zero and the agreed amount.");
  if (!CADENCES.has(frequency)) throw new Error("Invalid installment reminder cadence.");
  if (!handoverAgentName || !handoverAgentPhone) throw new Error("A handover agent name and WhatsApp number are required.");

  if (!contactId && manualName && manualPhone) {
    await saveProgressiveLead(organizationId, {
      name: manualName,
      phone: normalizeLeadPhone(manualPhone),
      email: manualEmail || undefined,
      status: "new",
      source: "installment_client_creation",
      campaign_eligible: true,
    });
  }

  const nextReminderAt = firstReminderAt;

  const plan = await createPaymentPlan({
    organization_id: organizationId,
    contact_id: contactId,
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    property_id: String(formData.get("property_id") || "").trim() || null,
    property_title: propertyTitle,
    agreed_price: agreedAmount,
    currency,
    payment_type: "installment",
    frequency,
    start_at: startAt,
    end_at: endAt,
    next_reminder_at: nextReminderAt,
    handover_agent_name: handoverAgentName,
    handover_agent_phone: handoverAgentPhone,
    notes: String(formData.get("notes") || "").trim() || null,
    reminders_enabled: remindersEnabled,
    status: initialPaid >= agreedAmount ? "completed" : "active",
  });

  if (initialPaid > 0) {
    await createPaymentRecord({
      organization_id: organizationId,
      payment_plan_id: plan.id,
      amount: initialPaid,
      payment_date: String(formData.get("start_date") || new Date().toISOString().slice(0, 10)),
      payment_method: String(formData.get("payment_method") || "other").trim() || "other",
      payment_reference: String(formData.get("payment_reference") || "").trim() || null,
      notes: "Initial amount recorded when the installment plan was created.",
      created_by: session.email,
    });
  }

  revalidatePath("/dashboard/limitless/payments");
  revalidatePath("/dashboard/limitless/payments/installments");
  redirect("/dashboard/limitless/payments/installments?success=installment-created");
}

export async function createOutrightPaymentAction(formData: FormData) {
  const session = await requireAdmin();
  const { organizationId } = await resolveScope();

  const contactId = String(formData.get("contact_id") || "").trim() || null;
  const manualName = String(formData.get("client_name_manual") || "").trim();
  const manualPhone = String(formData.get("client_phone_manual") || "").trim();
  const manualEmail = String(formData.get("client_email_manual") || "").trim();
  let clientName = String(formData.get("client_name") || manualName).trim();
  let clientPhone = String(formData.get("client_phone") || manualPhone).trim();
  let clientEmail = String(formData.get("client_email") || manualEmail).trim() || null;

  if (contactId) {
    const { data: contact, error } = await createAdminClient()
      .from("leads")
      .select("id,name,phone,email")
      .eq("organization_id", organizationId)
      .eq("id", contactId)
      .maybeSingle();
    if (error) throw error;
    if (!contact) throw new Error("The selected contact is not available in the active organization.");
    clientName = String(contact.name || "").trim();
    clientPhone = String(contact.phone || "").trim();
    clientEmail = contact.email ? String(contact.email) : null;
  }

  const propertyTitle = String(formData.get("property_title") || "").trim();
  const amount = money(formData.get("amount"));
  const paymentDateValue = String(formData.get("payment_date") || "").trim();
  const paymentAt = startAtFromForm(paymentDateValue);
  const paymentEndAt = endAtFromForm(paymentDateValue);
  const currency = String(formData.get("currency") || "NGN").trim().toUpperCase() || "NGN";

  if (!clientName || !clientPhone || !propertyTitle) {
    throw new Error("Client, phone, and property are required for an outright payment.");
  }
  if (amount <= 0) throw new Error("The outright payment amount must be greater than zero.");

  if (!contactId && manualName && manualPhone) {
    await saveProgressiveLead(organizationId, {
      name: manualName,
      phone: normalizeLeadPhone(manualPhone),
      email: manualEmail || undefined,
      status: "new",
      source: "outright_property_payment",
      campaign_eligible: true,
    });
  }

  const plan = await createPaymentPlan({
    organization_id: organizationId,
    contact_id: contactId,
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    property_id: String(formData.get("property_id") || "").trim() || null,
    property_title: propertyTitle,
    agreed_price: amount,
    currency,
    payment_type: "outright",
    frequency: "monthly",
    start_at: paymentAt,
    end_at: paymentEndAt,
    next_reminder_at: null,
    handover_agent_name: null,
    handover_agent_phone: null,
    notes: String(formData.get("notes") || "").trim() || "Outright property payment recorded.",
    reminders_enabled: false,
    status: "completed",
  });

  await createPaymentRecord({
    organization_id: organizationId,
    payment_plan_id: plan.id,
    amount,
    payment_date: paymentDateValue || new Date().toISOString().slice(0, 10),
    payment_method: String(formData.get("payment_method") || "other").trim() || "other",
    payment_reference: String(formData.get("payment_reference") || "").trim() || null,
    notes: String(formData.get("notes") || "").trim() || "Outright property payment recorded.",
    created_by: session.email,
  });

  revalidatePath("/dashboard/limitless/payments");
  redirect("/dashboard/limitless/payments");
}

export async function recordPaymentAction(formData: FormData) {
  const session = await requireAdmin();
  const { organizationId } = await resolveScope();
  const planId = String(formData.get("payment_plan_id") || "");
  const amount = money(formData.get("amount"));
  if (!planId || amount <= 0) throw new Error("Select a payment plan and enter a valid payment amount.");

  const { data: plan, error } = await createAdminClient()
    .from("payment_plans")
    .select("id,agreed_price,total_paid,status")
    .eq("organization_id", organizationId)
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  if (!plan) throw new Error("The installment plan is not available in the active organization.");
  if (Number(plan.total_paid || 0) + amount > Number(plan.agreed_price || 0)) {
    throw new Error("Payment cannot exceed the remaining outstanding balance.");
  }

  await createPaymentRecord({
    organization_id: organizationId,
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
  const { organizationId } = await resolveScope();
  const recordId = String(formData.get("payment_record_id") || "");
  const amount = money(formData.get("amount"));
  if (!recordId || amount <= 0) throw new Error("A valid payment record and amount are required.");
  await updatePaymentRecord(organizationId, recordId, {
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
  const { organizationId } = await resolveScope();
  const recordId = String(formData.get("payment_record_id") || "");
  if (!recordId) throw new Error("Payment record is required.");
  await deletePaymentRecord(organizationId, recordId);
  revalidatePath("/dashboard/limitless/payments");
}

export async function updatePlanStatusAction(formData: FormData) {
  await requireAdmin();
  const { organizationId } = await resolveScope();
  const planId = String(formData.get("payment_plan_id") || "");
  const status = String(formData.get("status") || "active");
  const frequency = String(formData.get("frequency") || "").trim();

  if (!["active", "due_soon", "overdue", "completed", "paused", "cancelled"].includes(status)) throw new Error("Invalid installment plan status.");
  if (frequency && !CADENCES.has(frequency)) throw new Error("Invalid installment cadence.");

  const payload: Record<string, unknown> = {
    status,
    reminders_enabled: status === "active",
  };
  if (frequency) {
    payload.frequency = frequency;
    payload.next_reminder_at = new Date(Date.now() + cadenceDays(frequency) * 24 * 60 * 60 * 1000).toISOString();
  }
  if (status === "completed") payload.next_reminder_at = null;

  await updatePaymentPlan(organizationId, planId, payload);
  revalidatePath("/dashboard/limitless/payments");
}

export async function saveReminderTemplateAction(formData: FormData) {
  await requireAdmin();
  const { organizationId } = await resolveScope();
  const id = String(formData.get("template_id") || "");
  const payload = {
    name: String(formData.get("name") || "Installment Payment Reminder").trim(),
    position: 1,
    timing_direction: "on",
    timing_days: 0,
    channel: "whatsapp",
    message_template: String(formData.get("message_template") || "").trim(),
    escalation_action: "Routine customer check-in. No escalation.",
    enabled: formData.get("enabled") === "on",
  };
  if (!payload.message_template) throw new Error("Reminder template content is required.");
  if (id) await updateReminderTemplate(organizationId, id, payload);
  else await createReminderTemplate(organizationId, payload);
  revalidatePath("/dashboard/limitless/payments/installments");
}
