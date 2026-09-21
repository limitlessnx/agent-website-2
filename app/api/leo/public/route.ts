import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import { publicLeoSalesDirective } from "@/lib/leo-public-policy";
import { executePublicLeoTool } from "@/lib/leo-public-tools";
import { buildLeoPolicySnapshot, sanitizeLeoPageContext, type LeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession, loadLeoHistory, storeLeoMessage, storeLeoToolProposals, updateLeoPublicLeadState } from "@/lib/leo-session-store";

const PUBLIC_IDENTITY: LeoIdentity = {
  scope: "public",
  role: "visitor",
  channel: "chat",
  globalScope: false,
};

function safeHistory(value: unknown): LeoChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({ role: item.role === "assistant" ? "assistant" as const : "user" as const, content: String(item.content || "").trim().slice(0, 3000) }))
    .filter((item) => item.content)
    .slice(-16);
}

function concise(reply: string) {
  const text = reply.trim();
  return text.length <= 900 ? text : text.slice(0, 897).replace(/[\s,;:]+$/, "") + "…";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const message = String(body.message || "").trim().slice(0, 8000);
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });

  const pageContext = sanitizeLeoPageContext(body.pageContext);
  let session = await getOrCreateLeoSession({
    identity: PUBLIC_IDENTITY,
    sessionId: String(body.sessionId || "").trim() || undefined,
    pageContext,
    visibility: "private",
  });

  const persistedHistory = await loadLeoHistory(PUBLIC_IDENTITY, session);
  const history = persistedHistory.length ? persistedHistory : safeHistory(body.history);
  await storeLeoMessage({ identity: PUBLIC_IDENTITY, session, role: "user", content: message });
  void auditLeoEvent({ identity: PUBLIC_IDENTITY, session, eventType: "public_message_received", details: { channel: "chat", persisted: session.persisted } });

  const context = await buildLeoReasoningContext({ identity: PUBLIC_IDENTITY, pageContext });
  const leadCaptured = session.leadCaptured || body.leadCaptured === true || Boolean(body.leadProfile);
  const directive = publicLeoSalesDirective(leadCaptured, session.leadProfile || body.leadProfile);
  const result = await generateLeoReasoning({
    identity: PUBLIC_IDENTITY,
    message: directive + "\n\nVISITOR'S LATEST MESSAGE:\n" + message,
    history,
    context,
  });

  if (!result.ok) {
    void auditLeoEvent({ identity: PUBLIC_IDENTITY, session, eventType: "public_reasoning_failed", details: { reason: result.reason, model: result.model, latency_ms: result.latencyMs } });
    return NextResponse.json({ error: "Leo could not complete this response.", reason: result.reason, sessionId: session.id }, { status: result.reason === "timeout" ? 504 : 502 });
  }

  let toolCalls: Array<(typeof result.toolCalls)[number] & { status: "proposed" | "executed" | "failed"; result?: unknown }> = result.toolCalls.map((call) => ({ ...call, status: "proposed" }));
  for (const call of toolCalls) {
    if (!call.toolKey.startsWith("leo.public.")) continue;
    if (call.toolKey === "leo.public.lead.capture" && session.leadCaptured) {
      call.status = "executed";
      call.result = { ok: true, status: "already_captured", leadId: session.leadId || null };
      continue;
    }
    const toolResult = await executePublicLeoTool({ toolKey: call.toolKey, args: call.arguments, sessionId: session.id }).catch((error) => ({
      ok: false,
      status: "local_execution_failed",
      error: error instanceof Error ? error.message : "Public Leo tool failed.",
    }));
    call.status = toolResult.ok ? "executed" : "failed";
    call.result = toolResult;

    if (toolResult.ok && call.toolKey === "leo.public.lead.capture") {
      session = await updateLeoPublicLeadState({
        identity: PUBLIC_IDENTITY,
        session,
        leadProfile: {
          name: String(call.arguments.name || ""),
          email: String(call.arguments.email || ""),
          phone: String(call.arguments.phone || ""),
          organization: String(call.arguments.organization || call.arguments.business_name || ""),
          business_type: String(call.arguments.industry || call.arguments.business_type || ""),
          main_goal: String(call.arguments.main_goal || ""),
        },
        captured: true,
        leadId: "leadId" in toolResult ? String(toolResult.leadId || "") : null,
      });
    }
  }

  const reply = concise(result.reply);
  await storeLeoMessage({ identity: PUBLIC_IDENTITY, session, role: "assistant", content: reply, metadata: { intent: result.intent, model: result.model, lead_captured: session.leadCaptured } });
  await storeLeoToolProposals({ identity: PUBLIC_IDENTITY, session, toolCalls: toolCalls.map((call) => ({ toolKey: call.toolKey, arguments: call.arguments, reason: call.reason, approval: call.approval })) });

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    reply,
    intent: result.intent,
    leadCaptured: session.leadCaptured,
    leadProfile: session.leadProfile || null,
    leadId: session.leadId || null,
    identity: { scope: "public", role: "visitor", channel: "chat" },
    policy: buildLeoPolicySnapshot(PUBLIC_IDENTITY),
    toolCalls,
  });
}
