import { NextRequest, NextResponse } from "next/server";
import { runMaia } from "@/lib/ai/maia-runtime";
import { runOptionalRealEstateOperation } from "@/lib/ai/optional-real-estate-operation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveCanonicalCustomer, getOrCreateCanonicalConversation } from "@/lib/canonical-customer";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAutomationApiKey } from "@/lib/limitless-api-auth";
import { isExplicitLimitlessOptInMessage } from "@/lib/limitless-followup-contract";
import { getLimitlessMaiaContext, searchLimitlessProperties, handoffToLimitlessHuman, queueLimitlessPropertyFollowupSequence, shouldHandoff, LIMITLESS_REALTY_HUMAN_WHATSAPP } from "@/lib/ai/limitless-realty-maia";

export const dynamic = "force-dynamic";
const CANONICAL_CHANNEL = "whatsapp";
const CANONICAL_TRANSPORT = "trigger-dev-meta-cloud-api";
const LIMITLESS_REALTY_CHANNEL_URL = "https://whatsapp.com/channel/0029Vas58FFInlqLq2KyeI2F";

function extractPhone(body: Record<string, unknown>) {
  return String(body.customerPhone || body.phone || body.from || body.whatsapp || "").replace(/[^\d]/g, "");
}

function hasSpecificPropertyReference(message: string, propertyContext: { matches?: Array<{ title?: string | null }> }) {
  const lower = message.toLowerCase();
  const exactPropertyMention = (propertyContext.matches || []).some((property) => {
    const title = String(property.title || "").trim().toLowerCase();
    return title.length >= 5 && lower.includes(title);
  });
  const specificReference = /\b(this|that|the)\s+(property|estate|land|plot|house|apartment)\b|\b(property|estate|land|plot|house|apartment)\s+(you|u)\s+(sent|mentioned|showed)\b/i.test(message);
  return exactPropertyMention || specificReference;
}

function hasQualifiedPropertyInterest(message: string, propertyContext: { matches?: Array<{ title?: string | null }> }, explicitOptIn: boolean) {
  if (message.trim().length < 8 || !hasSpecificPropertyReference(message, propertyContext)) return false;
  const meaningfulIntent = explicitOptIn || /\b(interested|interest|like|love|want|looking to buy|looking for|how much|price|payment|installment|inspection|title|documentation|documents|location|availability|reserve|book|pay|purchase)\b/i.test(message);
  return meaningfulIntent;
}

async function loadRecentConversation(organizationId: string, agentId: string, sessionId: string) {
  const admin = createAdminClient();
  const { data } = await admin.from("agent_runtime_messages").select("role,content,created_at").eq("organization_id", organizationId).eq("agent_id", agentId).eq("session_id", sessionId).order("created_at", { ascending: false }).limit(12);
  return (data || []).reverse();
}

