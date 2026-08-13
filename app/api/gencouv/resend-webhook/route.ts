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
  const raw = Array.isArray(value) ? String(value[0] || "") : String(value || "");
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] || raw).trim().toLowerCase();
}

function textValue(value: unknown) {
  return String(value || "").trim();
}

function headerValue(data: Record<string, unknown>, name: string) {
  const direct = data[name] || data[name.toLowerCase()] || data[name.toUpperCase()];
  if (direct) return textValue(direct);
  const headers = data.headers;
  if (headers && typeof headers === "object" && !Array.isArray(headers)) {
    const found = Object.entries(headers as Record<string, unknown>).find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found ? textValue(found[1]) : "";
  }
  if (Array.isArray(headers)) {
    const found = headers.find((header) => {
      if (!header || typeof header !== "object") return false;
      const entry = header as Record<string, unknown>;
      return textValue(entry.name || entry.key).toLowerCase() === name.toLowerCase();
    }) as Record<string, unknown> | undefined;
    return found ? textValue(found.value) : "";
  }
  return "";
}

function classifyAutoReply(data: Record<string, unknown>) {
  const subject = textValue(data.subject).toLowerCase();
  const body = [data.text, data.html, data.text_body, data.html_body].map(textValue).join(" ").toLowerCase();
  const autoSubmitted = headerValue(data, "Auto-Submitted").toLowerCase();
  const precedence = headerValue(data, "Precedence").toLowerCase();
  const xAutoResponseSuppress = headerValue(data, "X-Auto-Response-Suppress").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") return true;
  if (["bulk", "junk", "list"].includes(precedence)) return true;
  if (xAutoResponseSuppress) return true;
  return /(automatic reply|auto.?reply|out of office|away from the office|vacation responder|delivery status notification|undeliverable|mail delivery subsystem)/i.test(
    `${subject} ${body}`,
  );
}

async function findThreadMessage(data: Record<string, unknown>, senderEmail: string) {
  const inReplyTo = headerValue(data, "In-Reply-To") || textValue(data.in_reply_to);
  const references = headerValue(data, "References") || textValue(data.references);
  const candidates = [inReplyTo, ...references.split(/\s+/)].map((value) => value.trim()).filter(Boolean);

  for (const candidate of candidates) {
    const encoded = encodeURIComponent(candidate);
    const matches = await supabaseServerRequest<any[]>(
      `gencouv_email_messages?select=*&or=(message_id_header.eq.${encoded},provider_message_id.eq.${encoded})&limit=1`,
    ).catch(() => []);
    if (matches[0]) return matches[0];
  }

  if (!senderEmail) return null;
  const fallback = await supabaseServerRequest<any[]>(
    `gencouv_email_messages?select=*&recipient_email=eq.${encodeURIComponent(senderEmail)}&direction=eq.outbound&order=created_at.desc&limit=1`,
  ).catch(() => []);
  return fallback[0] || null;
}

