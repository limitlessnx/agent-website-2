import { createAdminClient } from "@/lib/supabase/admin";
import type { PropertyRecord } from "@/lib/limitless-data";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { resolveCanonicalCustomer, getOrCreateCanonicalConversation } from "@/lib/canonical-customer";
import { createHumanHandoffFromMaia } from "@/lib/human-operations";

export const LIMITLESS_REALTY_HUMAN_WHATSAPP = "2348127753308";
export const LIMITLESS_REALTY_MAIA_AGENT_SLUG = "maia";
export const LIMITLESS_REALTY_CANONICAL_WHATSAPP_ROUTE = "trigger-dev-meta-cloud-api";

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
  return { id: property.id, title: property.title, type: property.type || "Property", area: property.location_area || "", city: property.location_city || "", location: [property.location_area, property.location_city].filter(Boolean).join(", "), price: property.price || "Price on request", priceValue: price, status: property.status || "unknown", features: property.features || "", description: property.description || "", photos: property.drive_photos_link, brochure: property.drive_brochure_link };
}

export async function searchLimitlessProperties(message: string, organizationId: string) {
  if (!organizationId) throw new Error("An explicit organization is required for property retrieval.");
  const budget = extractBudget(message);
  // Operational AI must not substitute sample listings after a failed database read.
  const { data, error } = await createAdminClient().from("properties")
    .select("id,organization_id,title,type,location_area,location_city,price,status,features,description,drive_photos_link,drive_brochure_link")
    .eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(500);
  if (error) throw error;
  const properties = (data || []) as PropertyRecord[];
  const availableStatuses = new Set(["active", "available", "for sale", "ready"]);
  const active = properties.filter((property) => property.organization_id === organizationId && availableStatuses.has(String(property.status || "").trim().toLowerCase()));
  const locationTokens = message.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
  const scored = active.map((property) => {
    const haystack = `${property.title} ${property.location_area || ""} ${property.location_city || ""} ${property.type || ""} ${property.features || ""} ${property.description || ""}`.toLowerCase();
    const price = propertyPrice(property);
    let score = 0;
    if (locationTokens.some((token) => haystack.includes(token))) score += 20;
    if (budget !== null && price !== null) {
      if (price <= budget) score += 50 + Math.max(0, 20 - Math.round((budget - price) / Math.max(budget, 1) * 20));
      else if (price <= budget * 1.2) score += 35;
    }
    return { property, price, score };
  }).filter((row) => budget === null || (row.price !== null && row.price <= budget * 1.2))
    .sort((a, b) => b.score - a.score || (a.price ?? Number.MAX_SAFE_INTEGER) - (b.price ?? Number.MAX_SAFE_INTEGER));

  return { budget, rule: budget === null ? "No budget was detected." : `Primary matches must be at or below ₦${budget.toLocaleString("en-NG")}. Secondary recommendations may be up to 20% above budget when relevant.`, matches: scored.slice(0, 8).map((row) => compactProperty(row.property, row.price)) };
}

export async function getLimitlessMaiaContext() {
  const admin = createAdminClient();
  const { data: organization, error: organizationError } = await admin.from("organizations").select("id,name,slug,status").eq("slug", "limitless-realty").maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) throw new Error("Limitless Realty organization is not provisioned yet.");
  if (organization.status !== "active") throw new Error("Limitless Realty organization is not active; Maia inbound processing is paused.");
  const { data: agents, error: agentError } = await admin.from("agents").select("id,name,slug,status,configuration,communication_channels").eq("organization_id", organization.id).eq("slug", LIMITLESS_REALTY_MAIA_AGENT_SLUG).limit(2);
  if (agentError) throw agentError;
  if (!agents?.length) throw new Error("Canonical Limitless Realty Maia is not provisioned.");
  if (agents.length > 1) throw new Error("Multiple Maia agents exist for Limitless Realty. Refusing to route ambiguously.");
  if (agents[0].status !== "active") throw new Error("Canonical Limitless Realty Maia is not active; inbound processing is paused.");
  return { organization, agent: agents[0], canonicalWhatsAppRoute: LIMITLESS_REALTY_CANONICAL_WHATSAPP_ROUTE };
}

export async function handoffToLimitlessHuman(args: { organizationId: string; agentId: string; sessionId: string; customerName?: string; customerPhone?: string; reason: string; summary: string; correlationId?: string }) {
  const phone = String(args.customerPhone || "").replace(/\D/g, "");
  if (!phone) throw new Error("A verified customer contact is required before handover.");
  const { customerId } = await resolveCanonicalCustomer({ organizationId: args.organizationId, phone, externalKey: "whatsapp:" + phone, fullName: args.customerName || "WhatsApp customer", source: "limitless-maia-handoff" });
  const conversationId = await getOrCreateCanonicalConversation({ organizationId: args.organizationId, customerId, channel: "whatsapp", externalThreadId: phone, agentId: args.agentId });
  const handoff = await createHumanHandoffFromMaia({ organizationId: args.organizationId, customerId, conversationId, sourceAgentId: args.agentId, reason: args.reason, category: "general", priority: "high", summary: args.summary, correlationId: args.correlationId || args.sessionId });
  return { handedOff: true, pending: !["delivered", "read"].includes(String((handoff as Record<string, unknown>).notificationStatus || "")), handoff };
}

