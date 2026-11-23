import { NextResponse } from "next/server";
import { requireGencouvAdmin, gencouvError } from "@/lib/gencouv-admin";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

function clean(value: unknown, max = 500) {
  return String(value || "").trim().slice(0, max);
}

export async function POST(request: Request) {
  try {
    const {session,organizationId,db}=await requireGencouvAdmin(request);
    const body = await request.json();
    const messageId = clean(body.message_id || body.id, 80);
    const action = clean(body.action, 80).toLowerCase();
    if (!messageId) return NextResponse.json({ success: false, message: "message_id is required." }, { status: 400 });

    const rows = await supabaseServerRequest<Array<{id:string;recipient_email:string;metadata:Record<string,unknown>;read_at:string|null;archived_at:string|null}>>(`gencouv_email_messages?organization_id=eq.${organizationId}&select=*&id=eq.${encodeURIComponent(messageId)}&limit=1`);
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

    await supabaseServerRequest(`gencouv_email_messages?organization_id=eq.${organizationId}&id=eq.${messageId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });

    if (action === "do_not_contact" && message.recipient_email) {
      const result=await db.from("gencouv_suppression_list").upsert({organization_id:organizationId,normalized_email:String(message.recipient_email).toLowerCase(),reason:"manual_do_not_contact",source:"dashboard"},{onConflict:"organization_id,normalized_email"});
      if(result.error)throw result.error;
      await supabaseServerRequest(
        `gencouv_campaign_enrollments?organization_id=eq.${organizationId}&normalized_email=eq.${encodeURIComponent(String(message.recipient_email).toLowerCase())}`,
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
      { success: false, message: gencouvError(error).message },
      { status: gencouvError(error).status },
    );
  }
}
