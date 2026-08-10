import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import {
  buildLeoPolicySnapshot,
  enforceLeoOrganizationScope,
  resolveLeoIdentity,
  sanitizeLeoPageContext,
  type LeoChannel,
  type LeoIdentity,
} from "@/lib/leo-core";
import {
  auditLeoEvent,
  getOrCreateLeoSession,
  loadLeoHistory,
  storeLeoMessage,
  storeLeoToolProposals,
} from "@/lib/leo-session-store";

function validChannel(value: unknown): LeoChannel {
  return value === "voice" ? "voice" : value === "api" ? "api" : "chat";
}

function safeHistory(value: unknown): LeoChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" as const : "user" as const,
      content: String(item.content || "").trim().slice(0, 3000),
    }))
    .filter((item) => item.content)
    .slice(-16);
}

function scopeToolArguments(identity: LeoIdentity, args: Record<string, unknown>) {
  const scoped = { ...args };
  if (identity.scope === "tenant") {
    const organizationId = enforceLeoOrganizationScope(
      identity,
      typeof scoped.organization_id === "string" ? scoped.organization_id : undefined,
    );
    scoped.organization_id = organizationId;
  } else if (identity.scope === "public") {
    delete scoped.organization_id;
    delete scoped.organizationId;
    delete scoped.tenant_id;
    delete scoped.tenantId;
  }
  return scoped;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const channel = validChannel(body.channel);
  const identity = await resolveLeoIdentity({ channel, allowPublic: true });
  if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });

  const message = String(body.message || "").trim().slice(0, 8000);
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const pageContext = sanitizeLeoPageContext(body.pageContext);
  const session = await getOrCreateLeoSession({
    identity,
    sessionId: String(body.sessionId || "").trim() || undefined,
    pageContext,
    visibility: body.visibility,
  });

  const persistedHistory = await loadLeoHistory(identity, session);
  const suppliedHistory = safeHistory(body.history);
  const history = persistedHistory.length ? persistedHistory : suppliedHistory;

  await storeLeoMessage({ identity, session, role: "user", content: message });
  void auditLeoEvent({
    identity,
    session,
    eventType: "message_received",
    details: { channel, persisted: session.persisted },
  });

  const context = await buildLeoReasoningContext({ identity, pageContext });
  const result = await generateLeoReasoning({
    identity,
    message,
    history,
    context,
  });

  if (!result.ok) {
    void auditLeoEvent({
      identity,
      session,
      eventType: "reasoning_failed",
      details: { reason: result.reason, model: result.model, latency_ms: result.latencyMs },
    });
    const status = result.reason === "not_configured" ? 503 : result.reason === "timeout" ? 504 : 502;
    return NextResponse.json(
      {
        error: "Leo could not complete this response.",
        reason: result.reason,
        sessionId: session.id,
        persistence: session.persisted ? "database" : "ephemeral",
        ai: { connected: false, model: result.model, latencyMs: result.latencyMs },
      },
      { status },
    );
  }

  const toolCalls = result.toolCalls.map((call) => ({
    ...call,
    arguments: scopeToolArguments(identity, call.arguments),
    status: "proposed" as const,
  }));

  await storeLeoMessage({
    identity,
    session,
    role: "assistant",
    content: result.reply,
    metadata: {
      intent: result.intent,
      confidence: result.confidence,
      needs_human_review: result.needsHumanReview,
      model: result.model,
    },
  });
  await storeLeoToolProposals({ identity, session, toolCalls });
  void auditLeoEvent({
    identity,
    session,
    eventType: "reasoning_completed",
    details: {
      intent: result.intent,
      confidence: result.confidence,
      tool_count: toolCalls.length,
      model: result.model,
      latency_ms: result.latencyMs,
    },
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    persistence: session.persisted ? "database" : "ephemeral",
    visibility: session.visibility,
    reply: result.reply,
    intent: result.intent,
    confidence: result.confidence,
    needsHumanReview: result.needsHumanReview,
    toolCalls,
    executionMode: "proposal_only",
    identity: {
      scope: identity.scope,
      role: identity.role,
      organizationId: identity.scope === "tenant" ? identity.organizationId || null : null,
      channel: identity.channel,
    },
    policy: buildLeoPolicySnapshot(identity),
    ai: {
      connected: true,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      usage: result.usage || null,
    },
  });
}