export async function queueLimitlessFollowup(args: { organizationId: string; agentId: string; leadId?: string; customerPhone?: string; customerName?: string; when: string; message: string; stage?: number }) {
  await assertFluxFeatureAccess(args.organizationId, "follow_ups");
  const admin = createAdminClient();
  const scheduledAt = new Date(args.when);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid follow-up time.");
  let leadId = args.leadId || null;
  const phone = String(args.customerPhone || "").replace(/[^\d]/g, "");
  if (!leadId && phone) {
    const { data: existing } = await admin.from("leads").select("id,opted_out").eq("organization_id", args.organizationId).eq("phone", phone).maybeSingle();
    if (existing?.id) leadId = existing.id;
    else {
      const { data: created, error: createError } = await admin.from("leads").insert({ organization_id: args.organizationId, name: args.customerName || "Limitless Realty prospect", phone, status: "follow_up_pending", source: "maia", opted_out: false, agent_notified: false, conversation_log: [] }).select("id").single();
      if (createError) throw createError;
      leadId = created.id;
    }
  }
  if (!leadId) throw new Error("A client phone number or lead ID is required before scheduling a follow-up.");
  const { data: followup, error } = await admin.from("follow_ups").insert({ organization_id: args.organizationId, lead_id: leadId, stage: args.stage || 1, scheduled_at: scheduledAt.toISOString(), message_sent: args.message.slice(0, 2000), status: "pending" }).select("id,scheduled_at,status,lead_id,organization_id,stage").single();
  if (error) throw error;
  const { data: goal, error: goalError } = await admin.from("agent_runtime_goals").insert({ organization_id: args.organizationId, agent_id: args.agentId, title: `Follow up with ${args.customerName || phone || "prospect"}`, goal_type: "follow_up", priority: 60, status: "queued", next_run_at: scheduledAt.toISOString(), input: { instructions: `Follow up with the client using this approved message: ${args.message.slice(0, 2000)}. Client phone: ${phone}. Send through the tenant-scoped Meta WhatsApp Cloud API via Trigger.dev only. Do not send if the client has opted out, the conversation has been handed to a human, or the lead is already resolved.`, followup_id: followup.id, customer_phone: phone, delivery_route: LIMITLESS_REALTY_CANONICAL_WHATSAPP_ROUTE } }).select("id,status,next_run_at").single();
  if (goalError) throw goalError;
  return { followup, autonomousGoal: goal };
}

export async function queueLimitlessPropertyFollowupSequence(args: { organizationId: string; agentId: string; leadId?: string; customerPhone?: string; customerName?: string; propertyContext: unknown }) {
  const admin = createAdminClient();
  const phone = String(args.customerPhone || "").replace(/[^\d]/g, "");
  if (!phone && !args.leadId) throw new Error("A client phone number or lead ID is required before scheduling the property follow-up sequence.");

  let existingLead: { id: string; opted_out: boolean | null } | null = null;
  if (args.leadId) {
    const { data, error } = await admin.from("leads")
      .select("id,opted_out")
      .eq("organization_id", args.organizationId)
      .eq("id", args.leadId)
      .maybeSingle();
    if (error) throw error;
    existingLead = data;
  }

  if (existingLead?.opted_out) return { created: 0, skipped: "opted_out", followups: [] };
  let leadId = existingLead?.id;

  if (!leadId && phone) {
    const { data: phoneLead, error: phoneLeadError } = await admin.from("leads")
      .select("id,opted_out")
      .eq("organization_id", args.organizationId)
      .eq("phone", phone)
      .maybeSingle();
    if (phoneLeadError) throw phoneLeadError;
    if (phoneLead?.opted_out) return { created: 0, skipped: "opted_out", followups: [] };
    leadId = phoneLead?.id;
  }

  if (!leadId && args.leadId && !phone) {
    throw new Error("The lead was not found in the selected organization.");
  }

  if (leadId) {
    const { error: cancelPreviousError } = await admin.from("follow_ups")
      .update({ status: "cancelled" })
      .eq("organization_id", args.organizationId)
      .eq("lead_id", leadId)
      .eq("status", "pending");
    if (cancelPreviousError) throw cancelPreviousError;
  }

  const stages = [1, 3, 7, 14, 21, 30];
  const propertyText = JSON.stringify(args.propertyContext).slice(0, 3500);
  const created: unknown[] = [];
  for (const [index, days] of stages.entries()) {
    const when = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const result = await queueLimitlessFollowup({
      organizationId: args.organizationId,
      agentId: args.agentId,
      leadId,
      customerPhone: phone,
      customerName: args.customerName,
      when,
      stage: index + 1,
      message: `Follow up with ${args.customerName || "the client"} about the property enquiry. Stage ${index + 1} of the 30-day sequence. Use the latest verified Limitless Realty catalogue data and the conversation context. Property context captured when the sequence started: ${propertyText}. If the client has replied, bought, opted out, requested a human, or the enquiry is resolved, stop instead of sending this message.`,
    });
    created.push(result);
  }
  return { created: created.length, sequenceDays: stages, followups: created };
}

export function shouldHandoff(message: string, reply: string) {
  return /\b(human|representative|manager|real person|speak to (a )?(person|someone)|talk to (a )?(person|someone)|customer service)\b|\b(please|can you)\s+(connect|transfer)\b/i.test(message) || /\b(human handoff|human team|connect you with (our|a) human|escalat(?:e|ion)|requires human assistance)\b/i.test(reply);
}

export function shouldFollowUp(message: string) {
  return /follow.?up|remind me|reminder|check back|contact me later|call me (back|later)/i.test(message) && !/do not|don't|no need|stop/i.test(message);
}
