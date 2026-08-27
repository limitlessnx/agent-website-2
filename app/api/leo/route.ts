import { NextRequest, NextResponse } from "next/server";
import { generateLeoReasoning, type LeoChatMessage } from "@/lib/ai/leo-model";
import { buildLeoReasoningContext } from "@/lib/leo-context";
import { publicLeoSalesDirective } from "@/lib/leo-public-policy";
import { capturePublicLeoLead } from "@/lib/leo-lead-capture";
import { buildLeoPolicySnapshot, enforceLeoOrganizationScope, resolveLeoIdentity, sanitizeLeoPageContext, type LeoChannel, type LeoIdentity } from "@/lib/leo-core";
import { auditLeoEvent, getOrCreateLeoSession, loadLeoHistory, storeLeoMessage, storeLeoToolProposals, updateLeoPublicLeadState } from "@/lib/leo-session-store";

function validChannel(value: unknown): LeoChannel { return value === "voice" ? "voice" : value === "api" ? "api" : "chat"; }
function safeHistory(value: unknown): LeoChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => ({ role: item.role === "assistant" ? "assistant" as const : "user" as const, content: String(item.content || "").trim().slice(0, 3000) })).filter((item) => item.content).slice(-16);
}
function scopeToolArguments(identity: LeoIdentity, args: Record<string, unknown>) {
  const scoped = { ...args };
  if (identity.scope === "tenant") {
    const organizationId = enforceLeoOrganizationScope(identity, typeof scoped.organization_id === "string" ? scoped.organization_id : undefined);
    scoped.organization_id = organizationId;
  } else if (identity.scope === "public") { delete scoped.organization_id; delete scoped.organizationId; delete scoped.tenant_id; delete scoped.tenantId; }
  return scoped;
}
function conciseLeoReply(reply: string) {
  const text = reply.trim(); if (text.length <= 900) return text;
  const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean); let output = "";
  for (const paragraph of paragraphs) { const candidate = output ? `${output}\n\n${paragraph}` : paragraph; if (candidate.length > 900) break; output = candidate; if (output.length >= 650) break; }
  if (output.length >= 120) return `${output.replace(/[\s,;:]+$/, "")}…`;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]; let compact = "";
  for (const sentence of sentences) { const candidate = `${compact}${compact ? " " : ""}${sentence.trim()}`; if (candidate.length > 700) break; compact = candidate; if (compact.length >= 450) break; }
  return `${(compact || text.slice(0, 700)).replace(/[\s,;:]+$/, "")}…`;
}

type RuntimeToolCall = {
  toolKey: string;
  reason: string;
  approval: "none" | "admin" | "confirm";
  arguments: Record<string, unknown>;
  status: "proposed" | "executed" | "failed";
  result?: unknown;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const channel = validChannel(body.channel);
  const identity = await resolveLeoIdentity({ channel, allowPublic: true });
  if (!identity) return NextResponse.json({ error: "Leo identity could not be resolved." }, { status: 401 });
  const message = String(body.message || "").trim().slice(0, 8000);
  if (!message) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  const pageContext = sanitizeLeoPageContext(body.pageContext);
  let session = await getOrCreateLeoSession({ identity, sessionId: String(body.sessionId || "").trim() || undefined, pageContext, visibility: body.visibility });
  const persistedHistory = await loadLeoHistory(identity, session);
  const suppliedHistory = safeHistory(body.history);
  const history = persistedHistory.length ? persistedHistory : suppliedHistory;
  await storeLeoMessage({ identity, session, role: "user", content: message });
  void auditLeoEvent({ identity, session, eventType: "message_received", details: { channel, persisted: session.persisted } });
  const context = await buildLeoReasoningContext({ identity, pageContext });
  const leadCaptured = session.leadCaptured || body.leadCaptured === true || Boolean(body.leadProfile);
  const directive = identity.scope === "public" ? publicLeoSalesDirective(leadCaptured, session.leadProfile || body.leadProfile) : "";
  const modelMessage = directive ? `${directive}\n\nVISITOR'S LATEST MESSAGE:\n${message}` : message;
  const result = await generateLeoReasoning({ identity, message: modelMessage, history, context });
  if (!result.ok) {
    void auditLeoEvent({ identity, session, eventType: "reasoning_failed", details: { reason: result.reason, model: result.model, latency_ms: result.latencyMs } });
    const status = result.reason === "not_configured" ? 503 : result.reason === "timeout" ? 504 : 502;
    return NextResponse.json({ error: "Leo could not complete this response.", reason: result.reason, sessionId: session.id, persistence: session.persisted ? "database" : "ephemeral", ai: { connected: false, model: result.model, latencyMs: result.latencyMs } }, { status });
  }
  const reply = conciseLeoReply(result.reply);
  let toolCalls: RuntimeToolCall[] = result.toolCalls.map((call) => ({ ...call, arguments: scopeToolArguments(identity, call.arguments), status: "proposed" }));
  if (identity.scope === "public" && !session.leadCaptured) {
    const capture = toolCalls.find((call) => call.toolKey === "leo.public.lead.capture");
    if (capture) {
      const captureResult = await capturePublicLeoLead(capture.arguments);
      if (captureResult.ok) {
        session = await updateLeoPublicLeadState({ identity, session, leadProfile: { name: String(capture.arguments.name), email: String(capture.arguments.email), phone: String(capture.arguments.phone), organization: String(capture.arguments.organization || capture.arguments.business_name), business_type: String(capture.arguments.business_type || ""), main_goal: String(capture.arguments.main_goal || ""), current_tools: String(capture.arguments.current_tools || ""), lead_volume: String(capture.arguments.lead_volume || ""), timeline: String(capture.arguments.timeline || ""), budget: String(capture.arguments.budget || ""), preferred_contact_time: String(capture.arguments.preferred_contact_time || "") }, captured: true, leadId: captureResult.leadId });
        toolCalls = toolCalls.map((call) => call === capture ? { ...call, status: "executed", result: captureResult } : call);
        await auditLeoEvent({ identity, session, eventType: "public_lead_captured", toolKey: capture.toolKey, details: { lead_id: captureResult.leadId, channel } });
      } else toolCalls = toolCalls.map((call) => call === capture ? { ...call, status: "failed", result: captureResult } : call);
    }
  }
  await storeLeoMessage({ identity, session, role: "assistant", content: reply, metadata: { intent: result.intent, confidence: result.confidence, needs_human_review: result.needsHumanReview, model: result.model, lead_captured: session.leadCaptured } });
  await storeLeoToolProposals({ identity, session, toolCalls: toolCalls.map((call) => ({ toolKey: call.toolKey, arguments: call.arguments, reason: call.reason, approval: call.approval })) });
  void auditLeoEvent({ identity, session, eventType: "reasoning_completed", details: { intent: result.intent, confidence: result.confidence, tool_count: toolCalls.length, model: result.model, latency_ms: result.latencyMs, lead_captured: session.leadCaptured } });
  return NextResponse.json({ ok: true, sessionId: session.id, persistence: session.persisted ? "database" : "ephemeral", visibility: session.visibility, reply, intent: result.intent, confidence: result.confidence, needsHumanReview: result.needsHumanReview, toolCalls, executionMode: "proposal_only", leadCaptured: session.leadCaptured, leadProfile: session.leadProfile || null, leadId: session.leadId || null, identity: { scope: identity.scope, role: identity.role, organizationId: identity.scope === "tenant" ? identity.organizationId || null : null, channel: identity.channel }, policy: buildLeoPolicySnapshot(identity), ai: { connected: true, provider: result.provider, model: result.model, latencyMs: result.latencyMs, usage: result.usage || null } });
}
