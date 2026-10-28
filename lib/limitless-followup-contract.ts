export const LIMITLESS_REALTY_ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";
export const LIMITLESS_FOLLOWUP_SEQUENCE_KEY = "maia_limitless_property_sales_followup_v1";
export const LIMITLESS_FOLLOWUP_STAGES = [1, 3, 7, 14, 21, 30] as const;

export type FollowupConsentEventType = "opt_in" | "opt_out";
export type FollowupSequenceStatus = "active" | "paused" | "stopped" | "opted_out" | "completed";
export type FollowupControlAction = "reschedule" | "pause" | "resume" | "stop" | "close" | "cancel" | "retry";

export type LimitlessSequenceIdentity = {
  organization_id: string;
  customer_id: string;
  lead_id: string;
  property_id: string | null;
  sequence_id: string;
  sequence_key: string;
};

export type LimitlessConsentEvent = {
  organization_id: string;
  customer_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  sequence_id: string | null;
  event_type: FollowupConsentEventType;
  occurred_at: string;
  source: string;
  actor: string;
  metadata?: Record<string, unknown>;
};

export type ExactFollowupTarget = {
  organization_id: string;
  customer_id: string;
  lead_id?: string | null;
  property_id: string | null;
  sequence_id: string;
  step_id?: string | null;
  reason: string;
  actor: string;
};

export const NON_TERMINAL_FOLLOWUP_EVENTS = [
  "customer.replied",
  "appointment.booked",
  "viewing.booked",
  "purchase.started",
  "purchase.progressed",
  "human.handoff",
  "lead.status_changed",
  "lead.won",
  "lead.lost",
] as const;

export const TERMINAL_FOLLOWUP_EVENTS = [
  "customer.opted_out",
  "admin.close",
  "admin.stop",
  "sequence.completed",
] as const;

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isExplicitLimitlessOptInMessage(value: unknown): boolean {
  const message = text(value);
  return /\b(i\s+(?:agree|consent)|you\s+may\s+(?:contact|message)|keep\s+me\s+updated|send\s+me\s+(?:updates|messages)|please\s+(?:follow\s*up|contact\s+me)|yes,?\s+(?:please\s+)?(?:follow\s*up|contact|send))\b/i.test(message);
}

export function normalizeLimitlessPhone(value: unknown): string {
  const raw = String(value || "").trim();
  let digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("00") && digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("2340") && digits.length === 14) digits = `234${digits.slice(4)}`;
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  return digits;
}

export function limitlessPhoneCandidates(value: unknown): string[] {
  const raw = String(value || "").trim();
  const normalized = normalizeLimitlessPhone(raw);
  if (!normalized) return [];
  const candidates = new Set([raw, raw.replace(/[^\d]/g, ""), normalized, `+${normalized}`]);
  if (normalized.startsWith("234") && normalized.length === 13) candidates.add(`0${normalized.slice(3)}`);
  return [...candidates];
}

export function uniqueLimitlessPhoneMatchId(matches: Array<{ id?: unknown }>): string | null {
  const ids = [...new Set(matches.map((match) => text(match.id)).filter(Boolean))];
  if (ids.length > 1) throw new Error("Limitless phone matched multiple lead records; no opt-out updates were applied.");
  return ids[0] || null;
}

export function uniqueRenewalPropertyId(rows: Array<{ property_id?: unknown }>): string | null {
  const ids = rows.map((row) => text(row.property_id));
  if (!ids.length || ids.some((id) => !id)) return null;
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length === 1 ? uniqueIds[0] : null;
}

export function isExplicitOptIn(input: Record<string, unknown>): boolean {
  const context = input.follow_up_context && typeof input.follow_up_context === "object"
    ? input.follow_up_context as Record<string, unknown>
    : input;
  return context.consent_state === "opted_in"
    && Boolean(text(context.consent_at))
    && Boolean(text(context.consent_source))
    && Boolean(text(context.consent_actor));
}

export function isExplicitOptOut(input: Record<string, unknown>): boolean {
  const context = input.follow_up_context && typeof input.follow_up_context === "object"
    ? input.follow_up_context as Record<string, unknown>
    : input;
  return context.consent_state === "opted_out"
    && Boolean(text(context.consent_at))
    && Boolean(text(context.consent_source))
    && Boolean(text(context.consent_actor));
}

