import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { generateLeoReasoning } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import { resolveLeoIdentity } from "@/lib/leo-core";
import {
  buildSupportReply,
  collectSupportDiagnostics,
  getSupportConversationForScope,
  listSupportConversationsForScope,
  type SupportAction,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support-agent";

async function requireAdmin() {
  return (await getAdminSession()) || null;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  const conversation = conversationId
    ? await getSupportConversationForScope(conversationId, "admin")
    : null;
  const conversations = await listSupportConversationsForScope("admin");
  const messages = conversation
    ? await supabaseServerRequest<SupportMessage[]>(
        `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.asc`,
      ).catch(() => [])
    : [];
  const actions = conversation
    ? await supabaseServerRequest<SupportAction[]>(
        `support_actions?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.desc`,
      ).catch(() => [])
    : [];

  return NextResponse.json({ ok: true, conversations, messages, actions });
}

export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim();
    const organizationId = String(body.organizationId || "").trim() || undefined;
    let conversationId = String(body.conversationId || "").trim();
    if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

    if (conversationId) {
      const existing = await getSupportConversationForScope(conversationId, "admin");
      if (!existing) return NextResponse.json({ error: "Support conversation not found." }, { status: 404 });
    } else {
      const rows = await supabaseServerRequest<SupportConversation[]>("support_conversations", {
        method: "POST",
        body: JSON.stringify({
          organization_id: organizationId || null,
          title: message.slice(0, 80),
          status: "diagnosing",
          created_by: session.email,
          assigned_agent: "agent-leo",
          metadata: { scope: "admin", engine: "shared-leo-ai-runtime" },
        }),
      });
      conversationId = rows[0]?.id || "";
    }
    if (!conversationId) throw new Error("Unable to create support conversation.");

    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, role: "user", content: message }),
    });

    try {
      const identity = await resolveLeoIdentity({ channel: "chat", allowPublic: false });
      if (!identity || identity.scope !== "super_admin") {
        throw new Error("Super Admin Leo identity could not be resolved.");
      }

      const context = await buildLeoReasoningContext({
        identity,
        pageContext: {
          pathname: "/dashboard/support",
          section: "super-admin-leo",
          resourceType: "admin_support",
          resourceId: organizationId,
        },
      });

      const history = await supabaseServerRequest<SupportMessage[]>(
        `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`,
      ).catch(() => []);

      const result = await generateLeoReasoning({
        identity,
        message,
        history: history.map((item) => ({
          role: item.role === "assistant" ? "assistant" : "user",
          content: String(item.content || "").slice(0, 3000),
        })),
        context,
      });

      if (!result.ok) {
        throw new Error(`Shared Leo AI runtime failed: ${result.reason}.`);
      }

      const diagnostics = {
        engine: "shared-leo-ai-runtime",
        provider: result.provider,
        model: result.model,
        latency_ms: result.latencyMs,
        intent: result.intent,
        confidence: result.confidence,
        needs_human_review: result.needsHumanReview,
        tool_proposals: result.toolCalls,
      };

      await supabaseServerRequest("support_messages", {
        method: "POST",
        body: JSON.stringify({
          conversation_id: conversationId,
          role: "assistant",
          content: result.reply,
          diagnostics,
        }),
      });

      await supabaseServerRequest(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: result.toolCalls.some((tool) => tool.approval !== "none") ? "waiting_approval" : "open",
          updated_at: new Date().toISOString(),
          metadata: { scope: "admin", engine: "shared-leo-ai-runtime", model: result.model },
        }),
      });

      const actions = await supabaseServerRequest<SupportAction[]>(
        `support_actions?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.desc&limit=10`,
      ).catch(() => []);

      return NextResponse.json({
        ok: true,
        conversationId,
        reply: result.reply,
        diagnostics,
        actions,
        engine: "shared-leo-ai-runtime",
        ai: { connected: true, provider: result.provider, model: result.model, latencyMs: result.latencyMs },
      });
    } catch (aiError) {
      const reason = aiError instanceof Error ? aiError.message : "Unknown Leo AI failure.";
      console.error("Shared Super Admin Leo AI unavailable:", reason);

      const history = await supabaseServerRequest<SupportMessage[]>(
        `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`,
      ).catch(() => []);
      const diagnostics = await collectSupportDiagnostics("admin", organizationId);
      const fallback = buildSupportReply(message, diagnostics, history.slice(0, -1));
      const visibleReply = ["Leo switched to safe diagnostic mode for this response.", "", fallback.content].join("\n");

      await supabaseServerRequest("support_messages", {
        method: "POST",
        body: JSON.stringify({ conversation_id: conversationId, role: "assistant", content: visibleReply, diagnostics: { ...diagnostics, engine: "rule-fallback", fallback_reason: reason } }),
      });

      const createdActions: SupportAction[] = [];
      for (const action of fallback.actions) {
        const rows = await supabaseServerRequest<SupportAction[]>("support_actions", {
          method: "POST",
          body: JSON.stringify({ conversation_id: conversationId, ...action }),
        });
        if (rows[0]) createdActions.push(rows[0]);
      }

      return NextResponse.json({
        ok: true,
        conversationId,
        reply: visibleReply,
        diagnostics: { ...diagnostics, fallback_reason: reason },
        actions: createdActions,
        engine: "rule-fallback",
        ai: { connected: false },
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Agent Leo could not complete the diagnostic." },
      { status: 500 },
    );
  }
}
