import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { generateSupportAgentReply, SUPPORT_ACTION_KEYS, type SupportAIResponse } from "@/lib/ai/support-model";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { legacySupportActionPolicy, tenantLeoIdentityFromSession } from "@/lib/leo-support-policy";
import type { LeoIdentity } from "@/lib/leo-core";
import {
  buildSupportReply,
  collectSupportDiagnostics,
  getSupportConversationForScope,
  listSupportConversationsForScope,
  type SupportAction,
  type SupportConversation,
  type SupportMessage,
} from "@/lib/support-agent";

const allowedActionKeys = new Set<string>(SUPPORT_ACTION_KEYS);

async function loadTenantSupportContext(organizationId: string) {
  const [diagnostics, subscriptions, billingPlans, readiness] = await Promise.all([
    collectSupportDiagnostics("tenant", organizationId),
    supabaseServerRequest<Record<string, unknown>[]>(
      `organization_subscriptions?select=id,organization_id,plan_id,status,current_period_end&organization_id=eq.${encodeURIComponent(organizationId)}&order=updated_at.desc&limit=1`,
    ).catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>("billing_plans?select=id,name,status&order=created_at.asc").catch(() => []),
    supabaseServerRequest<Record<string, unknown>[]>(
      `agent_runtime_readiness?select=organization_id,agent_id,business_profile_ready,prompt_ready,knowledge_ready,integrations_ready,test_ready,approval_ready,workflow_ready,readiness_score,refreshed_at&organization_id=eq.${encodeURIComponent(organizationId)}&order=refreshed_at.desc&limit=50`,
    ).catch(() => []),
  ]);

  return { ...diagnostics, subscriptions, billingPlans, readiness };
}

async function recordUsage(input: {
  organizationId: string;
  model: string;
  provider: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  latencyMs: number;
}) {
  const quantity = input.usage?.totalTokens || input.usage?.outputTokens || 1;
  await supabaseServerRequest("usage_ledger", {
    method: "POST",
    body: JSON.stringify({
      organization_id: input.organizationId,
      usage_type: "ai_support",
      quantity,
      unit_cost_minor: 0,
      metadata: {
        provider: input.provider,
        model: input.model,
        input_tokens: input.usage?.inputTokens || null,
        output_tokens: input.usage?.outputTokens || null,
        total_tokens: input.usage?.totalTokens || null,
        latency_ms: input.latencyMs,
      },
      occurred_at: new Date().toISOString(),
    }),
  }).catch(() => null);
}

