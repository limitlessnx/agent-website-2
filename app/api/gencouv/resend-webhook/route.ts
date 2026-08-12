import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";

function iso(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function eventStatus(type: string) {
  return type.replace(/^email\./, "");
}

function firstEmail(value: unknown) {
  if (Array.isArray(value)) return String(value[0] || "").trim().toLowerCase();
  return String(value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const expectedToken = process.env.GENCOUV_RESEND_WEBHOOK_TOKEN;
    const suppliedToken = new URL(request.url).searchParams.get("token");
    if (expectedToken && suppliedToken !== expectedToken) {
      return NextResponse.json({ success: false, message: "Invalid webhook token." }, { status: 401 });
    }

    const payload = await request.json();
    const type = String(payload?.type || "unknown");
    const data = payload?.data || {};
    const providerEmailId = String(data?.email_id || data?.id || "");
    const occurredAt = iso(payload?.created_at || data?.created_at);
    const providerEventId = String(payload?.id || `${type}:${providerEmailId}:${occurredAt}`);
    const status = eventStatus(type);

    const existing = await supabaseServerRequest<any[]>(
      `gencouv_email_events?select=id&provider_event_id=eq.${encodeURIComponent(providerEventId)}&limit=1`,
    );
    if (existing.length) return NextResponse.json({ success: true, duplicate: true });

    let messages = providerEmailId
      ? await supabaseServerRequest<any[]>(
          `gencouv_email_messages?select=*&provider_email_id=eq.${encodeURIComponent(providerEmailId)}&limit=1`,
        )
      : [];
    let message = messages[0];

    // Resend Automations can send outside Fluxknight, so those messages may not
    // already exist in gencouv_email_messages. Create the missing record from
    // the webhook itself so the dashboard remains a true mirror of Resend.
    if (!message && providerEmailId) {
      const outboundRecipient = firstEmail(data?.to);
      const inboundSender = firstEmail(data?.from);
      const recipientEmail = type === "email.received" ? inboundSender : outboundRecipient;
      const created = await supabaseServerRequest<any[]>("gencouv_email_messages", {
        method: "POST",
        body: JSON.stringify({
          organization_id: GENCOUV_ORG_ID,
          provider: "resend",
          provider_email_id: providerEmailId,
          recipient_email: recipientEmail || null,
          subject: String(data?.subject || ""),
          status,
          scheduled_at: status === "scheduled" ? occurredAt : null,
          sent_at: ["sent", "delivered", "opened", "clicked", "bounced", "complained", "failed", "suppressed"].includes(status)
            ? occurredAt
            : null,
          last_event_at: occurredAt,
          created_at: occurredAt,
          updated_at: new Date().toISOString(),
        }),
      });
      message = created[0];
    }

    await supabaseServerRequest("gencouv_email_events", {
      method: "POST",
      body: JSON.stringify({
        organization_id: GENCOUV_ORG_ID,
        email_message_id: message?.id || null,
        provider: "resend",
        provider_event_id: providerEventId,
        provider_email_id: providerEmailId || null,
        event_type: type,
        occurred_at: occurredAt,
        payload,
      }),
    });

    if (message?.id) {
      const patch: Record<string, unknown> = {
        status,
        last_event_at: occurredAt,
        updated_at: new Date().toISOString(),
      };
      const timestampColumns: Record<string, string> = {
        scheduled: "scheduled_at",
        sent: "sent_at",
        delivered: "delivered_at",
        opened: "opened_at",
        clicked: "clicked_at",
        bounced: "bounced_at",
        complained: "complained_at",
        failed: "failed_at",
        suppressed: "suppressed_at",
      };
      if (timestampColumns[status]) patch[timestampColumns[status]] = occurredAt;
      if (["bounced", "failed", "suppressed"].includes(status)) {
        patch.error_code = String(data?.bounce?.type || data?.error?.code || status);
        patch.error_message = String(data?.bounce?.message || data?.error?.message || "");
      }
      await supabaseServerRequest(`gencouv_email_messages?id=eq.${message.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    }

    return NextResponse.json({ success: true, synced_message: Boolean(message?.id) });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 },
    );
  }
}
