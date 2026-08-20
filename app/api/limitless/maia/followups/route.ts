import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const LIMITLESS_REALTY_SLUG = "limitless-realty";
const CANONICAL_ROUTE = "existing-limitless-realty-maia-n8n";

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

async function sendViaCanonicalMaia(to: string, message: string) {
  const webhook = process.env.LIMITLESS_REALTY_MAIA_N8N_WEBHOOK_URL?.trim() || process.env.LIMITLESS_REALTY_N8N_WEBHOOK_URL?.trim() || process.env.N8N_LIMITLESS_REALTY_MAIA_WEBHOOK_URL?.trim();
  if (!webhook) throw new Error("Canonical Limitless Realty Maia n8n webhook is not configured. Follow-up was not sent through another WhatsApp route.");
  const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "whatsapp", to, message, source: "maia_followup", tenant: LIMITLESS_REALTY_SLUG, agent: "maia", route: CANONICAL_ROUTE }), cache: "no-store" });
  if (!response.ok) throw new Error(`Canonical Maia WhatsApp workflow failed (${response.status}).`);
  return CANONICAL_ROUTE;
}

export async function POST(request: NextRequest) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id").eq("slug", LIMITLESS_REALTY_SLUG).maybeSingle();
  if (!organization) return NextResponse.json({ error: "Limitless Realty organization is not configured." }, { status: 500 });
  const now = new Date().toISOString();
  const { data: rows, error } = await admin.from("follow_ups").select("id,organization_id,lead_id,scheduled_at,message_sent,status,leads(phone,name,opted_out)").eq("organization_id", organization.id).eq("status", "pending").lte("scheduled_at", now).order("scheduled_at", { ascending: true }).limit(25);
  if (error) return NextResponse.json({ error: "Unable to load due follow-ups." }, { status: 500 });
  const results: Array<Record<string, unknown>> = [];
  for (const row of rows || []) {
    try {
      const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
      const phone = String((lead as any)?.phone || "").replace(/[^\d]/g, "");
      const { data: handoffConversation } = phone ? await admin.from("agent_conversations").select("id,ai_paused,status").eq("organization_id", organization.id).eq("external_thread_key", phone).maybeSingle() : { data: null };
      if (!phone || Boolean((lead as any)?.opted_out) || Boolean((handoffConversation as any)?.ai_paused) || String((handoffConversation as any)?.status || "") === "handoff") {
        await admin.from("follow_ups").update({ status: "cancelled" }).eq("id", row.id).eq("organization_id", organization.id);
        results.push({ id: row.id, status: "cancelled", reason: !phone ? "missing_phone" : (lead as any)?.opted_out ? "opted_out" : "human_handoff" });
        continue;
      }
      const provider = await sendViaCanonicalMaia(phone, String(row.message_sent || ""));
      await admin.from("follow_ups").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", row.id).eq("organization_id", organization.id).eq("status", "pending");
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
