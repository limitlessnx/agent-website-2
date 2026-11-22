import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { verifyGencouvResendSignature } from "@/lib/gencouv-resend-signature";
import { resendApi } from "@/lib/fluxknight-mail";
import { GENCOUV_SENDERS } from "@/lib/gencouv-admin";

type ThreadMessage={id:string;sequence_id?:string;sequence_step_id?:string;lead_id?:string;provider_message_id?:string;message_id_header?:string};

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";

function iso(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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
    const matches = await supabaseServerRequest<ThreadMessage[]>(
      `gencouv_email_messages?organization_id=eq.${GENCOUV_ORG_ID}&select=*&or=(message_id_header.eq.${encoded},provider_message_id.eq.${encoded})&limit=1`,
    ).catch(() => []);
    if (matches[0]) return matches[0];
  }

  if (!senderEmail) return null;
  const fallback = await supabaseServerRequest<ThreadMessage[]>(
    `gencouv_email_messages?organization_id=eq.${GENCOUV_ORG_ID}&select=*&recipient_email=eq.${encodeURIComponent(senderEmail)}&direction=eq.outbound&order=created_at.desc&limit=1`,
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
      signal: AbortSignal.timeout(5000),
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

async function updateEnrollment(email: string, patch: Record<string, unknown>) {
  if (!email) return;
  await supabaseServerRequest(
    `gencouv_campaign_enrollments?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch(() => undefined);
  await supabaseServerRequest(
    `gencouv_qualified_leads?organization_id=eq.${GENCOUV_ORG_ID}&normalized_email=eq.${encodeURIComponent(email)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        ...patch,
        updated_at: new Date().toISOString(),
      }),
    },
  ).catch(() => undefined);
}

export async function POST(request: Request) {
  try {
    const secret = process.env.GENCOUV_RESEND_WEBHOOK_SECRET || "";
    if (!secret) return NextResponse.json({ success: false, message: "Webhook verification is not configured." }, { status: 503 });
    const raw = await request.text();
    if (!verifyGencouvResendSignature(raw, request.headers, secret)) return NextResponse.json({ success: false, message: "Invalid webhook signature." }, { status: 401 });
    const payload = JSON.parse(raw);
    const type = String(payload?.type || "unknown");
    let data = payload?.data || {};
    const providerEmailId = String(data?.email_id || data?.id || "");
    const occurredAt = iso(payload?.created_at || data?.created_at);
    const providerEventId = request.headers.get("svix-id") || String(payload?.id || `${type}:${providerEmailId}:${occurredAt}`);

    const isInbound = type === "email.received";
    if (!isInbound) {
      if (!GENCOUV_SENDERS.has(firstEmail(data.from))) return NextResponse.json({ success: true, ignored: true });
      if (!["email.sent", "email.delivered", "email.opened", "email.clicked", "email.bounced", "email.failed", "email.complained", "email.suppressed", "email.unsubscribed", "email.delivery_delayed", "email.scheduled"].includes(type)) return NextResponse.json({ success: true, ignored: true });
      const result = await supabaseServerRequest("rpc/gencouv_apply_delivery_event", { method: "POST", body: JSON.stringify({ p_event_id: providerEventId, p_type: type, p_data: data, p_occurred_at: occurredAt }) });
      const sheetSync=await syncEventToN8n(payload,type,providerEventId);
      return NextResponse.json({ success: true, result, sheet_sync:sheetSync });
    }
    const inboundRecipients = Array.isArray(data.to) ? data.to : [data.to];
    if (!inboundRecipients.some((recipient: unknown) => GENCOUV_SENDERS.has(firstEmail(recipient)))) return NextResponse.json({ success: true, ignored: true });

    const existing = await supabaseServerRequest<ThreadMessage[]>(
      `gencouv_email_events?organization_id=eq.${GENCOUV_ORG_ID}&select=id&provider_event_id=eq.${encodeURIComponent(providerEventId)}&limit=1`,
    );
    if (existing.length) return NextResponse.json({ success: true, duplicate: true });
    // Received-event payloads contain metadata, not the message body. Fetch the
    // received email before acknowledging, so provider retries can recover a read failure.
    if(!data.text && !data.html && !data.text_body && !data.html_body){
      const received=await resendApi("/emails/receiving/"+encodeURIComponent(providerEmailId));
      data={...received,...data,headers:received.headers||data.headers,text:received.text||data.text,html:received.html||data.html};
    }
    const messageIdHeader = textValue(data?.message_id || headerValue(data, "Message-ID"));
    const inReplyToHeader = textValue(data?.in_reply_to || headerValue(data, "In-Reply-To"));
    const referencesHeader = textValue(data?.references || headerValue(data, "References"));
    const autoReply=classifyAutoReply(data);


    let message;
    if (isInbound) {
      const inboundSender = firstEmail(data?.from);
      const threadMessage = await findThreadMessage(data, inboundSender);
      const created = await supabaseServerRequest<ThreadMessage[]>("gencouv_email_messages?on_conflict=provider_email_id", {
        headers: {Prefer:"resolution=ignore-duplicates,return=representation"},
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
      message = created[0] || (await supabaseServerRequest<ThreadMessage[]>(`gencouv_email_messages?organization_id=eq.${GENCOUV_ORG_ID}&provider_email_id=eq.${encodeURIComponent(providerEmailId)}&limit=1`))[0];
      if(!message)throw new Error("Inbound ledger unavailable");

      if (!autoReply && threadMessage?.id) {
        await supabaseServerRequest(`gencouv_email_messages?organization_id=eq.${GENCOUV_ORG_ID}&id=eq.${threadMessage.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: "replied",
            last_event_at: occurredAt,
            stop_reason: "genuine_reply",
            updated_at: new Date().toISOString(),
          }),
        });
      }
      await updateEnrollment(inboundSender, {
        reply_status: autoReply ? "auto_reply" : "genuine_reply",
        replied_at: occurredAt,
        last_event_at: occurredAt,
        campaign_status: autoReply ? undefined : "human_follow_up",
        stop_reason: autoReply ? undefined : "genuine_reply",
      });
    }

    await supabaseServerRequest("gencouv_email_events?on_conflict=provider,provider_event_id", {
      headers:{Prefer:"resolution=ignore-duplicates,return=representation"},
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

    const sheetSync = await syncEventToN8n(payload, type, providerEventId);

    return NextResponse.json({ success: true, synced_message: Boolean(message?.id), sheet_sync: sheetSync });
  } catch {
    return NextResponse.json(
      { success: false, message: "Webhook processing failed. Retry the signed event." },
      { status: 500 },
    );
  }
}
