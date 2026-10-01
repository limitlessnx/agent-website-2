import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

const LIMITLESS_REALTY_ORG = "b15f21b4-5697-4d21-9421-8a34eae3476d";
const DAY_MS = 24 * 60 * 60 * 1000;

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

function scheduledDate(dueDate: string, direction: string, days: number) {
  const date = new Date(dueDate + "T00:00:00.000Z");
  const offset = Math.max(0, Number(days) || 0) * DAY_MS * (direction === "before" ? -1 : direction === "after" ? 1 : 0);
  return new Date(date.getTime() + offset);
}

function renderMessage(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => values[key] ?? "");
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeZone: "Africa/Lagos" }).format(new Date(value));
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const now = new Date();
  const { data: templates, error: templateError } = await admin
    .from("reminder_templates")
    .select("id,name,position,timing_direction,timing_days,channel,message_template,enabled")
    .eq("organization_id", LIMITLESS_REALTY_ORG)
    .eq("enabled", true)
    .order("position", { ascending: true });

  if (templateError) return NextResponse.json({ error: "Unable to load installment reminder templates." }, { status: 500 });

  const executableTemplates = (templates || []).filter((template) => String(template.channel).toLowerCase() === "whatsapp");
  if (!executableTemplates.length) {
    return NextResponse.json({ ok: true, processed: 0, skipped: 0, reason: "No WhatsApp installment reminder templates are configured." });
  }

  const { data: plans, error: planError } = await admin
    .from("payment_plans")
    .select("id,client_name,client_phone,property_title,installment_amount,outstanding_balance,next_due_date,status,reminders_enabled")
    .eq("organization_id", LIMITLESS_REALTY_ORG)
    .eq("reminders_enabled", true)
    .in("status", ["active", "due_soon", "overdue"])
    .not("next_due_date", "is", null)
    .limit(250);

  if (planError) return NextResponse.json({ error: "Unable to load installment plans." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const plan of plans || []) {
    const dueDate = String(plan.next_due_date || "");
    if (!dueDate) continue;

    for (const template of executableTemplates) {
      const scheduledFor = scheduledDate(dueDate, String(template.timing_direction), Number(template.timing_days || 0));
      if (scheduledFor.getTime() > now.getTime()) continue;

      const { data: existing } = await admin
        .from("reminder_attempts")
        .select("id,status")
        .eq("organization_id", LIMITLESS_REALTY_ORG)
        .eq("payment_plan_id", plan.id)
        .eq("reminder_template_id", template.id)
        .eq("scheduled_for", scheduledFor.toISOString())
        .limit(1)
        .maybeSingle();

      if (existing?.id && ["sent", "pending", "skipped"].includes(String(existing.status))) continue;

      const phone = String(plan.client_phone || "").replace(/[^\d]/g, "");
      const outstanding = Number(plan.outstanding_balance || 0);
      if (!phone || outstanding <= 0) {
        await admin.from("reminder_attempts").insert({
          organization_id: LIMITLESS_REALTY_ORG,
          payment_plan_id: plan.id,
          reminder_template_id: template.id,
          scheduled_for: scheduledFor.toISOString(),
          channel: template.channel,
          status: "skipped",
          error_message: !phone ? "Client phone number is missing." : "Installment plan has no outstanding balance.",
          payload: { reason: !phone ? "missing_phone" : "no_outstanding_balance" },
        });
        results.push({ planId: plan.id, template: template.name, status: "skipped" });
        continue;
      }

      const values = {
        client_name: String(plan.client_name || "there"),
        property_title: String(plan.property_title || "your property"),
        installment_amount: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(Number(plan.installment_amount || 0)),
        outstanding_balance: new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(outstanding),
        due_date: dateLabel(dueDate),
        days_until_due: String(Math.round((new Date(dueDate + "T00:00:00.000Z").getTime() - now.getTime()) / DAY_MS)),
      };

      const attempt = await admin.from("reminder_attempts").insert({
        organization_id: LIMITLESS_REALTY_ORG,
        payment_plan_id: plan.id,
        reminder_template_id: template.id,
        scheduled_for: scheduledFor.toISOString(),
        channel: template.channel,
        status: "pending",
        payload: { values },
      }).select("id").single();

      if (attempt.error || !attempt.data?.id) {
        results.push({ planId: plan.id, template: template.name, status: "already_claimed_or_failed" });
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
            last_topic: "Installment payment reminder",
            property_name: values.property_title,
            property_location: "",
            customer_interest: "Installment payment",
            customer_goal: "Complete the property installment",
            objection: "",
          },
        });

        await admin.from("reminder_attempts").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          provider_reference: delivery.providerMessageId || null,
          payload: { values, delivery },
        }).eq("id", attempt.data.id).eq("organization_id", LIMITLESS_REALTY_ORG);

        results.push({ planId: plan.id, template: template.name, status: "sent", providerMessageId: delivery.providerMessageId || null });
      } catch (error) {
        await admin.from("reminder_attempts").update({
          status: "failed",
          error_message: error instanceof Error ? error.message : "Reminder delivery failed.",
          payload: { values },
        }).eq("id", attempt.data.id).eq("organization_id", LIMITLESS_REALTY_ORG);
        results.push({ planId: plan.id, template: template.name, status: "failed", error: error instanceof Error ? error.message : "Reminder delivery failed." });
      }
    }
  }

  return NextResponse.json({ ok: true, checkedPlans: plans?.length || 0, templates: executableTemplates.length, processed: results.length, results });
}
