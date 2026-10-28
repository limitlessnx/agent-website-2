import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PropertyRecord } from "@/lib/limitless-data";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { resolveCanonicalCustomer, getOrCreateCanonicalConversation } from "@/lib/canonical-customer";
import { createHumanHandoffFromMaia } from "@/lib/human-operations";
import { LIMITLESS_REALTY_ORGANIZATION_ID, LIMITLESS_FOLLOWUP_SEQUENCE_KEY, LIMITLESS_FOLLOWUP_STAGES, limitlessPhoneCandidates, normalizeLimitlessPhone, qualifyLimitlessFollowup, uniqueLimitlessPhoneMatchId, uniqueRenewalPropertyId } from "@/lib/limitless-followup-contract";
import { computeInitialFollowUpDueAt, computeSequenceStepDueAt, resolveFollowUpPolicy } from "@/lib/follow-up-policy";

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

export async function queueLimitlessFollowup(args: { organizationId: string; agentId: string; customerId: string; sequenceId: string; sequenceKey: string; propertyId: string | null; leadId: string; customerPhone?: string; customerName?: string; when: string; message: string; stage?: number; sequenceStepKey?: string; consentAt: string; consentSource: string; consentActor: string }) {
  await assertFluxFeatureAccess(args.organizationId, "follow_ups");
  const admin = createAdminClient();
  const scheduledAt = new Date(args.when);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid follow-up time.");
  const phone = String(args.customerPhone || "").replace(/[^\d]/g, "");
  const qualification = qualifyLimitlessFollowup({ explicitOptIn: Boolean(args.consentAt && args.consentSource && args.consentActor), meaningfulConversation: true, specificPropertyInterest: args.propertyId || "property", campaignOnly: false });
  if (!qualification.eligible) throw new Error(`Limitless follow-up is not qualified: ${qualification.reasons.join(", ")}`);
  const stepKey = args.sequenceStepKey || `stage-${args.stage || 1}`;
  const { data: followup, error } = await admin.from("follow_ups").insert({
    organization_id: args.organizationId,
    lead_id: args.leadId,
    customer_id: args.customerId,
    property_id: args.propertyId,
    sequence_id: args.sequenceId,
    sequence_key: args.sequenceKey,
    sequence_step_key: stepKey,
    stage: args.stage || 1,
    scheduled_at: scheduledAt.toISOString(),
    due_at: scheduledAt.toISOString(),
    message_sent: args.message.slice(0, 2000),
    status: "pending",
    channel: "whatsapp",
    agent_key: "maia",
    consent_state: "opted_in",
    consent_at: args.consentAt,
    consent_source: args.consentSource,
    consent_actor: args.consentActor,
    template_name: "follow_up_outside_24h",
  }).select("id,scheduled_at,due_at,status,lead_id,customer_id,property_id,organization_id,sequence_id,sequence_step_key,stage").single();
  if (error) throw error;
  return { followup, pipeline: "limitless_follow_ups", duplicateGoalEnqueue: false, phone };
}

