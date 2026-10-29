import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { assertFluxFeatureAccess, reserveFluxCredits } from "@/lib/flux-credits";
import { followupErrorSummary, LIMITLESS_REALTY_ORGANIZATION_ID, limitlessPhoneCandidates } from "@/lib/limitless-followup-contract";

const LEGACY_EXPECTED_VARIABLE_KEYS = [
  "client_name",
  "property_title",
  "amount_paid",
  "outstanding_balance",
  "handover_agent_name",
  "handover_agent_phone",
  "company_name",
] as const;
const LIMITLESS_EXPECTED_VARIABLE_KEYS = [
  "client_name",
  "property_title",
  "amount_paid",
  "outstanding_balance",
  "handover_agent_name",
  "handover_agent_phone",
  "company_name",
] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const LAGOS_TIME_ZONE = "Africa/Lagos";
const REMINDER_LOCAL_TIME = "10:00:00";

type ReminderDirection = "before" | "on" | "after";
type ReminderTemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  timing_direction: ReminderDirection;
  timing_days: number;
  channel: string;
  message_template: string;
  enabled: boolean;
};
type ApprovedTemplate = {
  template_name: string;
  language_code: string;
  variable_keys: string[];
  company_name?: string;
  handover_agent_phone?: string;
};
type PaymentPlanRow = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  client_name: string;
  client_phone: string;
  property_title: string;
  currency: string;
  agreed_price: number | string | null;
  total_paid: number | string | null;
  outstanding_balance: number | string | null;
  installment_amount: number | string | null;
  payment_type: string;
  frequency: string;
  start_at: string | null;
  next_reminder_at: string | null;
  next_due_date: string | null;
  final_due_date: string | null;
  reminder_template_id: string | null;
  handover_agent_name: string | null;
  handover_agent_phone: string | null;
  status: string;
  reminders_enabled: boolean;
};
type ReminderValues = Record<string, string>;

async function checkLeadOptOut(admin: ReturnType<typeof createAdminClient>, plan: Pick<PaymentPlanRow, "organization_id" | "contact_id" | "client_phone">) {
  if (plan.contact_id) {
    const { data, error } = await admin.from("leads").select("id,opted_out")
      .eq("organization_id", plan.organization_id).eq("id", plan.contact_id).maybeSingle();
    return { safe: !error && Boolean(data), optedOut: data?.opted_out === true };
  }
  const candidates = limitlessPhoneCandidates(plan.client_phone);
  if (!candidates.length) return { safe: false, optedOut: false };
  const { data, error } = await admin.from("leads").select("id")
    .eq("organization_id", plan.organization_id).eq("opted_out", true).in("phone", candidates).limit(1);
  return { safe: !error, optedOut: Boolean(data?.length) };
}

function parseLagosDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [year, month, day] = raw.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return raw;
}

