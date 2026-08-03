import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import {
  buildSupportReply,
  collectSupportDiagnostics,
  getSupportConversationForScope,
  listSupportConversationsForScope,
  type SupportAction,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support-agent";

export async function GET(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  const conversation = conversationId
    ? await getSupportConversationForScope(conversationId, "tenant", session.organizationId)
    : null;
  const conversations = await listSupportConversationsForScope("tenant", session.organizationId);
  const messages = conversation
    ? await supabaseServerRequest<SupportMessage[]>(
        `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.asc`,
      ).catch(() => [])
    : [];
  const actions = conversation
    ? await supabaseServerRequest<SupportAction[]>(
        `support_actions?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&organization_id=eq.${encodeURIComponent(session.organizationId)}&order=created_at.desc`,
      ).catch(() => [])
    : [];

  return NextResponse.json({ ok: true, conversations, messages, actions });
}

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    let conversationId = String(body.conversationId || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    if (conversationId) {
      const existing = await getSupportConversationForScope(conversationId, "tenant", session.organizationId);
      if (!existing) return NextResponse.json({ error: "Support conversation not found in this tenant workspace." }, { status: 404 });
    } else {
      const rows = await supabaseServerRequest<SupportConversation[]>("support_conversations", {
        method: "POST",
        body: JSON.stringify({
          organization_id: session.organizationId,
          title: message.slice(0, 80),
          status: "diagnosing",
          created_by: session.email,
          assigned_agent: "agent-leo",
          metadata: { scope: "tenant", role: session.role, membership_id: session.membershipId },
        }),
      });
      conversationId = rows[0]?.id || "";
    }
    if (!conversationId) throw new Error("Unable to create support conversation.");

    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, role: "user", content: message }),
    });
    const history = await supabaseServerRequest<SupportMessage[]>(
      `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`,
    ).catch(() => []);
    const diagnostics = await collectSupportDiagnostics("tenant", session.organizationId);
    const reply = buildSupportReply(message, diagnostics, history.slice(0, -1));
    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, role: "assistant", content: reply.content, diagnostics }),
    });

    const createdActions: SupportAction[] = [];
    for (const action of reply.actions) {
      const rows = await supabaseServerRequest<SupportAction[]>("support_actions", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          ...action,
          organization_id: session.organizationId,
        }),
      });
      if (rows[0]) createdActions.push(rows[0]);
    }

    await supabaseServerRequest(
      `support_conversations?id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(session.organizationId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status: createdActions.length ? "waiting_approval" : "open", updated_at: new Date().toISOString() }),
      },
    );
    return NextResponse.json({ ok: true, conversationId, reply: reply.content, diagnostics, actions: createdActions });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent Leo could not complete the tenant diagnostic." },
      { status: 500 },
    );
  }
}
