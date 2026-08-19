import { createAdminClient } from "@/lib/supabase/admin";
import { getProperties, type PropertyRecord } from "@/lib/limitless-data";

export const LIMITLESS_REALTY_HUMAN_WHATSAPP = "2348127753308";

const money = (value: string) => {
  const normalized = value.toLowerCase().replace(/[₦,\s]/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)([kmb])?/i);
  if (!match) return null;
  const base = Number(match[1]);
  const multiplier = match[2]?.toLowerCase() === "b" ? 1e9 : match[2]?.toLowerCase() === "m" ? 1e6 : match[2]?.toLowerCase() === "k" ? 1e3 : 1;
  return base * multiplier;
};

export function extractBudget(message: string) {
  const candidates = message.match(/(?:₦|ngn|n)?\s*\d[\d,]*(?:\.\d+)?\s*(?:k|m|b)?/gi) || [];
  const values = candidates.map(money).filter((v): v is number => typeof v === "number" && v > 0);
  return values.length ? Math.max(...values) : null;
}

function propertyPrice(property: PropertyRecord) {
  const raw = String(property.price || "");
  return money(raw.replace(/[^0-9.kmb₦ngn, ]/gi, ""));
}

function compactProperty(property: PropertyRecord, price: number | null) {
  return {
    id: property.id,
    title: property.title,
    type: property.type || "Property",
    location: [property.location_area, property.location_city].filter(Boolean).join(", "),
    price: property.price || "Price on request",
    priceValue: price,
    status: property.status || "active",
    features: property.features || "",
    description: property.description || "",
    photos: property.drive_photos_link,
    brochure: property.drive_brochure_link,
  };
}

export async function searchLimitlessProperties(message: string) {
  const budget = extractBudget(message);
  const properties = await getProperties(500);
  const active = properties.filter((property) => /active|available|for sale|ready/i.test(String(property.status || "active")));
  const locationTokens = message.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  const scored = active.map((property) => {
    const haystack = `${property.title} ${property.location_area || ""} ${property.location_city || ""} ${property.type || ""} ${property.features || ""} ${property.description || ""}`.toLowerCase();
    const price = propertyPrice(property);
    let score = 0;
    if (locationTokens.some((token) => haystack.includes(token))) score += 20;
    if (budget !== null && price !== null) {
      if (price <= budget) score += 50 + Math.max(0, 20 - Math.round((budget - price) / Math.max(budget, 1) * 20));
      else if (price <= budget * 1.2) score += 35;
      else score -= 100;
    }
    return { property, price, score };
  }).filter((row) => budget === null || (row.price !== null && row.price <= budget * 1.2))
    .sort((a, b) => b.score - a.score || (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));

  return {
    budget,
    rule: budget === null ? "No budget was detected." : `Primary matches must be at or below ₦${budget.toLocaleString("en-NG")}. Secondary recommendations may be up to 20% above budget when relevant.`,
    matches: scored.slice(0, 8).map((row) => compactProperty(row.property, row.price)),
  };
}

export async function getLimitlessMaiaContext() {
  const admin = createAdminClient();
  const { data: organization } = await admin.from("organizations").select("id,name,slug,status").eq("slug", "limitless-realty").maybeSingle();
  if (!organization) throw new Error("Limitless Realty organization is not provisioned yet.");
  const { data: agent } = await admin.from("agents").select("id,name,slug,status").eq("organization_id", organization.id).or("slug.eq.maia,name.ilike.Maia").maybeSingle();
  if (!agent) throw new Error("Maia is not provisioned for Limitless Realty.");
  return { organization, agent };
}