async function resolveSessionId(organizationId: string, agentId: string, customerPhone: string, suppliedSessionId?: string) {
  if (suppliedSessionId) return suppliedSessionId;
  if (!customerPhone) return undefined;
  const admin = createAdminClient();
  const { data } = await admin.from("agent_runtime_sessions").select("id").eq("organization_id", organizationId).eq("agent_id", agentId).eq("external_conversation_id", customerPhone).eq("status", "active").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  return data?.id;
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
  const adminSession = await getAdminSession();
  if (!adminSession && !requireAutomationApiKey(request).ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const { organization, agent } = await getLimitlessMaiaContext();
    const message = String(body.message || body.text || "").trim();
    if (!message) return NextResponse.json({ error: "message is required" }, { status: 400 });

    const propertyContext = await searchLimitlessProperties(message, organization.id);
    const customerName = String(body.customerName || body.name || "");
    const customerPhone = extractPhone(body);
    const existingSessionId = await resolveSessionId(organization.id, agent.id, customerPhone, typeof body.sessionId === "string" ? body.sessionId : undefined);
    const enrichedMessage = [
      message,
      "",
      "VERIFIED LIMITLESS REALTY PROPERTY SEARCH RESULT:",
      JSON.stringify(propertyContext),
      "",
      "OPERATING MODE: You are the existing Limitless Realty Maia WhatsApp agent. This request is being processed by Maia's tenant-aware Trigger.dev runtime behind the Meta WhatsApp Cloud API transport. Do not create or reference another Maia, WhatsApp number, transport or tenant.",
      `CANONICAL TRANSPORT: ${CANONICAL_TRANSPORT}`,
      "PROPERTY MATCHING RULE: when a client states a budget, prioritize verified properties at or below that budget. You may recommend relevant alternatives up to 20% above the stated budget, but label them clearly as above-budget alternatives. Never invent availability or pricing.",
      "CONVERSATION RULE: answer naturally and intelligently using the conversation context, the assigned agent configuration, approved Limitless Realty knowledge, and verified property results. Do not expose internal tools, model selection, database details or workflow mechanics to the client.",
      "CHANNEL GROWTH RULE: Limitless Realty's official WhatsApp Channel is a core customer value channel. When relevant to the conversation, proactively invite the client to join and give a concrete, truthful reason: new property deals, estate launches, price changes, verified property updates and useful real-estate information. Do not repeat the invitation mechanically on every turn or use pressure. Make it natural and relevant to the client's interests.",
      `OFFICIAL LIMITLESS REALTY WHATSAPP CHANNEL: ${LIMITLESS_REALTY_CHANNEL_URL}`,
      `CHANNEL LINK RULE: if a client asks to join, says YES to joining, asks for the channel link, or accepts the invitation, send the exact official channel URL above. Do not invent, shorten or substitute another URL. If the client is responding to a campaign, preserve the campaign context and answer the requested next step within the active WhatsApp conversation window when available.`,
      "CAMPAIGN RESPONSE RULE: if a client replies MORE INFO to a Limitless Realty campaign, use the current conversation and campaign context to explain what the campaign was about. If it was a property campaign, provide verified property details; if it was a news, market or general update, explain the update instead of pretending it was a property.",
      "HANDOFF RULE: if human assistance is requested or escalation is necessary, prepare a concise summary of the conversation and only claim handoff after delivery to the configured human destination is confirmed.",
      "FOLLOW-UP RULE: start a specific property sequence only when the client refers to a specific catalog property or clearly refers to a property Maia showed them and explicitly opts in to follow-up messages or property updates. A direct request such as ‘keep me updated about this property’ is meaningful property interest even without purchase wording. Do not start a sequence for generic browsing or campaign-only contacts. A qualified property sequence uses stages at days 1, 3, 7, 14, 21 and 30. Ordinary replies, viewings, purchase progress, status changes and human handoff do not cancel a sequence; only explicit customer opt-out, admin stop/close and natural sequence completion terminate it.",
    ].join("\n");

    if (!customerPhone) return NextResponse.json({ error: "A customer phone is required for the controlled WhatsApp runtime." }, { status: 400 });
    const { customerId } = await resolveCanonicalCustomer({ organizationId: organization.id, phone: customerPhone, externalKey: "whatsapp:" + customerPhone, fullName: customerName || "WhatsApp customer", source: "limitless-maia-api" });
    const conversationId = await getOrCreateCanonicalConversation({ organizationId: organization.id, customerId, channel: "whatsapp", externalThreadId: customerPhone, agentId: agent.id });
    const { data: activeConversation } = await createAdminClient().from("crm_conversations").select("status,metadata").eq("organization_id", organization.id).eq("id", conversationId).maybeSingle();
    const mode = String((activeConversation?.metadata as Record<string, unknown> | null)?.ai_response_mode || "");
    if (["waiting", "human_active", "resolved"].includes(String(activeConversation?.status || "")) || ["paused_for_handoff", "human_takeover", "stopped"].includes(mode)) {
      return NextResponse.json({ ok: true, suppressedReply: true, reason: "human_handoff_active" });
    }
    const result = await runMaia({
      organizationId: organization.id,
      agentId: agent.id,
      message: enrichedMessage,
      sessionId: existingSessionId,
      channel: CANONICAL_CHANNEL,
      externalConversationId: customerPhone || undefined,
      customerId, conversationId,
      autonomous: true,
    });

    const explicitFollowup = /follow.?up|remind me|reminder|check back|contact me later|call me (back|later)/i.test(message);
    const explicitOptIn = isExplicitLimitlessOptInMessage(message);
    const specificPropertyMentioned = hasSpecificPropertyReference(message, propertyContext);
    const qualifiedPropertyInterest = hasQualifiedPropertyInterest(message, propertyContext, explicitOptIn);
    const canonicalHandoff = result.toolResults.some(item => item.tool === "handoff_to_human_supervisor" && item.ok === true);
    let handoff: unknown = canonicalHandoff ? { recorded: true, source: "canonical_runtime" } : null;
    if (!canonicalHandoff && shouldHandoff(message, result.reply)) {
      const history = await loadRecentConversation(organization.id, agent.id, result.sessionId);
      const summary = buildHandoffSummary(customerName, customerPhone, history, propertyContext, "Client requested human assistance or Maia determined escalation was appropriate.");
      handoff = await handoffToLimitlessHuman({ organizationId: organization.id, agentId: agent.id, sessionId: result.sessionId, customerName, customerPhone, reason: "Maia human escalation", summary });
    }
    let followup: unknown = null;
    if (!handoff && explicitOptIn) {
      followup = await runOptionalRealEstateOperation(async () => {
        return queueLimitlessPropertyFollowupSequence({ organizationId: organization.id, agentId: agent.id, customerId, customerPhone, customerName, propertyContext, consentAt: new Date().toISOString(), consentSource: "limitless_maia_api", consentActor: `customer:${customerId}`, explicitRenewedConsent: explicitOptIn, specificPropertyMentioned });
      });
    }

    return NextResponse.json({ ok: true, reply: handoff && !canonicalHandoff ? "Your human assistance request has been recorded. Staff notification delivery is pending verification." : result.reply, sessionId: result.sessionId, model: result.model, steps: result.steps, autonomous: true, transport: CANONICAL_TRANSPORT, propertyContext, followup, followupQualification: { explicitFollowup, explicitOptIn, qualifiedPropertyInterest, cancelledOnReply: false }, handoff, channelUrl: LIMITLESS_REALTY_CHANNEL_URL });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Limitless Maia request failed." }, { status: 500 });
  }
}
