import { NextRequest, NextResponse } from "next/server";
import { runMaia } from "@/lib/ai/maia-runtime";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLimitlessMaiaContext, searchLimitlessProperties, handoffToLimitlessHuman, queueLimitlessFollowup, queueLimitlessPropertyFollowupSequence, shouldFollowUp, shouldHandoff, LIMITLESS_REALTY_HUMAN_WHATSAPP } from "@/lib/ai/limitless-realty-maia";

export const dynamic = "force-dynamic";
const CANONICAL_CHANNEL = "whatsapp";
const CANONICAL_TRANSPORT = "existing-limitless-realty-maia-n8n";

function extractPhone(body: Record<string, unknown>) {
  return String(body.customerPhone || body.phone || body.from || body.whatsapp || "").replace(/[^\d]/g, "");
}

function nextFollowupAt(message: string) {
  const now = Date.now();
  const hour = message.match(/in\s+(\d+)\s*hours?/i);
  const day = message.match(/in\s+(\d+)\s*days?/i);
  if (hour) return new Date(now + Number(hour[1]) * 60 * 60 * 1000).toISOString();
  if (day) return new Date(now + Number(day[1]) * 24 * 60 * 60 * 1000).toISOString();
  if (/tomorrow/i.test(message)) return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (/next week/i.test(message)) return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(now + 24 * 60 * 60 * 1000).toISOString();
}

function hasQualifiedPropertyInterest(message: string, propertyContext: { matches?: Array<{ title?: string | null }> }, reply: string) {
  if (!reply.trim() || message.trim().length < 8) return false;
  const lower = message.toLowerCase();
  const exactPropertyMention = (propertyContext.matches || []).some((property) => {
    const title = String(property.title || "").trim().toLowerCase();
    return title.length >= 5 && lower.includes(title);
  });
  const specificReference = /\b(this|that|the)\s+(property|estate|land|plot|house|apartment)\b|\b(property|estate|land|plot|house|apartment)\s+(you|u)\s+(sent|mentioned|showed)\b/i.test(message);
  const meaningfulIntent = /\b(interested|interest|like|love|want|looking to buy|looking for|how much|price|payment|installment|inspection|title|documentation|documents|location|availability|reserve|book|pay|purchase)\b/i.test(message);
  return (exactPropertyMention || specificReference) && meaningfulIntent;
}

async function loadRecentConversation(organizationId: string, agentId: string, sessionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("agent_runtime_messages").select("role,content,created_at").eq("organization_id", organizationId).eq("agent_id", agentId).eq("session_id", sessionId).order("created_at", { ascending: false }).limit(12);
  return (data || []).reverse();
}

async function cancelPendingFollowupsForInbound(organizationId: string, customerPhone: string) {
  if (!customerPhone) return 0;
  const admin = createAdminClient();
  const { data: lead } = await admin.from("leads").select("id").eq("phone", customerPhone).maybeSingle();
  if (!lead?.id) return 0;
  const { data } = await admin.from("follow_ups").update({ status: "cancelled" }).eq("organization_id", organizationId).eq("lead_id", lead.id).eq("status", "pending").select("id");
  return data?.length || 0;
}