async function syncEventToN8n(payload: unknown, eventType: string, providerEventId: string) {
  const enabled = process.env.GENCOUV_RESEND_N8N_SYNC_ENABLED === "true";
  if (!enabled) return { attempted: false, ok: false, disabled: true };

  const url = process.env.GENCOUV_RESEND_N8N_SYNC_URL || "";
  const secret = process.env.GENCOUV_EMAIL_EVENT_SECRET || process.env.GENCOUV_DASHBOARD_SECRET || "";
  if (!url || !secret) return { attempted: false, ok: false };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-gencouv-event-secret": secret,
      },
      body: JSON.stringify({
        ...(payload && typeof payload === "object" ? payload : { payload }),
        provider_event_id: providerEventId,
        event_type: eventType,
        source: "resend-webhook",
      }),
    });
    return { attempted: true, ok: response.ok, status: response.status };
  } catch {
    return { attempted: true, ok: false };
  }
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
    const messageIdHeader = textValue(data?.message_id || headerValue(data, "Message-ID"));
    const inReplyToHeader = textValue(data?.in_reply_to || headerValue(data, "In-Reply-To"));
    const referencesHeader = textValue(data?.references || headerValue(data, "References"));
    const isInbound = type === "email.received";
    const autoReply = isInbound ? classifyAutoReply(data) : false;

    const existing = await supabaseServerRequest<any[]>(
      `gencouv_email_events?select=id&provider_event_id=eq.${encodeURIComponent(providerEventId)}&limit=1`,
    );
    if (existing.length) return NextResponse.json({ success: true, duplicate: true });

    let messages = !isInbound && providerEmailId
      ? await supabaseServerRequest<any[]>(
          `gencouv_email_messages?select=*&provider_email_id=eq.${encodeURIComponent(providerEmailId)}&limit=1`,
        )
      : [];
    let message = messages[0];

    if (isInbound) {
      const inboundSender = firstEmail(data?.from);
      const threadMessage = await findThreadMessage(data, inboundSender);
      const created = await supabaseServerRequest<any[]>("gencouv_email_messages", {
        method: "POST",
        body: JSON.stringify({
          organization_id: GENCOUV_ORG_ID,
          sequence_id: threadMessage?.sequence_id || null,
          sequence_step_id: threadMessage?.sequence_step_id || null,
          lead_id: threadMessage?.lead_id || null,
          recipient_email: inboundSender || "unknown@gencouv.invalid",
          from_email: inboundSender || null,
          reply_to_message_id: threadMessage?.id || null,
          provider: "resend",
          provider_email_id: providerEmailId || null,
          provider_message_id: messageIdHeader || null,
          message_id_header: messageIdHeader || null,
          in_reply_to_header: inReplyToHeader || null,
          references_header: referencesHeader || null,
          subject: textValue(data?.subject || "Inbound reply"),
          status: autoReply ? "auto_reply" : "replied",
          direction: "inbound",
          text_body: textValue(data?.text || data?.text_body),
          html_body: textValue(data?.html || data?.html_body),
          is_auto_reply: autoReply,
          last_event_at: occurredAt,
          stop_reason: autoReply ? null : "genuine_reply",
          metadata: {
            resend_event_type: type,
            to: data?.to || [],
            cc: data?.cc || [],
            bcc: data?.bcc || [],
            auto_reply: autoReply,
          },
          created_at: occurredAt,
          updated_at: new Date().toISOString(),
        }),
      });
      message = created[0];

      if (!autoReply && threadMessage?.id) {
        await supabaseServerRequest(`gencouv_email_messages?id=eq.${threadMessage.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "replied",
            last_event_at: occurredAt,
            stop_reason: "genuine_reply",
            updated_at: new Date().toISOString(),
          }),
        });
      }
    }

    // Resend Automations can send outside Fluxknight, so those messages may not
    // already exist in gencouv_email_messages. Create the missing record from
    // the webhook itself so the dashboard remains a true mirror of Resend.
    if (!message && providerEmailId) {
      const outboundRecipient = firstEmail(data?.to);
      const created = await supabaseServerRequest<any[]>("gencouv_email_messages", {
        method: "POST",
        body: JSON.stringify({
          organization_id: GENCOUV_ORG_ID,
          provider: "resend",
          provider_email_id: providerEmailId,
          provider_message_id: messageIdHeader || null,
          message_id_header: messageIdHeader || null,
          recipient_email: outboundRecipient || "unknown@gencouv.invalid",
          subject: String(data?.subject || ""),
          status,
          direction: "outbound",
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
      if (messageIdHeader) {
        patch.provider_message_id = message.provider_message_id || messageIdHeader;
        patch.message_id_header = message.message_id_header || messageIdHeader;
      }
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
      if (["bounced", "complained", "suppressed"].includes(status)) {
        patch.stop_reason = status;
      }
      await supabaseServerRequest(`gencouv_email_messages?id=eq.${message.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    }

    const sheetSync = await syncEventToN8n(payload, type, providerEventId);

    return NextResponse.json({ success: true, synced_message: Boolean(message?.id), sheet_sync: sheetSync });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 },
    );
  }
}
