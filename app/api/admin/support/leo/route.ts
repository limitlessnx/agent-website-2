import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
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

const leoWebhookUrl = process.env.LEO_N8N_WEBHOOK_URL || "https://n8n.srv1720757.hstgr.cloud/webhook/fluxknight-leo-control-v1";

async function requireAdmin() { return (await getAdminSession()) || null; }

async function askLeoN8n(input: { message: string; conversationId: string; organizationId?: string; actor: string }) {
  const response = await fetch(leoWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: input.message,
      conversation_id: input.conversationId,
      organization_id: input.organizationId || null,
      actor: input.actor,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(95000),
  });
  if (!response.ok) throw new Error(`Leo n8n engine returned ${response.status}.`);
  return response.json() as Promise<{
    ok?: boolean;
    reply?: string;
    diagnosis?: string[];
    evidence?: string[];
    action?: SupportAction | null;
    approval_required?: boolean;
    execution?: Record<string, unknown> | null;
  }>;
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const conversationId = request.nextUrl.searchParams.get("conversationId") || "";
  const conversation = conversationId ? await getSupportConversationForScope(conversationId, "admin") : null;
  const conversations = await listSupportConversationsForScope("admin");
  const messages = conversation ? await supabaseServerRequest<SupportMessage[]>(`support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.asc`).catch(() => []) : [];
  const actions = conversation ? await supabaseServerRequest<SupportAction[]>(`support_actions?select=*&conversation_id=eq.${encodeURIComponent(conversation.id)}&order=created_at.desc`).catch(() => []) : [];
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
        body: JSON.stringify({ organization_id: organizationId || null, title: message.slice(0, 80), status: "diagnosing", created_by: session.email, assigned_agent: "agent-leo", metadata: { scope: "admin", engine: "n8n-ai-control-plane" } }),
      });
      conversationId = rows[0]?.id || "";
    }
    if (!conversationId) throw new Error("Unable to create support conversation.");

    await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: conversationId, role: "user", content: message }) });

    try {
      const leo = await askLeoN8n({ message, conversationId, organizationId, actor: session.email });
      const reply = String(leo.reply || "Agent Leo completed the diagnostic review.");
      const diagnostics = { engine: "n8n-ai", diagnosis: leo.diagnosis || [], evidence: leo.evidence || [], execution: leo.execution || null };
      await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: conversationId, role: "assistant", content: reply, diagnostics }) });
      await supabaseServerRequest(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify({ status: leo.approval_required ? "waiting_approval" : "open", updated_at: new Date().toISOString(), metadata: { scope: "admin", engine: "n8n-ai-control-plane" } }) });
      const actions = await supabaseServerRequest<SupportAction[]>(`support_actions?conversation_id=eq.${encodeURIComponent(conversationId)}&select=*&order=created_at.desc&limit=10`).catch(() => []);
      return NextResponse.json({ ok: true, conversationId, reply, diagnostics, actions, engine: "n8n-ai" });
    } catch (n8nError) {
      const history = await supabaseServerRequest<SupportMessage[]>(`support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc`).catch(() => []);
      const diagnostics = await collectSupportDiagnostics("admin", organizationId);
      const fallback = buildSupportReply(message, diagnostics, history.slice(0, -1));
      await supabaseServerRequest("support_messages", { method: "POST", body: JSON.stringify({ conversation_id: conversationId, role: "assistant", content: fallback.content, diagnostics: { ...diagnostics, fallback_reason: n8nError instanceof Error ? n8nError.message : "n8n unavailable" } }) });
      const createdActions: SupportAction[] = [];
      for (const action of fallback.actions) {
        const rows = await supabaseServerRequest<SupportAction[]>("support_actions", { method: "POST", body: JSON.stringify({ conversation_id: conversationId, ...action }) });
        if (rows[0]) createdActions.push(rows[0]);
      }
      await supabaseServerRequest(`support_conversations?id=eq.${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify({ status: createdActions.length ? "waiting_approval" : "open", updated_at: new Date().toISOString()) });
      return NextResponse.json({ ok: true, conversationId, reply: fallback.content, diagnostics, actions: createdActions, engine: "rule-fallback" });
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent Leo could not complete the diagnostic." }, { status: 500 });
  }
}