async function sendHumanSummary(summary: string) {
  const webhook = process.env.LIMITLESS_REALTY_HANDOFF_WEBHOOK_URL?.trim() || process.env.LIMITLESS_REALTY_N8N_HANDOFF_WEBHOOK_URL?.trim();
  if (webhook) {
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel: "whatsapp", to: LIMITLESS_REALTY_HUMAN_WHATSAPP, message: summary, source: "maia", tenant: "limitless-realty" }), cache: "no-store" });
    if (!response.ok) throw new Error(`Human handoff webhook failed (${response.status}).`);
    return { delivered: true, provider: "webhook" };
  }

  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (token && phoneNumberId) {
    const response = await fetch(`https://graph.facebook.com/v23.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: LIMITLESS_REALTY_HUMAN_WHATSAPP, type: "text", text: { body: summary } }),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`WhatsApp handoff failed (${response.status}).`);
    return { delivered: true, provider: "meta_whatsapp" };
  }

  return { delivered: false, provider: "unconfigured" };
}

export async function handoffToLimitlessHuman(args: { organizationId: string; agentId: string; sessionId: string; customerName?: string; customerPhone?: string; reason: string; summary: string }) {
  const admin = createAdminClient();
  const delivery = await sendHumanSummary(args.summary);
  if (!delivery.delivered) return { handedOff: false, pending: true, reason: "Human handoff channel is not configured; Maia did not claim handoff completion.", destination: LIMITLESS_REALTY_HUMAN_WHATSAPP };

  const { data: conversation } = await admin.from("agent_conversations").upsert({ organization_id: args.organizationId, agent_id: args.agentId, channel: "whatsapp", external_thread_key: args.customerPhone || args.sessionId, status: "handoff", ai_paused: true, last_message_at: new Date().toISOString(), metadata: { human_handoff_destination: LIMITLESS_REALTY_HUMAN_WHATSAPP, customer_name: args.customerName || null, customer_phone: args.customerPhone || null } }, { onConflict: "organization_id,agent_id,external_thread_key" }).select("id").single();
  if (!conversation) throw new Error("Human handoff message was delivered, but the conversation record could not be created.");

  const { data: handoff, error } = await admin.from("handoff_requests").insert({ organization_id: args.organizationId, conversation_id: conversation.id, agent_id: args.agentId, reason: args.reason.slice(0, 500), priority: "high", status: "open", notes: args.summary.slice(0, 5000) }).select("id,status,created_at").single();
  if (error) throw error;
  return { handedOff: true, pending: false, destination: LIMITLESS_REALTY_HUMAN_WHATSAPP, delivery, handoff };
}

export async function queueLimitlessFollowup(args: { organizationId: string; agentId: string; leadId?: string; customerPhone?: string; customerName?: string; when: string; message: string }) {
  const admin = createAdminClient();
  const scheduledAt = new Date(args.when);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid follow-up time.");
  let leadId = args.leadId || null;
  const phone = String(args.customerPhone || "").replace(/[^\d]/g, "");
  if (!leadId && phone) {
    const { data: existing } = await admin.from("leads").select("id,opted_out").eq("phone", phone).maybeSingle();
    if (existing?.id) leadId = existing.id;
    else {
      const { data: created, error: createError } = await admin.from("leads").insert({ name: args.customerName || "Limitless Realty prospect", phone, status: "follow_up_pending", source: "maia", opted_out: false, agent_notified: false, conversation_log: [] }).select("id").single();
      if (createError) throw createError;
      leadId = created.id;
    }
  }
  if (!leadId) throw new Error("A client phone number or lead ID is required before scheduling a follow-up.");
  const { data: followup, error } = await admin.from("follow_ups").insert({ organization_id: args.organizationId, lead_id: leadId, stage: 1, scheduled_at: scheduledAt.toISOString(), message_sent: args.message.slice(0, 2000), status: "pending" }).select("id,scheduled_at,status,lead_id,organization_id").single();
  if (error) throw error;
  const { data: goal, error: goalError } = await admin.from("agent_runtime_goals").insert({ organization_id: args.organizationId, agent_id: args.agentId, title: `Follow up with ${args.customerName || phone || "prospect"}`, goal_type: "follow_up", priority: 60, status: "queued", next_run_at: scheduledAt.toISOString(), input: { instructions: `Follow up with the client using this approved message: ${args.message.slice(0, 2000)}. Client phone: ${phone}. Do not send if the client has opted out, the conversation has been handed to a human, or the lead is already resolved.`, followup_id: followup.id, customer_phone: phone } }).select("id,status,next_run_at").single();
  if (goalError) throw goalError;
  return { followup, autonomousGoal: goal };
}

export function shouldHandoff(message: string, reply: string) {
  const userRequested = /\b(human|representative|manager|real person|speak to (a )?(person|someone)|talk to (a )?(person|someone)|customer service)\b|\b(please|can you)\s+(connect|transfer)\b/i.test(message);
  const agentEscalated = /\b(human handoff|human team|connect you with (our|a) human|escalat(?:e|ion)|requires human assistance)\b/i.test(reply);
  return userRequested || agentEscalated;
}

export function shouldFollowUp(message: string) {
  return /follow.?up|remind me|reminder|check back|contact me later|call me (back|later)/i.test(message) && !/do not|don't|no need|stop/i.test(message);
}