async function storeProposedActions(input: {
  conversationId: string;
  organizationId: string;
  identity: LeoIdentity;
  actions: SupportAIResponse["proposedActions"];
}) {
  const created: SupportAction[] = [];
  for (const action of input.actions.slice(0, 3)) {
    if (!allowedActionKeys.has(action.actionKey)) continue;
    const policy = legacySupportActionPolicy(input.identity, action.actionKey);
    if (!policy) continue;
    const rows = await supabaseServerRequest<SupportAction[]>("support_actions", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: input.conversationId,
        organization_id: input.organizationId,
        action_key: action.actionKey,
        title: action.title,
        description: action.description,
        risk_level: action.riskLevel,
        status: "proposed",
        payload: {
          source: "agent-leo-ai",
          canonical_tool_key: policy.canonicalKey,
          approval_required: policy.approval !== "none",
          approval_mode: policy.approval,
          requested_by_role: input.identity.role,
        },
      }),
    });
    if (rows[0]) created.push(rows[0]);
  }
  return created;
}

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
  const leoIdentity = tenantLeoIdentityFromSession(session);

  const requestStarted = Date.now();
  console.info("Agent Leo tenant support request started", {
    organizationId: session.organizationId,
    role: leoIdentity.role,
  });

  try {
    const body = await request.json().catch(() => ({}));
    const message = String(body.message || "").trim().slice(0, 8000);
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
          metadata: {
            scope: "tenant",
            role: leoIdentity.role,
            membership_id: session.membershipId,
            policy: "leo-core-v2",
          },
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
    const diagnosticContext = await loadTenantSupportContext(session.organizationId);

    const aiResult = await generateSupportAgentReply({
      message,
      history: history.slice(0, -1),
      diagnostics: diagnosticContext as unknown as Record<string, unknown>,
      scope: "tenant",
      organizationId: session.organizationId,
    });

    let replyText: string;
    let createdActions: SupportAction[] = [];
    let category: string | null = null;
    let confidence: number | null = null;
    let needsHumanReview = false;
    let model: string | null = null;
    let connected = false;
    let fallbackUsed = false;
    const safeDiagnostics = aiResult.diagnostics;

    if (aiResult.ok) {
      connected = true;
      model = aiResult.model;
      replyText = aiResult.response.reply;
      category = aiResult.response.category;
      confidence = aiResult.response.confidence;
      needsHumanReview = aiResult.response.needsHumanReview;
      createdActions = await storeProposedActions({
        conversationId,
        organizationId: session.organizationId,
        identity: leoIdentity,
        actions: aiResult.response.proposedActions,
      });
      void recordUsage({
        organizationId: session.organizationId,
        provider: aiResult.provider,
        model: aiResult.model,
        usage: aiResult.usage,
        latencyMs: aiResult.latencyMs,
      });
      console.info("Agent Leo tenant AI provider success", {
        organizationId: session.organizationId,
        role: leoIdentity.role,
        provider: aiResult.provider,
        model: aiResult.model,
        latencyMs: aiResult.latencyMs,
      });
    } else {
      fallbackUsed = true;
      const fallback = buildSupportReply(message, diagnosticContext, history.slice(0, -1));
      replyText = fallback.content;
      for (const action of fallback.actions.slice(0, 3)) {
        if (!allowedActionKeys.has(action.action_key)) continue;
        const policy = legacySupportActionPolicy(leoIdentity, action.action_key);
        if (!policy) continue;
        const rows = await supabaseServerRequest<SupportAction[]>("support_actions", {
          method: "POST",
          body: JSON.stringify({
            conversation_id: conversationId,
            organization_id: session.organizationId,
            action_key: action.action_key,
            title: action.title,
            description: action.description,
            risk_level: action.risk_level,
            status: "proposed",
            payload: {
              source: "agent-leo-fallback",
              canonical_tool_key: policy.canonicalKey,
              approval_required: policy.approval !== "none",
              approval_mode: policy.approval,
              requested_by_role: leoIdentity.role,
            },
          }),
        });
        if (rows[0]) createdActions.push(rows[0]);
      }
      console.warn("Agent Leo tenant AI fallback used", {
        organizationId: session.organizationId,
        role: leoIdentity.role,
        reason: aiResult.reason,
        latencyMs: aiResult.latencyMs,
      });
    }

    const aiMetadata = {
      connected,
      provider: connected ? "openai" : null,
      model,
      confidence,
      category,
      fallbackUsed,
      needsHumanReview,
      role: leoIdentity.role,
      policy: "leo-core-v2",
      latencyMs: Date.now() - requestStarted,
    };

    await supabaseServerRequest("support_messages", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: conversationId,
        role: "assistant",
        content: replyText,
        diagnostics: { safe: safeDiagnostics, ai: aiMetadata },
      }),
    });

    await supabaseServerRequest(
      `support_conversations?id=eq.${encodeURIComponent(conversationId)}&organization_id=eq.${encodeURIComponent(session.organizationId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: createdActions.length || needsHumanReview ? "waiting_approval" : "open",
          updated_at: new Date().toISOString(),
          metadata: { scope: "tenant", role: leoIdentity.role, ai: aiMetadata },
        }),
      },
    );

    return NextResponse.json({
      ok: true,
      conversationId,
      reply: replyText,
      diagnostics: safeDiagnostics,
      actions: createdActions,
      identity: { scope: "tenant", role: leoIdentity.role, organizationId: session.organizationId },
      ai: aiMetadata,
    });
  } catch (error) {
    console.error("Agent Leo tenant support request failed", {
      organizationId: session.organizationId,
      role: leoIdentity.role,
      errorType: error instanceof Error ? error.name : "unknown",
      latencyMs: Date.now() - requestStarted,
    });
    return NextResponse.json(
      { error: "Agent Leo could not complete the tenant diagnostic." },
      { status: 500 },
    );
  }
}
