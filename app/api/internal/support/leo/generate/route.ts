import { NextRequest, NextResponse } from "next/server";
import { generateSupportAgentReply } from "@/lib/ai/support-model";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import {
  buildSupportReply,
  collectSupportDiagnostics,
  getSupportConversationForScope,
  type SupportMessage,
  type SupportScope,
} from "@/lib/support-agent";

function authorized(request: NextRequest) {
  const expected = process.env.LEO_N8N_SHARED_SECRET?.trim();
  const supplied = request.headers.get("x-fluxknight-leo-secret")?.trim();
  return Boolean(expected && supplied && supplied === expected);
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const startedAt = Date.now();
  const body = await request.json().catch(() => ({}));
  const scope: SupportScope = body.scope === "tenant" ? "tenant" : "admin";
  const organizationId = String(body.organizationId || body.organization_id || "").trim() || undefined;
  const conversationId = String(body.conversationId || body.conversation_id || "").trim();
  const message = String(body.message || "").trim().slice(0, 8000);

  if (!message) return NextResponse.json({ ok: false, error: "Message is required." }, { status: 400 });
  if (scope === "tenant" && !organizationId) {
    return NextResponse.json({ ok: false, error: "Tenant organization is required." }, { status: 400 });
  }

  if (conversationId) {
    const conversation = await getSupportConversationForScope(conversationId, scope, organizationId);
    if (!conversation) return NextResponse.json({ ok: false, error: "Conversation is outside this support scope." }, { status: 404 });
  }

  const history = conversationId
    ? await supabaseServerRequest<SupportMessage[]>(
        `support_messages?select=*&conversation_id=eq.${encodeURIComponent(conversationId)}&order=created_at.asc&limit=30`,
      ).catch(() => [])
    : [];
  const diagnostics = await collectSupportDiagnostics(scope, organizationId);
  const aiResult = await generateSupportAgentReply({
    message,
    history,
    diagnostics: diagnostics as unknown as Record<string, unknown>,
    scope,
    organizationId,
  });

  if (aiResult.ok) {
    return NextResponse.json({
      ok: true,
      reply: aiResult.response.reply,
      category: aiResult.response.category,
      confidence: aiResult.response.confidence,
      needsHumanReview: aiResult.response.needsHumanReview,
      proposedActions: aiResult.response.proposedActions,
      diagnostics: aiResult.diagnostics,
      ai: {
        connected: true,
        provider: aiResult.provider,
        model: aiResult.model,
        fallbackUsed: false,
        latencyMs: aiResult.latencyMs,
      },
    });
  }

  const fallback = buildSupportReply(message, diagnostics, history);
  return NextResponse.json({
    ok: true,
    reply: fallback.content,
    category: null,
    confidence: null,
    needsHumanReview: false,
    proposedActions: fallback.actions.slice(0, 3).map((action) => ({
      actionKey: action.action_key,
      title: action.title,
      description: action.description,
      riskLevel: action.risk_level,
    })),
    diagnostics: aiResult.diagnostics,
    ai: {
      connected: false,
      provider: aiResult.provider,
      model: aiResult.model,
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
    },
  });
}
