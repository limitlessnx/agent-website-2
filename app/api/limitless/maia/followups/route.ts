import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";
import { assertFluxFeatureAccess, reserveFluxCredits } from "@/lib/flux-credits";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";
type FollowupLead = { phone?: string | null; name?: string | null; opted_out?: boolean | null } | null;
type HandoffConversation = { ai_paused?: boolean | null; status?: string | null } | null;

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

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id").eq("slug", LIMITLESS_REALTY_SLUG).maybeSingle();
  if (!organization) return NextResponse.json({ error: "Limitless Realty organization is not configured." }, { status: 500 });
  try {
    await assertFluxFeatureAccess(organization.id, "follow_ups");
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Follow-up automation is not included in this plan." }, { status: 409 });
  }

  const now = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("follow_ups")
    .select("id,organization_id,lead_id,scheduled_at,message_sent,status,template_name,stage,leads!follow_ups_lead_id_fkey(phone,name,opted_out)")
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(25);

  if (error) return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  for (const row of rows || []) {
    const claim = await admin.from("follow_ups").update({ status: "processing" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "pending").select("id").maybeSingle();
    if (claim.error || !claim.data) continue;
    try {
      const leadValue = (row as unknown as { leads?: FollowupLead | FollowupLead[] }).leads;
      const lead: FollowupLead = Array.isArray(leadValue) ? leadValue[0] || null : leadValue || null;
      const phone = String(lead?.phone || "").replace(/[^\d]/g, "");
      const { data: handoffConversationData } = phone
        ? await admin.from("agent_conversations").select("id,ai_paused,status").eq("organization_id", organization.id).eq("external_thread_key", phone).maybeSingle()
        : { data: null };
      const handoffConversation = handoffConversationData as HandoffConversation;

      if (!phone || Boolean(lead?.opted_out) || Boolean(handoffConversation?.ai_paused) || String(handoffConversation?.status || "") === "handoff") {
        const cancellation = await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing").select("id").maybeSingle();
        if (cancellation.error) throw cancellation.error;
        if (!cancellation.data) throw new Error("Could not confirm cancellation of the stale follow-up.");
        results.push({ id: row.id, status: "cancelled", reason: !phone ? "missing_phone" : lead?.opted_out ? "opted_out" : "human_handoff" });
        continue;
      }

      const conversation = await admin.from("crm_conversations").select("id").eq("organization_id", organization.id).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
      let lastInboundAt: string | null = null;
      if (conversation.data?.id) {
        const inbound = await admin.from("crm_messages").select("created_at").eq("conversation_id", conversation.data.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lastInboundAt = inbound.data?.created_at || null;
      }

      const withinCustomerServiceWindow = Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000);
      const metering = await reserveFluxCredits({
        organizationId: organization.id,
        action: "whatsapp_follow_up_reminder",
        source: "whatsapp_follow_up",
        provider: "twilio",
        metadata: { followup_id: row.id, stage: row.stage || null },
      });
      const stageNumber = Number(row.stage);
      const templatePurpose = Number.isInteger(stageNumber) && stageNumber >= 1 && stageNumber <= 30 ? `follow_up_day_${stageNumber}` : "follow_up_outside_24h";
      const delivery = await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: String(row.message_sent || ""),
        deliveryMode: withinCustomerServiceWindow ? "direct" : "template",
        templatePurpose,
        lastCustomerMessageAt: lastInboundAt,
        variables: {
          lead_name: String(lead?.name || ""),
          property_interest: "",
          last_customer_message: "",
          conversation_summary: String(row.message_sent || ""),
          customer_goal: "",
          last_objection: "",
        },
      });

      await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organization.id) .eq("status", "processing");
      results.push({ id: row.id, status: "sent", credits: metering.credits, provider: delivery.provider, messageType: delivery.messageType, providerMessageId: delivery.providerMessageId });
    } catch (error) {
      await admin.from("follow_ups").update({ status: "failed" }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "processing");
      results.push({ id: row.id, status: "failed", error: error instanceof Error ? error.message : "Follow-up failed" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
