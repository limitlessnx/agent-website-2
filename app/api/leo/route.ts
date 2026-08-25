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

function publicSalesDirective(leadCaptured: boolean, leadProfile: unknown) {
  if (!leadCaptured) return "";
  const profile = leadProfile && typeof leadProfile === "object" ? JSON.stringify(leadProfile).slice(0, 1600) : "{}";
  return [
    "PUBLIC SALES MODE IS ACTIVE.",
    "The visitor's contact details have already been collected. Do not ask for them again.",
    "Do not dump, enumerate, or pitch every Fluxknight package. The visitor should receive one clear recommendation, not a catalogue.",
    "Qualify before recommending: understand the organization/business, the exact process they want automated, current customer channels, approximate enquiry/lead volume, desired outcome, timeline, and budget when useful.",
    "Ask ONE focused qualification question at a time. Wait for the visitor's answer before asking the next question. Do not combine multiple qualification questions in one response.",
    "Do not recommend a package until you have enough information to make a defensible recommendation. If information is missing, ask the single most useful next question instead.",
    "Once qualified, recommend ONE primary approved package and explain why it fits. Mention at most two other approved alternatives only when budget, scope, or channel requirements make them genuinely relevant, and explain the trade-off briefly.",
    "Use only package names, capabilities and prices present in the approved public knowledge. Never invent or guess them.",
    `CAPTURED LEAD PROFILE: ${profile}`,
  ].join("\n");
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

  const context = await buildLeoReasoningContext({ identity, pageContext });
  const leadCaptured = body.leadCaptured === true || Boolean(body.leadProfile);
  const directive = publicSalesDirective(leadCaptured, body.leadProfile);
  const modelMessage = directive ? `${directive}\n\nVISITOR'S LATEST MESSAGE:\n${message}` : message;
  const result = await generateLeoReasoning({
    identity,
    message: modelMessage,
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

  const reply = conciseLeoReply(result.reply);
  const toolCalls = result.toolCalls.map((call) => ({
    ...call,
    arguments: scopeToolArguments(identity, call.arguments),
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
    reply,
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
