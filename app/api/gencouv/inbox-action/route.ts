import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Admin session required." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const messageId = clean(body.message_id || body.id, 80);
    const action = clean(body.action, 80).toLowerCase();
    if (!messageId) return NextResponse.json({ success: false, message: "message_id is required." }, { status: 400 });

    const rows = await supabaseServerRequest<any[]>(`gencouv_email_messages?select=*&id=eq.${encodeURIComponent(messageId)}&limit=1`);
    const message = rows[0];
    if (!message) return NextResponse.json({ success: false, message: "Message not found." }, { status: 404 });

    const now = new Date().toISOString();
    const metadata = {
      ...(message.metadata || {}),
      last_dashboard_action: action,
      last_dashboard_actor: session.email,
      last_dashboard_action_at: now,
    };
    const patch: Record<string, unknown> = { metadata, updated_at: now };

    if (action === "mark_read") patch.read_at = message.read_at || now;
    else if (action === "mark_unread") patch.read_at = null;
    else if (action === "archive") patch.archived_at = message.archived_at || now;
    else if (action === "mark_qualified") patch.status = "qualified_reply";
    else if (action === "move_follow_up") patch.status = "human_follow_up";
    else if (action === "do_not_contact") {
      patch.status = "do_not_contact";
      patch.stop_reason = "manual_do_not_contact";
    } else {
      return NextResponse.json({ success: false, message: "Unsupported inbox action." }, { status: 400 });
    }

    await supabaseServerRequest(`gencouv_email_messages?id=eq.${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });

    if (action === "do_not_contact" && message.recipient_email) {
      await supabaseServerRequest(
        `gencouv_campaign_enrollments?normalized_email=eq.${encodeURIComponent(String(message.recipient_email).toLowerCase())}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            campaign_status: "stopped",
            do_not_contact: true,
            stop_reason: "manual_do_not_contact",
            updated_at: now,
          }),
        },
      ).catch(() => null);
    }

    return NextResponse.json({ success: true, message: "Inbox action recorded." });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Unable to update inbox item." },
      { status: 500 },
    );
  }
}
