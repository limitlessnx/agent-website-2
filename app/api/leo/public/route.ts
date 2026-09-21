import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import { publicLeoSalesDirective } from "@/lib/leo-public-policy";
import { capturePublicLeoLead } from "@/lib/leo-lead-capture";
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
  if (!session.leadCaptured) {
    const capture = toolCalls.find((call) => call.toolKey === "leo.public.lead.capture");
    if (capture) {
      const captureResult = await capturePublicLeoLead(capture.arguments);
      if (captureResult.ok) {
        session = await updateLeoPublicLeadState({
          identity: PUBLIC_IDENTITY,
          session,
          leadProfile: {
            name: String(capture.arguments.name || ""),
            email: String(capture.arguments.email || ""),
            phone: String(capture.arguments.phone || ""),
            organization: String(capture.arguments.organization || capture.arguments.business_name || ""),
            business_type: String(capture.arguments.business_type || ""),
            main_goal: String(capture.arguments.main_goal || ""),
          },
          captured: true,
          leadId: captureResult.leadId,
        });
        toolCalls = toolCalls.map((call) => call === capture ? { ...call, status: "executed" as const, result: captureResult } : call);
      } else {
        toolCalls = toolCalls.map((call) => call === capture ? { ...call, status: "failed" as const, result: captureResult } : call);
      }
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