export function qualifyLimitlessFollowup(input: {
  explicitOptIn: boolean;
  meaningfulConversation: boolean;
  specificPropertyInterest: string | null | undefined;
  campaignOnly: boolean;
  optedOut?: boolean;
}) {
  const reasons: string[] = [];
  if (!input.explicitOptIn) reasons.push("explicit_opt_in_required");
  if (!input.meaningfulConversation) reasons.push("meaningful_conversation_required");
  if (!text(input.specificPropertyInterest)) reasons.push("specific_property_interest_required");
  if (input.campaignOnly) reasons.push("campaign_only_excluded");
  if (input.optedOut) reasons.push("opted_out");
  return { eligible: reasons.length === 0, reasons };
}

export function sequenceScopeKey(identity: Pick<LimitlessSequenceIdentity, "organization_id" | "customer_id" | "property_id" | "sequence_key">) {
  return [identity.organization_id, identity.customer_id, identity.property_id || "no-property", identity.sequence_key].join(":");
}

export function followupOutboundIdempotencyKey(input: { organizationId: string; sequenceId: string; stepId: string; attempt: number; lastError?: string | null }) {
  const base = `limitless-followup:${text(input.organizationId)}:${text(input.sequenceId)}:${text(input.stepId)}`;
  const persistenceRetry = text(input.lastError).startsWith("Provider-confirmed send requires persistence retry:");
  if (persistenceRetry || !Number.isInteger(input.attempt) || input.attempt <= 1) return base;
  return `${base}:attempt:${input.attempt}`;
}

export function followupErrorSummary(value: unknown): string | null {
  const raw = value instanceof Error ? value.message : text(value);
  if (!raw) return null;
  const normalized = raw.toLowerCase();
  if (normalized.includes("template")) return "WhatsApp template was rejected or is not configured.";
  if (normalized.includes("capability")) return "WhatsApp account capability requires review.";
  if (normalized.includes("credit")) return "Messaging credits are unavailable or insufficient.";
  if (normalized.includes("entitlement") || normalized.includes("feature access")) return "Reminder feature access is not enabled for this organization.";
  if (normalized.includes("consent") || normalized.includes("opted out")) return "Delivery was blocked by the consent guard.";
  if (normalized.includes("ambiguous") || normalized.includes("message id")) return "Delivery outcome is ambiguous; manual review is required and retry is disabled.";
  if (normalized.includes("timeout") || normalized.includes("network") || normalized.includes("fetch failed") || /\b(502|503|504)\b/.test(normalized)) return "Provider or network outcome requires review; automatic retry is disabled.";
  if (normalized.includes("property") || normalized.includes("tenant") || normalized.includes("organization scope")) return "Tenant/property validation blocked delivery.";
  if (/\b(400|401|403|404|409|422)\b/.test(normalized) || normalized.includes("rejected") || normalized.includes("invalid")) return "Provider rejected the delivery; correct the configuration or contact before manual retry.";
  return "Delivery failed; raw provider details are restricted.";
}

export function assertExactFollowupTarget(target: Partial<ExactFollowupTarget>): asserts target is ExactFollowupTarget {
  if (!text(target.organization_id) || !text(target.customer_id) || !text(target.sequence_id) || target.property_id === undefined) {
    throw new Error("Exact follow-up target requires organization, customer, property scope, and sequence identity.");
  }
  if (!text(target.actor) || !text(target.reason)) throw new Error("Follow-up controls require an audited actor and reason.");
}

export function isAllowedFollowupControl(action: unknown): action is FollowupControlAction {
  return ["reschedule", "pause", "resume", "stop", "close", "cancel", "retry"].includes(text(action));
}

export function isNonTerminalFollowupEvent(eventType: unknown): boolean {
  return (NON_TERMINAL_FOLLOWUP_EVENTS as readonly string[]).includes(text(eventType));
}

export function isTerminalFollowupEvent(eventType: unknown): boolean {
  return (TERMINAL_FOLLOWUP_EVENTS as readonly string[]).includes(text(eventType));
}

export function consentEvent(args: {
  identity: Pick<LimitlessSequenceIdentity, "organization_id" | "customer_id" | "lead_id" | "property_id" | "sequence_id">;
  event_type: FollowupConsentEventType;
  source: string;
  actor: string;
  occurred_at?: string;
  metadata?: Record<string, unknown>;
}): LimitlessConsentEvent {
  const source = text(args.source);
  const actor = text(args.actor);
  if (!source || !actor) throw new Error("Consent events require a source and audited actor.");
  return {
    organization_id: args.identity.organization_id,
    customer_id: args.identity.customer_id,
    lead_id: args.identity.lead_id,
    property_id: args.identity.property_id,
    sequence_id: args.identity.sequence_id,
    event_type: args.event_type,
    occurred_at: args.occurred_at || new Date().toISOString(),
    source,
    actor,
    metadata: args.metadata || {},
  };
}
