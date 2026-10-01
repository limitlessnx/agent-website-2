import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const LIMITLESS_REALTY_ORG = "b15f21b4-5697-4d21-9421-8a34eae3476d";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_REMINDER_INTERVAL_DAYS = 14;

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

function reminderIntervalDays(frequency: string) {
  const normalized = frequency.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if (["monthly", "month", "every_month", "30_days", "30_day"].includes(normalized)) return 30;
  if (["biweekly", "bi_weekly", "fortnightly", "every_2_weeks", "2_weeks", "14_days", "14_day"].includes(normalized)) return 14;
  return DEFAULT_REMINDER_INTERVAL_DAYS;
}

function renderMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeZone: "Africa/Lagos",
  }).format(new Date(value));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  const { data: templates, error: templateError } = await admin
    .from("reminder_templates")
    .select("id,name,position,channel,message_template,enabled")
    .eq("organization_id", LIMITLESS_REALTY_ORG)
    .eq("enabled", true)
    .eq("channel", "whatsapp")
    .order("position", { ascending: true });

  if (templateError) {
    return NextResponse.json({ error: "Unable to load installment reminder templates." }, { status: 500 });
  }

  // Only one recurring reminder template is used. Multiple active templates would
  // create duplicate messages on the same cadence, which is exactly what we do not want.
  const executableTemplates = (templates || []).slice(0, 1);
  if (!executableTemplates.length) {
    return NextResponse.json({
      ok: true,
      processed: 0,
      skipped: 0,
      reason: "No WhatsApp installment reminder template is enabled.",
    });
  }

  const template = executableTemplates[0];

  const { data: plans, error: planError } = await admin
    .from("payment_plans")
    .select(
      "id,client_name,client_phone,property_title,installment_amount,outstanding_balance,frequency,status,reminders_enabled,created_at"
    )
    .eq("organization_id", LIMITLESS_REALTY_ORG)
    .eq("reminders_enabled", true)
    .in("status", ["active", "due_soon", "overdue"])
    .limit(250);

  if (planError) {
    return NextResponse.json({ error: "Unable to load installment plans." }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const plan of plans || []) {
    const outstanding = Number(plan.outstanding_balance || 0);
    if (outstanding <= 0) continue;

    const phone = String(plan.client_phone || "").replace(/[^\d]/g, "");
    if (!phone) {
      results.push({ planId: plan.id, status: "skipped", reason: "missing_phone" });
      continue;
    }

    const intervalDays = reminderIntervalDays(String(plan.frequency || ""));
    const { data: lastAttempt } = await admin
      .from("reminder_attempts")
      .select("scheduled_for,status")
      .eq("organization_id", LIMITLESS_REALTY_ORG)
      .eq("payment_plan_id", plan.id)
      .eq("reminder_template_id", template.id)
      .in("status", ["sent", "pending"])
      .order("scheduled_for", { ascending: false })
      .limit(1)
      .maybeSingle();

    const anchor = lastAttempt?.scheduled_for
      ? new Date(lastAttempt.scheduled_for)
      : new Date(String(plan.created_at));

    if (Number.isNaN(anchor.getTime())) continue;

    const scheduledFor = new Date(anchor.getTime() + intervalDays * DAY_MS);
    if (scheduledFor.getTime() > now.getTime()) {
      results.push({
        planId: plan.id,
        status: "waiting",
        intervalDays,
        nextReminderAt: scheduledFor.toISOString(),
      });
      continue;
    }

    const { data: existing } = await admin
      .from("reminder_attempts")
      .select("id,status")
      .eq("organization_id", LIMITLESS_REALTY_ORG)
      .eq("payment_plan_id", plan.id)
      .eq("reminder_template_id", template.id)
      .eq("scheduled_for", scheduledFor.toISOString())
      .limit(1)
      .maybeSingle();

    if (existing?.id && ["sent", "pending", "skipped"].includes(String(existing.status))) {
      continue;
    }

    const values = {
      client_name: String(plan.client_name || "there"),
      property_title: String(plan.property_title || "your property"),
      installment_amount: new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(Number(plan.installment_amount || 0)),
      outstanding_balance: new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(outstanding),
      due_date: "",
      days_until_due: "",
    };

    const attempt = await admin
      .from("reminder_attempts")
      .insert({
        organization_id: LIMITLESS_REALTY_ORG,
        payment_plan_id: plan.id,
        reminder_template_id: template.id,
        scheduled_for: scheduledFor.toISOString(),
        channel: template.channel,
        status: "pending",
        payload: { values, intervalDays },
      })
      .select("id")
      .single();

    if (attempt.error || !attempt.data?.id) {
      results.push({ planId: plan.id, status: "already_claimed_or_failed" });
      continue;
    }

    try {
      const delivery = await sendWhatsAppMessage({
        organizationId: LIMITLESS_REALTY_ORG,
        to: phone,
        text: renderMessage(String(template.message_template || ""), values),
        deliveryMode: "template",
        templatePurpose: "follow_up_outside_24h",
        variables: {
          customer_name: values.client_name,
          last_topic: "Installment account check-in",
          property_name: values.property_title,
          property_location: "",
          customer_interest: "Property installment",
          customer_goal: "Stay on track with the property payment plan",
          objection: "",
        },
      });

      await admin
        .from("reminder_attempts")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_reference: delivery.providerMessageId || null,
          payload: { values, intervalDays, delivery },
        })
        .eq("id", attempt.data.id)
        .eq("organization_id", LIMITLESS_REALTY_ORG);

      results.push({
        planId: plan.id,
        status: "sent",
        intervalDays,
        providerMessageId: delivery.providerMessageId || null,
      });
    } catch (error) {
      await admin
        .from("reminder_attempts")
        .update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Reminder delivery failed.",
          payload: { values, intervalDays },
        })
        .eq("id", attempt.data.id)
        .eq("organization_id", LIMITLESS_REALTY_ORG);

      results.push({
        planId: plan.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Reminder delivery failed.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checkedPlans: plans?.length || 0,
    template: template.name,
    processed: results.length,
    results,
  });
}
