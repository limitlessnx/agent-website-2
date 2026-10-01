import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";
const CANONICAL_ROUTE = "trigger-dev-meta-cloud-api";

async function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (secret && supplied && supplied === secret) return true;

  const schedulerToken = request.headers.get("x-maia-scheduler-token")?.trim();
  if (!schedulerToken) return false;
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("verify_maia_scheduler_secret", { candidate: schedulerToken });
  return !error && data === true;
}

function templateVariables(lead: Record<string, unknown>, message: string) {
  const propertyName = String(lead.property_interest || "").trim();
  const location = String(lead.location_preference || "").trim();
  const interest = [String(lead.property_type || "").trim(), propertyName].filter(Boolean).join(" • ");
  const goal = [String(lead.purpose || "").trim(), String(lead.timeline || "").trim()].filter(Boolean).join(" • ");
  return {
    customer_name: String(lead.name || "there").trim(),
    last_topic: message.slice(0, 180),
    property_name: propertyName,
    property_location: location,
    customer_interest: interest,
    customer_goal: goal,
    objection: String(lead.notes || "").slice(0, 500),
  };
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", LIMITLESS_REALTY_SLUG)
    .maybeSingle();

  if (!organization) {
    return NextResponse.json({ error: "Limitless Realty organization is not configured." }, { status: 500 });
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("follow_ups")
    .select("id,organization_id,lead_id,scheduled_at,message_sent,status,stage,template_name,leads!follow_ups_lead_id_fkey(phone,name,opted_out,property_interest,property_type,location_preference,purpose,timeline,notes)")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];

  for (const row of rows || []) {
    try {
      const lead = (Array.isArray(row.leads) ? row.leads[0] : row.leads) as Record<string, unknown> | null;
      const phone = String(lead?.phone || "").replace(/[^\d]/g, "");
      const { data: handoffConversation } = phone
        ? await admin.from("agent_conversations").select("id,ai_paused,status").eq("organization_id", organization.id).eq("external_thread_key", phone).maybeSingle()
        : { data: null };

      if (!phone || Boolean(lead?.opted_out) || Boolean(handoffConversation?.ai_paused) || String(handoffConversation?.status || "") === "handoff") {
        await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id).eq("organization_id", organization.id);
        results.push({
          id: row.id,
          status: "cancelled",
          reason: !phone ? "missing_phone" : lead?.opted_out ? "opted_out" : "human_handoff",
        });
        continue;
      }

      const message = String(row.message_sent || "").trim();
      const delivery = await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: message,
        deliveryMode: "auto",
        templatePurpose: "follow_up_outside_24h",
        variables: templateVariables(lead || {}, message),
      });

      await admin
        .from("follow_ups")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          template_name: delivery.templateName || null,
          channel: "whatsapp",
          agent_key: "maia",
        })
        .eq("id", row.id)
        .eq("organization_id", organization.id)
        .eq("status", "pending");

      results.push({
        id: row.id,
        stage: row.stage,
        status: "sent",
        provider: delivery.provider,
        messageType: delivery.messageType,
        templateName: delivery.templateName,
        providerMessageId: delivery.providerMessageId,
        route: CANONICAL_ROUTE,
      });
    } catch (error) {
      results.push({
        id: row.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Follow-up failed",
      });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
