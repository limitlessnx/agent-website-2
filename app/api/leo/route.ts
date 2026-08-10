import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import {
  buildLeoPolicySnapshot,
  enforceLeoOrganizationScope,
  resolveLeoIdentity,
  sanitizeLeoPageContext,
  type LeoChannel,
} from "@/lib/leo-core";

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

function scopeToolArguments(
  identity: Awaited<ReturnType<typeof resolveLeoIdentity>> & {},
  args: Record<string, unknown>,
) {
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
  const context = await buildLeoReasoningContext({ identity, pageContext });
  const result = await generateLeoReasoning({
    identity,
    message,
    history: safeHistory(body.history),
    context,
  });

  if (!result.ok) {
    const status = result.reason === "not_configured" ? 503 : result.reason === "timeout" ? 504 : 502;
    return NextResponse.json(
      {
        error: "Leo could not complete this response.",
        reason: result.reason,
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

  return NextResponse.json({
    ok: true,
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
