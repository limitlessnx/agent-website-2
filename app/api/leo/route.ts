import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import { executeLeoReadTool } from "@/lib/leo-read-tools";
import {
  assertLeoToolAllowed,
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

function isReadOnlyTool(identity: LeoIdentity, toolKey: string) {
  try {
    return assertLeoToolAllowed(identity, toolKey).readOnly;
  } catch {
    return false;
  }
}

/** Keep Leo's normal answers concise without damaging structured/tool output. */
function conciseLeoReply(reply: string) {
  const text = reply.trim();
  if (text.length <= 900) return text;

  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  let output = "";
  for (const paragraph of paragraphs) {
    const candidate = output ? `${output}\n\n${paragraph}` : paragraph;
    if (candidate.length > 900) break;
    output = candidate;
    if (output.length >= 650) break;
  }

  if (output.length >= 120) return `${output.replace(/[\s,;:]+$/, "")}…`;

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let compact = "";
  for (const sentence of sentences) {
    const candidate = `${compact}${compact ? " " : ""}${sentence.trim()}`;
    if (candidate.length > 700) break;
    compact = candidate;
    if (compact.length >= 450) break;
  }
  return `${(compact || text.slice(0, 700)).replace(/[\s,;:]+$/, "")}…`;
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

  const baseContext = await buildLeoReasoningContext({ identity, pageContext });
  const firstResult = await generateLeoReasoning({
    identity,
    message,
    history,
    context: baseContext,
  });

  if (!firstResult.ok) {
    void auditLeoEvent({
      identity,
      session,
      eventType: "reasoning_failed",
      details: { reason: firstResult.reason, model: firstResult.model, latency_ms: firstResult.latencyMs },
    });
    const status = firstResult.reason === "not_configured" ? 503 : firstResult.reason === "timeout" ? 504 : 502;
    return NextResponse.json(
      {
        error: "Leo could not complete this response.",
        reason: firstResult.reason,
        sessionId: session.id,
        persistence: session.persisted ? "database" : "ephemeral",
        ai: { connected: false, model: firstResult.model, latencyMs: firstResult.latencyMs },
      },
      { status },
    );
  }

  const scopedFirstTools = firstResult.toolCalls.map((call) => ({
    ...call,
    arguments: scopeToolArguments(identity, call.arguments),
  }));
  const readCalls = scopedFirstTools.filter((call) => isReadOnlyTool(identity, call.toolKey));
  const nonReadCalls = scopedFirstTools.filter((call) => !isReadOnlyTool(identity, call.toolKey));

  let result = firstResult;
  let readResults: Record<string, unknown> = {};

  if (readCalls.length > 0) {
    const entries = await Promise.all(readCalls.slice(0, 4).map(async (call) => {
      try {
        const output = await executeLeoReadTool({
          identity,
          toolKey: call.toolKey,
          arguments: call.arguments,
        });
        return [call.toolKey, output] as const;
      } catch (error) {
        return [call.toolKey, { error: "Read tool failed safely." }] as const;
      }
    }));

    readResults = Object.fromEntries(entries);
    void auditLeoEvent({
      identity,
      session,
      eventType: "read_tools_executed",
      details: { tool_count: entries.length, tool_keys: entries.map(([key]) => key) },
    });

    const secondContext = {
      ...baseContext,
      readResults,
    };
    const secondResult = await generateLeoReasoning({
      identity,
      message,
      history,
      context: secondContext,
    });

    if (secondResult.ok) {
      result = secondResult;
    } else {
      void auditLeoEvent({
        identity,
        session,
        eventType: "reasoning_failed",
        details: { reason: secondResult.reason, model: secondResult.model, latency_ms: secondResult.latencyMs, phase: "read_result_reasoning" },
      });
    }
  }

  const reply = conciseLeoReply(result.reply);
  const toolCalls = (result === firstResult ? nonReadCalls : result.toolCalls.map((call) => ({
    ...call,
    arguments: scopeToolArguments(identity, call.arguments),
  }))).map((call) => ({
    ...call,
    status: "proposed" as const,
  }));

  await storeLeoMessage({
    identity,
    session,
    role: "assistant",
    content: reply,
    metadata: {
      intent: result.intent,
      confidence: result.confidence,
      needs_human_review: result.needsHumanReview,
      model: result.model,
      read_tool_count: readCalls.length,
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
      read_tool_count: readCalls.length,
      model: result.model,
      latency_ms: result.latencyMs,
    },
  });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    persistence: session.persisted ? "database" : "ephemeral",
    visibility: session.visibility,
    reply,
    intent: result.intent,
    confidence: result.confidence,
    needsHumanReview: result.needsHumanReview,
    toolCalls,
    executionMode: "proposal_only",
    readToolsExecuted: readCalls.map((call) => call.toolKey),
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
