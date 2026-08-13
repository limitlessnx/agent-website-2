import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";
const FROM_EMAIL = "Gencouv <info@gencouv.com>";
const REPLY_TO_EMAIL = "support@gencouv.com";

function clean(value: unknown, max = 8000) {
  return String(value || "").trim().slice(0, max);
}

function normalizeEmail(value: unknown) {
  const raw = clean(value, 320);
  const match = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return (match?.[0] || raw).toLowerCase();
}

function htmlFromText(value: string) {
  const escape = (char: string) => {
    if (char === "&") return "&amp;";
    if (char === "<") return "&lt;";
    if (char === ">") return "&gt;";
    return char;
  };
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replace(/[&<>]/g, escape).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Admin session required." }, { status: 401 });
  }

  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, message: "RESEND_API_KEY is not configured." }, { status: 500 });
    }

    const body = await request.json();
    const inboundId = clean(body.inbound_message_id || body.message_id, 80);
    const to = normalizeEmail(body.to || body.recipient_email);
    const subjectInput = clean(body.subject, 300);
    const replyText = clean(body.message || body.text_body, 12000);

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ success: false, message: "A valid recipient email is required." }, { status: 400 });
    }
    if (!replyText) {
      return NextResponse.json({ success: false, message: "Reply message is required." }, { status: 400 });
    }

    const inboundRows = inboundId
      ? await supabaseServerRequest<any[]>(`gencouv_email_messages?select=*&id=eq.${encodeURIComponent(inboundId)}&limit=1`).catch(() => [])
      : [];
    const inbound = inboundRows[0];
    const relatedRows = inbound?.reply_to_message_id
      ? await supabaseServerRequest<any[]>(`gencouv_email_messages?select=*&id=eq.${encodeURIComponent(inbound.reply_to_message_id)}&limit=1`).catch(() => [])
      : [];
    const related = relatedRows[0];

    const inReplyTo = clean(inbound?.message_id_header || inbound?.provider_message_id || inbound?.in_reply_to_header, 500);
    const previousReferences = clean(inbound?.references_header || related?.references_header || related?.message_id_header || related?.provider_message_id, 4000);
    const references = [previousReferences, inReplyTo].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const subject = /^re:/i.test(subjectInput || inbound?.subject || "") ? clean(subjectInput || inbound?.subject, 300) : `Re: ${clean(subjectInput || inbound?.subject || "Gencouv", 280)}`;
    const now = new Date().toISOString();
    const idempotencyKey = `gencouv-reply-${inboundId || to}-${Date.now()}`.slice(0, 240);

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        reply_to: REPLY_TO_EMAIL,
        subject,
        text: replyText,
        html: htmlFromText(replyText),
        headers: {
          ...(inReplyTo ? { "In-Reply-To": inReplyTo } : {}),
          ...(references ? { References: references } : {}),
        },
      }),
    });

    const resendData = await resendResponse.json().catch(() => ({}));
    if (!resendResponse.ok) {
      return NextResponse.json(
        { success: false, message: resendData?.message || "Resend rejected the reply send request." },
        { status: resendResponse.status },
      );
    }

    const created = await supabaseServerRequest<any[]>("gencouv_email_messages", {
      method: "POST",
      body: JSON.stringify({
        organization_id: GENCOUV_ORG_ID,
        sequence_id: inbound?.sequence_id || related?.sequence_id || null,
        sequence_step_id: inbound?.sequence_step_id || related?.sequence_step_id || null,
        lead_id: inbound?.lead_id || related?.lead_id || null,
        recipient_email: to,
        from_email: "info@gencouv.com",
        reply_to_message_id: inbound?.id || related?.id || null,
        provider: "resend",
        provider_email_id: resendData?.id || null,
        subject,
        status: "sent",
        direction: "outbound",
        in_reply_to_header: inReplyTo || null,
        references_header: references || null,
        text_body: replyText,
        html_body: htmlFromText(replyText),
        sent_at: now,
        last_event_at: now,
        metadata: {
          source: "fluxknight_dashboard_reply",
          admin_email: session.email,
          reply_to_inbound_message_id: inbound?.id || null,
          resend_response: resendData,
        },
        created_at: now,
        updated_at: now,
      }),
    });

    if (inbound?.id) {
      await supabaseServerRequest(`gencouv_email_messages?id=eq.${inbound.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          read_at: inbound.read_at || now,
          replied_from_dashboard_at: now,
          updated_at: now,
        }),
      }).catch(() => null);
    }

    return NextResponse.json({ success: true, message: "Reply sent.", email: created[0] || null });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to send Gencouv reply." },
      { status: 500 },
    );
  }
}
