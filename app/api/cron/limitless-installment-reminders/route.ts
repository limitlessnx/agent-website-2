import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPECTED_VARIABLE_KEYS = [
  "client_name",
  "property_title",
  "amount_paid",
  "outstanding_balance",
  "handover_agent_name",
  "handover_agent_phone",
  "company_name",
] as const;

function cadenceDays(frequency: string) {
  const normalized = frequency.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["weekly", "week", "every_week", "7_days", "7_day"].includes(normalized)) return 7;
  if (["monthly", "month", "every_month", "30_days", "30_day"].includes(normalized)) return 30;
  return 14;
}

function renderLocalTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency || "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

async function authorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (cronSecret && supplied === cronSecret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const [{ data: plans, error: planError }, { data: organizations, error: orgError }, { data: templates, error: templateError }, { data: whatsappTemplates, error: whatsappTemplateError }] = await Promise.all([
    admin
      .from("payment_plans")
      .select("id,organization_id,client_name,client_phone,property_title,currency,total_paid,outstanding_balance,payment_type,frequency,start_at,end_at,next_reminder_at,last_reminder_at,reminder_template_id,handover_agent_name,handover_agent_phone,status,reminders_enabled")
      .eq("reminders_enabled", true)
      .eq("status", "active")
      .gt("outstanding_balance", 0)
      .eq("payment_type", "installment")
      .limit(500),
    admin.from("organizations").select("id,name").eq("status", "active"),
    admin.from("reminder_templates").select("id,organization_id,name,channel,message_template,enabled").eq("enabled", true).eq("channel", "whatsapp").order("position", { ascending: true }),
    admin.from("whatsapp_template_configs").select("organization_id,purpose,template_name,language_code,status,variable_keys,metadata").eq("purpose", "installment_payment_reminder").eq("status", "active"),
  ]);

  if (planError || orgError || templateError || whatsappTemplateError) {
    return NextResponse.json({ error: "Unable to load installment reminder runtime data." }, { status: 500 });
  }

  const orgMap = new Map((organizations || []).map((org) => [String(org.id), String(org.name || "Your company")]));
  const templateMap = new Map<string, { id: string; message_template: string }>();
  for (const template of templates || []) {
    const key = String(template.organization_id);
    if (!templateMap.has(key)) templateMap.set(key, { id: String(template.id), message_template: String(template.message_template || "") });
  }

  const whatsappConfigMap = new Map<string, { template_name: string; language_code: string; variable_keys: string[]; company_name?: string; handover_agent_phone?: string }>();
  for (const config of whatsappTemplates || []) {
    const variableKeys = Array.isArray(config.variable_keys) ? config.variable_keys.map(String) : [];
    if (variableKeys.length !== EXPECTED_VARIABLE_KEYS.length || variableKeys.some((key, index) => key !== EXPECTED_VARIABLE_KEYS[index])) continue;
    const metadata = config.metadata && typeof config.metadata === "object" ? config.metadata as Record<string, unknown> : {};
    whatsappConfigMap.set(String(config.organization_id), {
      template_name: String(config.template_name),
      language_code: String(config.language_code || "en"),
      variable_keys: variableKeys,
      company_name: typeof metadata.company_name === "string" ? metadata.company_name : undefined,
      handover_agent_phone: typeof metadata.handover_agent_phone === "string" ? metadata.handover_agent_phone : undefined,
    });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const plan of plans || []) {
    const organizationId = String(plan.organization_id);
    const whatsappConfig = whatsappConfigMap.get(organizationId);
    const organizationName = whatsappConfig?.company_name || orgMap.get(organizationId) || "Your company";
    const localTemplate = plan.reminder_template_id
      ? (templates || []).find((item) => String(item.id) === String(plan.reminder_template_id))
      : null;
    const template = localTemplate || templateMap.get(organizationId);

    if (!template) {
      results.push({ planId: plan.id, status: "skipped", reason: "missing_local_reminder_template" });
      continue;
    }
    if (!whatsappConfig) {
      results.push({ planId: plan.id, status: "skipped", reason: "missing_approved_meta_template_config" });
      continue;
    }

    const phone = String(plan.client_phone || "").replace(/[^\d]/g, "");
    if (!phone) {
      results.push({ planId: plan.id, status: "skipped", reason: "missing_phone" });
      continue;
    }

    const outstanding = Number(plan.outstanding_balance || 0);
    if (outstanding <= 0) continue;

    const intervalDays = cadenceDays(String(plan.frequency || "biweekly"));
    const nextReminder = plan.next_reminder_at
      ? new Date(String(plan.next_reminder_at))
      : new Date(new Date(String(plan.start_at)).getTime() + intervalDays * DAY_MS);

    if (Number.isNaN(nextReminder.getTime()) || nextReminder.getTime() > now.getTime()) {
      results.push({
        planId: plan.id,
        status: "waiting",
        nextReminderAt: Number.isNaN(nextReminder.getTime()) ? null : nextReminder.toISOString(),
      });
      continue;
    }

    const scheduledFor = nextReminder.toISOString();

    const { data: existing } = await admin
      .from("reminder_attempts")
      .select("id,status")
      .eq("organization_id", organizationId)
      .eq("payment_plan_id", plan.id)
      .eq("reminder_template_id", String(template.id))
      .eq("scheduled_for", scheduledFor)
      .limit(1)
      .maybeSingle();

    if (existing?.id && ["sent", "pending", "skipped"].includes(String(existing.status))) continue;

    const currency = String(plan.currency || "NGN");
    const values = {
      client_name: String(plan.client_name || "there"),
      property_title: String(plan.property_title || "your property"),
      amount_paid: formatMoney(Number(plan.total_paid || 0), currency),
      outstanding_balance: formatMoney(outstanding, currency),
      handover_agent_name: String((plan as Record<string, unknown>).handover_agent_name || "our team"),
      handover_agent_phone: String((plan as Record<string, unknown>).handover_agent_phone || whatsappConfig.handover_agent_phone || ""),
      company_name: organizationName,
    };

    const attempt = await admin
      .from("reminder_attempts")
      .insert({
        organization_id: organizationId,
        payment_plan_id: plan.id,
        reminder_template_id: String(template.id),
        scheduled_for: scheduledFor,
        channel: "whatsapp",
        status: "pending",
        payload: { values, cadence: String(plan.frequency || "biweekly"), approved_template: whatsappConfig.template_name, local_template_preview: renderLocalTemplate(String(template.message_template || ""), values) },
      })
      .select("id")
      .single();

    if (attempt.error || !attempt.data?.id) {
      results.push({ planId: plan.id, status: "already_claimed_or_failed" });
      continue;
    }

    try {
      const delivery = await sendWhatsAppMessage({
        organizationId,
        to: phone,
        text: renderLocalTemplate(String(template.message_template || ""), values),
        deliveryMode: "template",
        templatePurpose: "installment_payment_reminder",
        variables: values,
      });

      const sentAt = new Date();
      const nextAt = new Date(sentAt.getTime() + intervalDays * DAY_MS).toISOString();

      await admin
        .from("reminder_attempts")
        .update({ status: "sent", sent_at: sentAt.toISOString(), provider_reference: delivery.providerMessageId || null, payload: { values, cadence: String(plan.frequency || "biweekly"), approved_template: whatsappConfig.template_name, local_template_preview: renderLocalTemplate(String(template.message_template || ""), values), delivery } })
        .eq("id", attempt.data.id)
        .eq("organization_id", organizationId);

      await admin
        .from("payment_plans")
        .update({ last_reminder_at: sentAt.toISOString(), next_reminder_at: nextAt, updated_at: sentAt.toISOString() })
        .eq("id", plan.id)
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .gt("outstanding_balance", 0);

      results.push({ planId: plan.id, status: "sent", cadence: plan.frequency, providerMessageId: delivery.providerMessageId || null, nextReminderAt: nextAt });
    } catch (error) {
      await admin
        .from("reminder_attempts")
        .update({ status: "failed", error_message: error instanceof Error ? error.message : "Reminder delivery failed." })
        .eq("id", attempt.data.id)
        .eq("organization_id", organizationId);

      results.push({ planId: plan.id, status: "failed", error: error instanceof Error ? error.message : "Reminder delivery failed." });
    }
  }

  return NextResponse.json({ ok: true, checkedPlans: plans?.length || 0, processed: results.filter((result) => result.status === "sent").length, results });
}
