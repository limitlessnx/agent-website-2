import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppMessage } from "@/lib/whatsapp-delivery";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";

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
    try {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const phone = String((lead as any)?.phone || "").replace(/[^\d]/g, "");
      const { data: handoffConversation } = phone
        ? await admin.from("agent_conversations").select("id,ai_paused,status").eq("organization_id", organization.id).eq("external_thread_key", phone).maybeSingle()
        : { data: null };

      if (!phone || Boolean((lead as any)?.opted_out) || Boolean((handoffConversation as any)?.ai_paused) || String((handoffConversation as any)?.status || "") === "handoff") {
        await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id).eq("organization_id", organization.id);
        results.push({ id: row.id, status: "cancelled", reason: !phone ? "missing_phone" : (lead as any)?.opted_out ? "opted_out" : "human_handoff" });
        continue;
      }

      const conversation = await admin.from("crm_conversations").select("id").eq("organization_id", organization.id).eq("channel", "whatsapp").eq("external_thread_id", phone).maybeSingle();
      let lastInboundAt: string | null = null;
      if (conversation.data?.id) {
        const inbound = await admin.from("crm_messages").select("created_at").eq("conversation_id", conversation.data.id).eq("direction", "inbound").order("created_at", { ascending: false }).limit(1).maybeSingle();
        lastInboundAt = inbound.data?.created_at || null;
      }

      const withinCustomerServiceWindow = Boolean(lastInboundAt && Date.now() - new Date(lastInboundAt).getTime() < 24 * 60 * 60 * 1000);
      const delivery = await sendWhatsAppMessage({
        organizationId: organization.id,
        to: phone,
        text: String(row.message_sent || ""),
        deliveryMode: withinCustomerServiceWindow ? "direct" : "template",
        templatePurpose: "follow_up_outside_24h",
        lastCustomerMessageAt: lastInboundAt,
        variables: {
          lead_name: String((lead as any)?.name || ""),
          property_interest: "",
          last_customer_message: "",
          conversation_summary: String(row.message_sent || ""),
          customer_goal: "",
          last_objection: "",
        },
      });

      await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "pending");
      results.push({ id: row.id, status: "sent", provider: delivery.provider, messageType: delivery.messageType, providerMessageId: delivery.providerMessageId });
    } catch (error) {
      results.push({ id: row.id, status: "failed", error: error instanceof Error ? error.message : "Follow-up failed" });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