function shiftLocalDate(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function computeReminderOccurrence(nextDueDate: string, direction: ReminderDirection, timingDays: number) {
  const dueDate = parseLagosDate(nextDueDate);
  if (!dueDate || !Number.isInteger(timingDays) || timingDays < 0) return null;
  const offset = direction === "before" ? -timingDays : direction === "after" ? timingDays : 0;
  const occurrenceDate = shiftLocalDate(dueDate, offset);
  const scheduled = new Date(`${occurrenceDate}T${REMINDER_LOCAL_TIME}+01:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  return { occurrenceDate, scheduledFor: scheduled.toISOString() };
}

export function computeLimitlessReminderOccurrence(nextDueDate: string, direction: ReminderDirection, timingDays: number, nextReminderAt?: string | null) {
  const initial = computeReminderOccurrence(nextDueDate, direction, timingDays);
  if (!initial) return null;
  let occurrenceDate = initial.occurrenceDate;
  let cursorScheduledFor: string | null = null;
  if (nextReminderAt) {
    const cursor = new Date(nextReminderAt);
    if (Number.isNaN(cursor.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(cursor);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    occurrenceDate = `${values.year}-${values.month}-${values.day}`;
    cursorScheduledFor = cursor.toISOString();
  }
  const scheduled = new Date(`${occurrenceDate}T${REMINDER_LOCAL_TIME}+01:00`);
  if (Number.isNaN(scheduled.getTime())) return null;
  if (cursorScheduledFor && new Date(cursorScheduledFor).getTime() !== scheduled.getTime()) return null;
  return { occurrenceDate, scheduledFor: cursorScheduledFor || scheduled.toISOString() };
}

export function classifyReminderOccurrence(occurrenceDate: string, scheduledFor: string, now: Date) {
  if (!parseLagosDate(occurrenceDate)) return "invalid" as const;
  const scheduled = new Date(scheduledFor);
  if (Number.isNaN(scheduled.getTime())) return "invalid" as const;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const today = `${values.year}-${values.month}-${values.day}`;
  if (occurrenceDate < today) return "missed" as const;
  if (occurrenceDate > today || scheduled.getTime() > now.getTime()) return "waiting" as const;
  return "due" as const;
}

function renderLocalTemplate(template: string, values: ReminderValues) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: currency || "NGN", maximumFractionDigits: 0 }).format(value);
}

type MoneyCents = number;

function parseMoneyCents(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function formatMoneyCents(cents: MoneyCents, currency: string) {
  if (!Number.isSafeInteger(cents) || cents < 0) throw new Error("Installment reminder amount is outside the supported precision.");
  const code = String(currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) throw new Error("Installment reminder currency is invalid.");
  let parts: Intl.NumberFormatPart[];
  try {
    parts = new Intl.NumberFormat("en-NG", { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).formatToParts(0);
  } catch {
    throw new Error("Installment reminder currency is invalid.");
  }
  const minorUnits = String(cents).padStart(3, "0");
  const whole = minorUnits.slice(0, -2);
  const fraction = minorUnits.slice(-2);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = parts.find((part) => part.type === "currency")?.value || code;
  return `${symbol}${grouped}.${fraction}`;
}

function validatedLimitlessMoney(plan: PaymentPlanRow) {
  const agreedPrice = parseMoneyCents(plan.agreed_price);
  const paidToDate = parseMoneyCents(plan.total_paid);
  const outstandingBalance = parseMoneyCents(plan.outstanding_balance);
  const installmentAmount = parseMoneyCents(plan.installment_amount);
  if (agreedPrice === null || paidToDate === null || outstandingBalance === null || installmentAmount === null
    || agreedPrice <= 0 || installmentAmount < 0 || installmentAmount > agreedPrice
    || paidToDate > agreedPrice || outstandingBalance !== agreedPrice - paidToDate) {
    throw new Error("Installment reminder financial values are invalid or inconsistent.");
  }
  return { agreedPrice, paidToDate, outstandingBalance, installmentAmount };
}

function cadenceDays(frequency: string) {
  const normalized = frequency.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["weekly", "week", "every_week", "7_days", "7_day"].includes(normalized)) return 7;
  if (["monthly", "month", "every_month", "30_days", "30_day"].includes(normalized)) return 30;
  return 14;
}

function exactTemplateContract(config: Record<string, unknown>, organizationId: string) {
  const variableKeys = Array.isArray(config.variable_keys) ? config.variable_keys.map(String) : [];
  const metadata = config.metadata && typeof config.metadata === "object" ? config.metadata as Record<string, unknown> : {};
  const approvedOrder = Array.isArray(metadata.approved_variable_order) ? metadata.approved_variable_order.map(String) : [];
  const expectedKeys = organizationId === LIMITLESS_REALTY_ORGANIZATION_ID ? LIMITLESS_EXPECTED_VARIABLE_KEYS : LEGACY_EXPECTED_VARIABLE_KEYS;
  const matchesApprovedOrder = organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID
    || (approvedOrder.length === expectedKeys.length && approvedOrder.every((key, index) => key === expectedKeys[index]));
  return variableKeys.length === expectedKeys.length
    && variableKeys.every((key, index) => key === expectedKeys[index])
    && matchesApprovedOrder;
}

function explicitDeliveryFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: unknown; response?: unknown };
  const response = candidate.response && typeof candidate.response === "object" ? candidate.response as { status?: unknown } : {};
  const status = typeof candidate.status === "number" ? candidate.status : response.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 408;
}

function attemptError(error: unknown) {
  return followupErrorSummary(error) || "Delivery failed; raw provider details are restricted.";
}

function valuesForPlan(plan: PaymentPlanRow, organizationName: string, approved: ApprovedTemplate, isLimitless: boolean): ReminderValues {
  // if (!isLimitless) return legacyValues; legacyValues is built only in the legacy branch below.
  if (!isLimitless) {
    return {
      client_name: String(plan.client_name || "there"),
      property_title: String(plan.property_title || "your property"),
      amount_paid: formatMoney(Number(plan.total_paid || 0), String(plan.currency || "NGN")),
      outstanding_balance: formatMoney(Number(plan.outstanding_balance || 0), String(plan.currency || "NGN")),
      handover_agent_name: String(plan.handover_agent_name || "our team"),
      handover_agent_phone: String(plan.handover_agent_phone || approved.handover_agent_phone || ""),
      company_name: organizationName,
    };
  }

  if (!parseLagosDate(plan.next_due_date)) throw new Error("Installment reminder schedule is missing a valid next due date.");
  const money = validatedLimitlessMoney(plan);
  if (!String(plan.client_name || "").trim() || !String(plan.property_title || "").trim()) throw new Error("Installment reminder requires the verified client name and property title.");
  if (!String(plan.handover_agent_name || "").trim() || !String(plan.handover_agent_phone || approved.handover_agent_phone || "").trim() || !String(organizationName || "").trim()) throw new Error("Installment reminder requires the approved company and contact details.");
  return {
    client_name: String(plan.client_name).trim(),
    property_title: String(plan.property_title).trim(),
    amount_paid: formatMoneyCents(money.paidToDate, String(plan.currency || "")),
    outstanding_balance: formatMoneyCents(money.outstandingBalance, String(plan.currency || "")),
    handover_agent_name: String(plan.handover_agent_name).trim(),
    handover_agent_phone: String(plan.handover_agent_phone || approved.handover_agent_phone).trim(),
    company_name: String(organizationName).trim(),
  };
}

async function loadApprovedTemplate(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const { data, error } = await admin
    .from("whatsapp_template_configs")
    .select("template_name,language_code,variable_keys,metadata,status")
    .eq("organization_id", organizationId)
    .eq("purpose", "installment_payment_reminder")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data || !exactTemplateContract(data as Record<string, unknown>, organizationId)) return null;
  const metadata = data.metadata && typeof data.metadata === "object" ? data.metadata as Record<string, unknown> : {};
  return {
    template_name: String(data.template_name),
    language_code: String(data.language_code || (organizationId === LIMITLESS_REALTY_ORGANIZATION_ID ? "" : "en_US")),
    variable_keys: (data.variable_keys as unknown[]).map(String),
    company_name: typeof metadata.company_name === "string" ? metadata.company_name : undefined,
    handover_agent_phone: typeof metadata.handover_agent_phone === "string" ? metadata.handover_agent_phone : undefined,
  } satisfies ApprovedTemplate;
}

async function sendAttempt(args: {
  admin: ReturnType<typeof createAdminClient>;
  plan: PaymentPlanRow;
  template: ReminderTemplateRow;
  approved: ApprovedTemplate;
  attemptId: string;
  scheduledFor: string;
  values: ReminderValues;
  isLimitless: boolean;
}) {
  const { admin, plan, template, approved, attemptId, scheduledFor, values, isLimitless } = args;
  try {
    if (isLimitless) {
      const phoneCandidates = limitlessPhoneCandidates(plan.client_phone);
      const authorization = await admin.rpc("authorize_limitless_installment_reminder_send", {
        p_organization_id: plan.organization_id,
        p_plan_id: plan.id,
        p_attempt_id: attemptId,
        p_template_id: template.id,
        p_scheduled_for: scheduledFor,
        p_phone_candidates: phoneCandidates,
      });
      if (authorization.error) {
        const safeError = "Reminder send authorization was unavailable; no provider call was attempted.";
        await admin.from("reminder_attempts").update({ status: "failed", error_message: safeError })
          .eq("id", attemptId).eq("organization_id", plan.organization_id).eq("payment_plan_id", plan.id).eq("status", "pending");
        return { status: "failed", error: safeError };
      }
      const authorizationData = authorization.data && typeof authorization.data === "object" ? authorization.data as { authorized?: unknown; reason?: unknown } : {};
      if (authorizationData.authorized !== true) {
        const safeError = `Reminder send was skipped by the consent or plan authorization guard (${String(authorizationData.reason || "not_authorized")}).`;
        await admin.from("reminder_attempts").update({ status: "skipped", error_message: safeError })
          .eq("id", attemptId).eq("organization_id", plan.organization_id).eq("payment_plan_id", plan.id).eq("status", "pending");
        return { status: "skipped", error: safeError };
      }
    }
    const metering = await reserveFluxCredits({
      organizationId: String(plan.organization_id),
      action: "whatsapp_follow_up_reminder",
      source: "installment_reminder",
      provider: "whatsapp",
      metadata: { payment_plan_id: plan.id, reminder_attempt_id: attemptId },
    });
    const delivery = await sendWhatsAppMessage({
      organizationId: String(plan.organization_id),
      to: String(plan.client_phone || "").replace(/[^\d]/g, ""),
      text: renderLocalTemplate(String(template.message_template || ""), values),
      deliveryMode: "template",
      templatePurpose: "installment_payment_reminder",
      ...(isLimitless ? { requestedTemplateName: approved.template_name } : {}),
      variables: values,
    });
    const providerMessageId = String(delivery.providerMessageId || "").trim() || null;
    const sentAt = new Date().toISOString();
    const status = providerMessageId ? "sent" : "unknown";
    const { error } = await admin
      .from("reminder_attempts")
      .update({ status, sent_at: providerMessageId ? sentAt : null, provider_reference: providerMessageId, error_message: providerMessageId ? null : "Provider returned no message ID; delivery outcome is ambiguous and will not be retried automatically.", payload: { approved_template: approved.template_name, language_code: approved.language_code, variable_keys: approved.variable_keys, variable_count: Object.keys(values).length, timing_direction: template.timing_direction, timing_days: template.timing_days, provider: delivery.provider, message_type: delivery.messageType } })
      .eq("id", attemptId)
      .eq("organization_id", plan.organization_id)
      .eq("payment_plan_id", plan.id)
      .eq("status", "pending");
    if (error) throw error;
    if (!isLimitless && status === "sent") {
      const nextAt = new Date(new Date(sentAt).getTime() + cadenceDays(String(plan.frequency || "biweekly")) * DAY_MS).toISOString();
      await admin.from("payment_plans").update({ last_reminder_at: sentAt, next_reminder_at: nextAt, updated_at: sentAt })
        .eq("id", plan.id).eq("organization_id", plan.organization_id).eq("status", "active").eq("reminders_enabled", true).gt("outstanding_balance", 0);
    }
    return { status, credits: metering.credits };
  } catch (error) {
    const status = explicitDeliveryFailure(error) ? "failed" : "unknown";
    await admin.from("reminder_attempts").update({ status, error_message: attemptError(error) }).eq("id", attemptId).eq("organization_id", plan.organization_id).eq("payment_plan_id", plan.id).eq("status", "pending");
    return { status, error: attemptError(error) };
  }
}

export async function runLimitlessInstallmentReminderSweep(now = new Date()) {
  const admin = createAdminClient();
  const [{ data: plans, error: planError }, { data: organizations, error: orgError }, { data: templates, error: templateError }] = await Promise.all([
    admin.from("payment_plans").select("id,organization_id,contact_id,client_name,client_phone,property_title,currency,agreed_price,total_paid,outstanding_balance,installment_amount,payment_type,frequency,start_at,next_reminder_at,next_due_date,final_due_date,reminder_template_id,handover_agent_name,handover_agent_phone,status,reminders_enabled").eq("reminders_enabled", true).eq("status", "active").gt("outstanding_balance", 0).eq("payment_type", "installment").limit(500),
    admin.from("organizations").select("id,name").eq("status", "active").limit(500),
    admin.from("reminder_templates").select("id,organization_id,name,timing_direction,timing_days,channel,message_template,enabled").eq("enabled", true).eq("channel", "whatsapp").order("position", { ascending: true }).limit(500),
  ]);
  if (planError || orgError || templateError) throw new Error("Unable to load installment reminder runtime data.");

  const orgMap = new Map((organizations || []).map((org) => [String(org.id), String(org.name || "Your company")]));
  const templateRows = (templates || []) as ReminderTemplateRow[];
  const approvedByOrganization = new Map<string, ApprovedTemplate | null>();
  const entitlementMap = new Map<string, boolean>();
  const results: Array<Record<string, unknown>> = [];

  for (const plan of (plans || []) as PaymentPlanRow[]) {
    const organizationId = String(plan.organization_id);
    const isLimitless = organizationId === LIMITLESS_REALTY_ORGANIZATION_ID;
    if (!orgMap.has(organizationId)) { results.push({ planId: plan.id, status: "skipped", reason: "organization_not_active" }); continue; }
    if (!entitlementMap.has(organizationId)) {
      try { await assertFluxFeatureAccess(organizationId, "reminders"); entitlementMap.set(organizationId, true); } catch { entitlementMap.set(organizationId, false); }
    }
    if (!entitlementMap.get(organizationId)) { results.push({ planId: plan.id, status: "skipped", reason: "reminders_not_included_in_plan" }); continue; }
    if (isLimitless) {
      try {
        if (!parseLagosDate(plan.next_due_date)) throw new Error("invalid due date");
        validatedLimitlessMoney(plan);
      } catch {
        results.push({ planId: plan.id, status: "skipped", reason: "invalid_installment_schedule" });
        continue;
      }
    }
    if (!String(plan.client_phone || "").replace(/[^\d]/g, "")) { results.push({ planId: plan.id, status: "skipped", reason: "missing_phone" }); continue; }
    if (isLimitless) {
      const optOut = await checkLeadOptOut(admin, plan);
      if (!optOut.safe) { results.push({ planId: plan.id, status: "skipped", reason: "opt_out_status_unavailable" }); continue; }
      if (optOut.optedOut) { results.push({ planId: plan.id, status: "skipped", reason: "customer_opted_out" }); continue; }
    }
    if (!approvedByOrganization.has(organizationId)) approvedByOrganization.set(organizationId, await loadApprovedTemplate(admin, organizationId));
    const approved = approvedByOrganization.get(organizationId);
    if (!approved) { results.push({ planId: plan.id, status: "skipped", reason: "missing_exact_approved_meta_template_config" }); continue; }
    const tenantTemplates = templateRows.filter((template) => String(template.organization_id) === organizationId);
    const selectedTemplateMatches = plan.reminder_template_id ? tenantTemplates.filter((template) => String(template.id) === String(plan.reminder_template_id)) : [];
    const selectedTemplates = plan.reminder_template_id
      ? selectedTemplateMatches
      : isLimitless ? tenantTemplates : tenantTemplates.slice(0, 1);
    if (isLimitless && selectedTemplates.length !== 1) {
      results.push({ planId: plan.id, status: "skipped", reason: "limitless_requires_single_local_reminder_template" });
      continue;
    }
    if (!selectedTemplates.length) { results.push({ planId: plan.id, status: "skipped", reason: "missing_local_reminder_template" }); continue; }
    const organizationName = approved.company_name || orgMap.get(organizationId) || "Your company";

    for (const template of selectedTemplates) {
      let scheduledFor: string;
      let occurrenceDate: string | null = null;
      if (isLimitless) {
        const occurrence = computeLimitlessReminderOccurrence(String(plan.next_due_date), template.timing_direction, Number(template.timing_days), plan.next_reminder_at);
        if (!occurrence) { results.push({ planId: plan.id, templateId: template.id, status: "skipped", reason: "invalid_reminder_occurrence" }); continue; }
        scheduledFor = occurrence.scheduledFor;
        occurrenceDate = occurrence.occurrenceDate;
      } else {
        const nextReminder = plan.next_reminder_at ? new Date(plan.next_reminder_at) : new Date(String(plan.start_at || ""));
        if (Number.isNaN(nextReminder.getTime()) || nextReminder.getTime() > now.getTime()) {
          results.push({ planId: plan.id, status: "waiting", nextReminderAt: Number.isNaN(nextReminder.getTime()) ? null : nextReminder.toISOString() });
          continue;
        }
        scheduledFor = nextReminder.toISOString();
      }
      const { data: existing } = await admin.from("reminder_attempts").select("id,status").eq("organization_id", organizationId).eq("payment_plan_id", plan.id).eq("reminder_template_id", String(template.id)).eq("scheduled_for", scheduledFor).limit(1).maybeSingle();
      if (existing?.id && ["sent", "pending", "skipped", "unknown"].includes(String(existing.status))) continue;
      if (isLimitless && occurrenceDate) {
        const timing = classifyReminderOccurrence(occurrenceDate, scheduledFor, now);
        if (timing === "invalid") { results.push({ planId: plan.id, templateId: template.id, status: "skipped", reason: "invalid_reminder_occurrence" }); continue; }
        if (timing === "waiting") { results.push({ planId: plan.id, templateId: template.id, status: "waiting", scheduledFor }); continue; }
        if (timing === "missed") {
          if (!existing?.id) {
            const skipped = await admin.from("reminder_attempts").insert({ organization_id: organizationId, payment_plan_id: plan.id, reminder_template_id: String(template.id), scheduled_for: scheduledFor, channel: "whatsapp", status: "skipped", error_message: "missed_reminder_window", payload: { approved_template: approved.template_name, language_code: approved.language_code, timing_direction: template.timing_direction, timing_days: template.timing_days } }).select("id").maybeSingle();
            const uniqueConflict = String((skipped.error as { code?: string } | null)?.code || "") === "23505";
            if ((skipped.error && !uniqueConflict) || (!skipped.data?.id && !uniqueConflict)) {
              results.push({ planId: plan.id, templateId: template.id, status: "failed", reason: "missed_window_state_write_failed" });
              continue;
            }
          }
          results.push({ planId: plan.id, templateId: template.id, status: "skipped", reason: "missed_reminder_window" });
          continue;
        }
      }
      let values: ReminderValues;
      try { values = valuesForPlan(plan, organizationName, approved, isLimitless); } catch { results.push({ planId: plan.id, templateId: template.id, status: "skipped", reason: "invalid_installment_schedule" }); continue; }
      const attempt = await admin.from("reminder_attempts").insert({ organization_id: organizationId, payment_plan_id: plan.id, reminder_template_id: String(template.id), scheduled_for: scheduledFor, channel: "whatsapp", status: "pending", payload: { approved_template: approved.template_name, language_code: approved.language_code, variable_keys: approved.variable_keys, variable_count: Object.keys(values).length, timing_direction: template.timing_direction, timing_days: template.timing_days } }).select("id").single();
      if (attempt.error || !attempt.data?.id) { results.push({ planId: plan.id, templateId: template.id, status: "already_claimed_or_failed" }); continue; }
      const delivery = await sendAttempt({ admin, plan, template, approved, attemptId: attempt.data.id, scheduledFor, values, isLimitless });
      results.push({ planId: plan.id, templateId: template.id, ...delivery, scheduledFor });
    }
  }
  const statusCounts = results.reduce<Record<string, number>>((counts, result) => {
    const status = String(result.status || "unknown");
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
  return { checkedPlans: plans?.length || 0, processed: statusCounts.sent || 0, status_counts: statusCounts };
}

export async function retryLimitlessInstallmentReminder(args: { organizationId: string; planId: string; attemptId: string }) {
  const admin = createAdminClient();
  const { organizationId, planId, attemptId } = args;
  const isLimitless = organizationId === LIMITLESS_REALTY_ORGANIZATION_ID;
  const { data: plan, error: planError } = await admin.from("payment_plans").select("id,organization_id,contact_id,client_name,client_phone,property_title,currency,agreed_price,total_paid,outstanding_balance,installment_amount,payment_type,frequency,start_at,next_reminder_at,next_due_date,final_due_date,reminder_template_id,handover_agent_name,handover_agent_phone,status,reminders_enabled").eq("organization_id", organizationId).eq("id", planId).eq("payment_type", "installment").eq("status", "active").eq("reminders_enabled", true).gt("outstanding_balance", 0).maybeSingle();
  if (planError || !plan) throw new Error("The installment plan is not available for retry in the active organization.");
  if (isLimitless) {
    const optOut = await checkLeadOptOut(admin, plan as PaymentPlanRow);
    if (!optOut.safe || optOut.optedOut) throw new Error("Reminder retry is blocked because opt-out is active or consent status cannot be verified.");
  }
  const { data: attempt, error: attemptError } = await admin.from("reminder_attempts").select("id,organization_id,payment_plan_id,reminder_template_id,scheduled_for,status,retry_count").eq("organization_id", organizationId).eq("payment_plan_id", planId).eq("id", attemptId).eq("status", "failed").maybeSingle();
  if (attemptError || !attempt) throw new Error("Only an explicit failed reminder attempt can be retried.");
  const { data: template, error: templateError } = await admin.from("reminder_templates").select("id,organization_id,name,timing_direction,timing_days,channel,message_template,enabled").eq("organization_id", organizationId).eq("id", attempt.reminder_template_id).eq("enabled", true).eq("channel", "whatsapp").maybeSingle();
  const approved = await loadApprovedTemplate(admin, organizationId);
  if (templateError || !template || !approved) throw new Error("The approved reminder contract is not available for retry.");
  const expectedScheduledFor = isLimitless
    ? computeLimitlessReminderOccurrence(String((plan as PaymentPlanRow).next_due_date || ""), template.timing_direction as ReminderDirection, Number(template.timing_days), (plan as PaymentPlanRow).next_reminder_at)?.scheduledFor
    : (() => {
      const nextReminder = (plan as PaymentPlanRow).next_reminder_at ? new Date(String((plan as PaymentPlanRow).next_reminder_at)) : new Date(String((plan as PaymentPlanRow).start_at || ""));
      return Number.isNaN(nextReminder.getTime()) ? null : nextReminder.toISOString();
    })();
  if (!expectedScheduledFor || new Date(expectedScheduledFor).getTime() !== new Date(String(attempt.scheduled_for || "")).getTime()) {
    throw new Error("This reminder is stale because the plan due date or template schedule has changed.");
  }
  await assertFluxFeatureAccess(organizationId, "reminders");
  const { data: organization } = await admin.from("organizations").select("name").eq("id", organizationId).limit(1).maybeSingle();
  const organizationName = approved.company_name || String(organization?.name || "Your company");
  const values = valuesForPlan(plan as PaymentPlanRow, organizationName, approved, isLimitless);
  const { data: claimed, error: claimError } = await admin.from("reminder_attempts").update({ status: "pending", retry_count: Number(attempt.retry_count || 0) + 1, last_retry_at: new Date().toISOString(), send_authorized_at: null }).eq("organization_id", organizationId).eq("payment_plan_id", planId).eq("id", attemptId).eq("status", "failed").select("id").maybeSingle();
  if (claimError || !claimed?.id) throw new Error("This failed reminder attempt has already been claimed for retry.");
  return sendAttempt({ admin, plan: plan as PaymentPlanRow, template: template as ReminderTemplateRow, approved, attemptId, scheduledFor: String(attempt.scheduled_for), values, isLimitless });
}
