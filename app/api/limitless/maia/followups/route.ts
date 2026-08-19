import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(supplied && supplied === secret);
}

async function sendWhatsApp(to: string, message: string) {
  const webhook = process.env.LIMITLESS_REALTY_FOLLOWUP_WEBHOOK_URL?.trim() || process.env.LIMITLESS_REALTY_N8N_FOLLOWUP_WEBHOOK_URL?.trim();
  if (webhook) {
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "whatsapp", to, message, source: "maia_followup", tenant: "limitless-realty" }), cache: "no-store" });
    if (!response.ok) throw new Error(`Follow-up webhook failed (${response.status}).`);
    return "webhook";
  }
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (token && phoneNumberId) {
    const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: message } }), cache: "no-store" });
    if (!response.ok) throw new Error(`WhatsApp follow-up failed (${response.status}).`);
    return "meta_whatsapp";
  }
  throw new Error("No Limitless Realty WhatsApp delivery provider is configured.");
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: rows, error } = await admin.from("follow_ups").select("id,lead_id,scheduled_at,message_sent,status,leads(phone,name,opted_out)").eq("status", "pending").lte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(25);
  if (error) return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });
  const results: Array<Record<string, unknown>> = [];
  for (const row of rows || []) {
    try {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const phone = String((lead as any)?.phone || "").replace(/[^\d]/g, "");
      if (!phone || Boolean((lead as any)?.opted_out)) {
        await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id);
        results.push({ id: row.id, status: "cancelled" });
        continue;
      }
      const provider = await sendWhatsApp(phone, String(row.message_sent || ""));
      await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
      results.push({ id: row.id, status: "sent", provider });
    } catch (error) {
      results.push({ id: row.id, status: "failed", error: error instanceof Error ? error.message : "Follow-up failed" });
    }
  }
  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