function buildHandoffSummary(name: string, phone: string, history: Array<{ role: string; content: string | null }>, propertyContext: unknown, reason: string) {
  const transcript = history.map((row) => `${row.role.toUpperCase()}: ${row.content || ""}`).join("\n").slice(-6500);
  return [
    "LIMITLESS REALTY — MAIA HUMAN HANDOFF",
    `Client: ${name || "Not provided"}`,
    `Phone: ${phone || "Not provided"}`,
    `Reason: ${reason}`,
    "",
    "Conversation summary / recent context:",
    transcript || "No previous transcript available.",
    "",
    "Verified property context Maia used:",
    JSON.stringify(propertyContext).slice(0, 4500),
    "",
    `Human handover destination: ${LIMITLESS_REALTY_HUMAN_WHATSAPP}`,
  ].join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const { organization, agent } = await getLimitlessMaiaContext();
    const message = String(body.message || body.text || "").trim();
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

    const propertyContext = await searchLimitlessProperties(message);
    const customerName = String(body.customerName || body.name || "");
    const customerPhone = extractPhone(body);
    const cancelledOnReply = await cancelPendingFollowupsForInbound(organization.id, customerPhone);
    const enrichedMessage = [
      message,
      "",
      "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:",
      JSON.stringify(propertyContext),
      "",
      "OPERATING MODE: You are the existing Limitless Realty Maia WhatsApp agent. This request is being processed by Maia's agentic runtime behind the existing production WhatsApp/n8n transport. Do not create or reference another Maia, WhatsApp number, transport or tenant.",
      `CANONICAL TRANSPORT: ${CANONICAL_TRANSPORT}`,
      "PROPERTY MATCHING RULE: when a client states a budget, prioritize verified properties at or below that budget. You may recommend relevant alternatives up to 20% above the stated budget, but label them clearly as above-budget alternatives. Never invent availability or pricing.",
      "CONVERSATION RULE: answer naturally and intelligently using the conversation context, the assigned agent configuration, approved Limitless Realty knowledge, and verified property results. Do not expose internal tools, model selection, database details or workflow mechanics to the client.",
      "HANDOFF RULE: if human assistance is requested or escalation is necessary, prepare a concise summary of the conversation and only claim handoff after delivery to the configured human destination is confirmed.",
      "FOLLOW-UP RULE: automatically qualify specific property interest when the client refers to a specific catalog property or clearly refers to a property Maia showed them and expresses meaningful buying intent. Do not start a sequence for generic browsing or campaign-only contacts. A qualified property sequence uses stages at days 1, 3, 7, 14, 21 and 30. Stop on reply, appointment, purchase, won/lost, opt-out, human handoff or resolution.",
    ].join("\n");

    const result = await runMaia({
      organizationId: organization.id,
      agentId: agent.id,
      message: enrichedMessage,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      channel: CANONICAL_CHANNEL,
      externalConversationId: customerPhone || undefined,
      autonomous: true,
    });

    const explicitFollowup = shouldFollowUp(message);
    const qualifiedPropertyInterest = hasQualifiedPropertyInterest(message, propertyContext, result.reply);
    let followup: unknown = null;
    if (qualifiedPropertyInterest) {
      followup = await queueLimitlessPropertyFollowupSequence({ organizationId: organization.id, agentId: agent.id, customerPhone, customerName, propertyContext });
    } else if (explicitFollowup) {
      followup = await queueLimitlessFollowup({
        organizationId: organization.id,
        agentId: agent.id,
        customerPhone,
        customerName,
        when: nextFollowupAt(message),
        message: `Follow up with ${customerName || "the client"} about the Limitless Realty enquiry. Preserve the context discussed, use current verified catalog data, and do not invent availability or pricing.`,
      });
    }

    let handoff: unknown = null;
    if (shouldHandoff(message, result.reply)) {
      const history = await loadRecentConversation(organization.id, agent.id, result.sessionId);
      const summary = buildHandoffSummary(customerName, customerPhone, history, propertyContext, "Client requested human assistance or Maia determined escalation was appropriate.");
      handoff = await handoffToLimitlessHuman({ organizationId: organization.id, agentId: agent.id, sessionId: result.sessionId, customerName, customerPhone, reason: "Maia human escalation", summary });
    }

    return NextResponse.json({ ok: true, reply: result.reply, sessionId: result.sessionId, model: result.model, steps: result.steps, autonomous: true, transport: CANONICAL_TRANSPORT, propertyContext, followup, followupQualification: { explicitFollowup, qualifiedPropertyInterest, cancelledOnReply }, handoff });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Limitless Maia request failed." }, { status: 500 });
  }
}