export async function queueLimitlessPropertyFollowupSequence(args: { organizationId: string; agentId: string; customerId: string; leadId?: string; customerPhone?: string; customerName?: string; propertyContext: unknown; consentAt: string; consentSource: string; consentActor: string; explicitRenewedConsent: boolean; specificPropertyMentioned?: boolean }) {
  const admin = createAdminClient();
  if (args.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID) throw new Error("Limitless follow-ups are restricted to the Limitless Realty organization.");
  const phoneVariants = limitlessPhoneCandidates(args.customerPhone || "");
  const normalizedPhone = normalizeLimitlessPhone(args.customerPhone || "");
  if (!normalizedPhone && !args.leadId) throw new Error("A client phone number or lead ID is required before scheduling the property follow-up sequence.");

  let existingLead: { id: string; phone?: string | null; opted_out: boolean | null } | null = null;
  if (args.leadId) {
    const { data, error } = await admin.from("leads")
      .select("id,phone,opted_out")
      .eq("organization_id", args.organizationId)
      .eq("id", args.leadId)
      .maybeSingle();
    if (error) throw error;
    existingLead = data;
  }

  if (!existingLead && phoneVariants.length) {
    const { data: phoneLeads, error: phoneLeadError } = await admin.from("leads")
      .select("id,phone,opted_out")
      .eq("organization_id", args.organizationId)
      .in("phone", phoneVariants)
      .limit(25);
    if (phoneLeadError) throw phoneLeadError;
    const normalizedMatches = (phoneLeads || []).filter((lead: { phone?: string | null }) => normalizeLimitlessPhone(lead.phone) === normalizedPhone);
    const matchedId = uniqueLimitlessPhoneMatchId(normalizedMatches);
    existingLead = normalizedMatches.find((lead: { id: string }) => lead.id === matchedId) || null;
  }

  if (existingLead && normalizedPhone && normalizeLimitlessPhone(existingLead.phone) !== normalizedPhone) {
    throw new Error("The lead phone does not match the inbound customer identity.");
  }
  const leadId = existingLead?.id;
  if (!leadId && args.leadId && !normalizedPhone) {
    throw new Error("The lead was not found in the selected organization.");
  }

  if (!leadId) throw new Error("A tenant-scoped Limitless lead is required before scheduling a sequence.");
  const wasOptedOut = existingLead?.opted_out === true;
  if (wasOptedOut && !args.explicitRenewedConsent) return { created: 0, skipped: "opted_out", followups: [] };
  const renewedConsent = wasOptedOut && args.explicitRenewedConsent;
  const match = args.specificPropertyMentioned === true
    ? ((args.propertyContext && typeof args.propertyContext === "object" ? (args.propertyContext as { matches?: Array<Record<string, unknown>> }).matches?.[0] : null) || null)
    : null;
  let propertyId = typeof match?.id === "string" && match.id.trim() ? match.id.trim() : null;
  if (!propertyId && wasOptedOut && renewedConsent && args.specificPropertyMentioned !== true) {
    const { data: priorSequences, error: priorSequenceError } = await admin.from("limitless_maia_followup_sequences")
      .select("property_id")
      .eq("organization_id", args.organizationId)
      .eq("customer_id", args.customerId)
      .eq("lead_id", leadId)
      .eq("status", "opted_out")
      .eq("consent_state", "opted_out")
      .limit(1000);
    if (priorSequenceError) throw priorSequenceError;
    propertyId = (priorSequences || []).length >= 1000 ? null : uniqueRenewalPropertyId(priorSequences || []);
  }
  if (!propertyId) {
    return { created: 0, skipped: wasOptedOut && renewedConsent ? "prior_property_missing_or_ambiguous" : "specific_property_interest_required", followups: [] };
  }
  const { data: verifiedProperty, error: propertyError } = await admin.from("properties")
    .select("id,title,location_area,location_city")
    .eq("organization_id", args.organizationId)
    .eq("id", propertyId)
    .maybeSingle();
  if (propertyError) throw propertyError;
  if (!verifiedProperty) return { created: 0, skipped: "property_not_found_in_organization", followups: [] };
  const qualification = qualifyLimitlessFollowup({ explicitOptIn: Boolean(args.consentAt && args.consentSource && args.consentActor && (!wasOptedOut || renewedConsent)), meaningfulConversation: true, specificPropertyInterest: propertyId, campaignOnly: false, optedOut: wasOptedOut && !renewedConsent });
  if (!qualification.eligible) return { created: 0, skipped: qualification.reasons[0], followups: [] };
  let existingSequenceQuery = admin.from("limitless_maia_followup_sequences").select("id,status,sequence_key").eq("organization_id", args.organizationId).eq("customer_id", args.customerId).eq("sequence_key", LIMITLESS_FOLLOWUP_SEQUENCE_KEY).in("status", ["active", "paused"]);
  existingSequenceQuery = propertyId ? existingSequenceQuery.eq("property_id", propertyId) : existingSequenceQuery.is("property_id", null);
  const { data: existingSequence, error: existingSequenceError } = await existingSequenceQuery.maybeSingle();
  if (existingSequenceError) throw existingSequenceError;
  if (existingSequence) return { created: 0, skipped: "active_sequence_exists", sequenceId: existingSequence.id, followups: [] };

  const policy = await resolveFollowUpPolicy(args.organizationId, "limitless-realty");
  const sequenceStartedAt = args.consentAt as string;
  const anchorTime = Date.parse(sequenceStartedAt);
  if (!Number.isFinite(anchorTime)) throw new Error("A valid explicit consent timestamp is required for the follow-up sequence.");
  const laterStepAnchor = new Date(anchorTime + 24 * 60 * 60 * 1000).toISOString();
  const scheduledTimes = LIMITLESS_FOLLOWUP_STAGES.map((_, index) => {
    const scheduledAt = index === 0
      ? computeInitialFollowUpDueAt(policy, sequenceStartedAt)
      : computeSequenceStepDueAt(policy, laterStepAnchor, index + 1);
    if (!scheduledAt) throw new Error(`The active Limitless follow-up policy is missing step ${index + 1}.`);
    return scheduledAt;
  });
  const sequenceId = randomUUID();
  const propertyText = [verifiedProperty.title, verifiedProperty.location_area, verifiedProperty.location_city].filter(Boolean).join(", ").slice(0, 500);
  const rows = LIMITLESS_FOLLOWUP_STAGES.map((days, index) => {
    const scheduledAt = scheduledTimes[index];
    return {
      sequence_step_key: `day-${days}`,
      stage: index + 1,
      scheduled_at: scheduledAt,
      due_at: scheduledAt,
      message_sent: `Checking in about ${propertyText}. Would you like updated availability or help arranging a viewing?`,
    };
  });
  const { data: enrollment, error: enrollmentError } = await admin.rpc("create_limitless_maia_followup_sequence", {
    p_organization_id: args.organizationId,
    p_customer_id: args.customerId,
    p_lead_id: leadId,
    p_property_id: propertyId,
    p_sequence_id: sequenceId,
    p_sequence_key: LIMITLESS_FOLLOWUP_SEQUENCE_KEY,
    p_consent_at: args.consentAt,
    p_consent_source: args.consentSource,
    p_consent_actor: args.consentActor,
    p_renewed_consent: renewedConsent,
    p_steps: rows,
  });
  if (enrollmentError) {
    if (enrollmentError.code === "23505") return { created: 0, skipped: "active_sequence_exists", followups: [] };
    throw enrollmentError;
  }
  const enrollmentResult = enrollment as { sequence_id?: string; followups?: unknown[] } | null;
  const created = Array.isArray(enrollmentResult?.followups) ? enrollmentResult.followups.length : 0;
  return { created, sequenceDays: [...LIMITLESS_FOLLOWUP_STAGES], duplicateGoalEnqueue: false, renewedConsent };
}

export function shouldHandoff(message: string, reply: string) {
  return /\b(human|representative|manager|real person|speak to (a )?(person|someone)|talk to (a )?(person|someone)|customer service)\b|\b(please|can you)\s+(connect|transfer)\b/i.test(message) || /\b(human handoff|human team|connect you with (our|a) human|escalat(?:e|ion)|requires human assistance)\b/i.test(reply);
}

export function shouldFollowUp(message: string) {
  return /follow.?up|remind me|reminder|check back|contact me later|call me (back|later)/i.test(message) && !/do not|don't|no need|stop/i.test(message);
}
