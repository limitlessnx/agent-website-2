import { createAdminClient } from "@/lib/supabase/admin";

export type FollowUpPolicy = {
  id?: string;
  organization_id?: string | null;
  organization_key?: string | null;
  name: string;
  status: "draft" | "active" | "paused" | "archived";
  timezone: string;
  preferred_send_time: string;
  qualification: Record<string, unknown>;
  sequence: Array<Record<string, unknown>>;
  stop_conditions: string[];
  channel_policy: Record<string, unknown>;
  message_strategy: Record<string, unknown>;
};

export const DEFAULT_FOLLOW_UP_POLICY: FollowUpPolicy = {
  name: "Default tenant follow-up policy",
  status: "active",
  timezone: "Africa/Lagos",
  preferred_send_time: "10:30",
  qualification: {
    require_specific_interest: true,
    require_meaningful_conversation: true,
    exclude_campaign_only: true,
    inactivity_hours: 24,
    require_opt_in: true,
  },
  sequence: [
    { step: 1, day: 1, purpose: "natural_check_in" },
    { step: 2, day: 3, purpose: "value_add" },
    { step: 3, day: 7, purpose: "identify_objection" },
    { step: 4, day: 14, purpose: "decision_support" },
    { step: 5, day: 21, purpose: "soft_reengagement" },
    { step: 6, day: 30, purpose: "graceful_close_to_nurture" },
  ],
  stop_conditions: [
    "customer_replied",
    "appointment_booked",
    "purchase_started",
    "human_handoff",
    "opted_out",
    "interest_unavailable",
    "lead_won",
    "lead_lost",
  ],
  channel_policy: {
    default_channel: "whatsapp",
    respect_customer_preference: true,
    campaign_messages_do_not_start_follow_up: true,
  },
  message_strategy: {
    dynamic: true,
    use_conversation_context: true,
    use_memory: true,
  },
};

export function truthy(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

export function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function resolveFollowUpPolicy(organizationId: string, organizationKey?: string | null) {
  const supabase = createAdminClient();

  if (organizationKey) {
    const byKey = await supabase
      .from("organization_follow_up_policies")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("organization_key", organizationKey)
      .eq("status", "active")
      .maybeSingle();
    if (!byKey.error && byKey.data) return byKey.data as FollowUpPolicy;
  }

  const byOrg = await supabase
    .from("organization_follow_up_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .maybeSingle();
  if (!byOrg.error && byOrg.data) return byOrg.data as FollowUpPolicy;

  return { ...DEFAULT_FOLLOW_UP_POLICY, organization_id: organizationId };
}

function normalizedFollowInput(input: Record<string, unknown>) {
  return record(input.follow_up_context || input);
}

export function extractFollowUpSignals(args: {
  input: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
}) {
  const follow = normalizedFollowInput(args.input);
  const lead = args.lead || {};
  const customer = args.customer || {};
  const conversation = args.conversation || {};
  const leadDetails = record(lead.details);
  const customerProfile = record(customer.profile);
  const customerMetadata = record(customer.metadata);

  const campaignOnly =
    truthy(follow.campaign_only) ||
    text(follow.engagement_type).toLowerCase() === "campaign" ||
    truthy(follow.campaign_message_only);

  const specificInterest =
    text(follow.property_interest) ||
    text(follow.specific_interest) ||
    text(follow.interest_reference) ||
    text(leadDetails.property_interest) ||
    text(leadDetails.specific_interest);

  const meaningfulConversation =
    truthy(follow.meaningful_conversation) ||
    truthy(follow.sales_conversation_established) ||
    Number(follow.customer_message_count || 0) > 0 ||
    Number(follow.inbound_message_count || 0) > 0;

  const optedOut =
    truthy(follow.opted_out) ||
    truthy(customerProfile.opted_out) ||
    truthy(customerMetadata.opted_out) ||
    truthy(customerMetadata.do_not_contact) ||
    text(customer.status) === "do_not_contact";

  const appointmentBooked =
    truthy(follow.appointment_booked) ||
    truthy(follow.viewing_booked) ||
    text(lead.stage) === "appointment";

  const humanHandoff =
    truthy(conversation.ai_paused) ||
    text(conversation.status) === "human_handoff";

  const interestUnavailable =
    truthy(follow.interest_unavailable) ||
    truthy(leadDetails.interest_unavailable) ||
    truthy(leadDetails.property_unavailable);

  const lastCustomerMessageAt =
    text(follow.last_customer_message_at) ||
    text(follow.last_inbound_at) ||
    text(follow.conversation_inactive_since) ||
    text(follow.last_engaged_at) ||
    text(leadDetails.last_customer_message_at);

  return {
    follow,
    campaignOnly,
    specificInterest,
    meaningfulConversation,
    optedOut,
    appointmentBooked,
    humanHandoff,
    interestUnavailable,
    lastCustomerMessageAt,
    leadStage: text(lead.stage),
  };
}

export function evaluateFollowUpEnrollment(args: {
  policy: FollowUpPolicy;
  input: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
}) {
  const qualification = args.policy.qualification || {};
  const signals = extractFollowUpSignals(args);
  const reasons: string[] = [];

  if (truthy(qualification.exclude_campaign_only) && signals.campaignOnly) reasons.push("campaign_only");
  if (truthy(qualification.require_specific_interest) && !signals.specificInterest) reasons.push("no_specific_interest");
  if (truthy(qualification.require_meaningful_conversation) && !signals.meaningfulConversation) reasons.push("no_meaningful_conversation");
  if (signals.optedOut) reasons.push("opted_out");
  if (signals.appointmentBooked) reasons.push("appointment_booked");
  if (signals.humanHandoff) reasons.push("human_handoff");
  if (signals.interestUnavailable) reasons.push("interest_unavailable");
  if (["won", "lost", "disqualified"].includes(signals.leadStage)) reasons.push(`lead_${signals.leadStage}`);

  return {
    eligible: reasons.length === 0,
    reasons,
    specific_interest: signals.specificInterest || null,
    meaningful_conversation: signals.meaningfulConversation,
    campaign_only: signals.campaignOnly,
    last_customer_message_at: signals.lastCustomerMessageAt || null,
  };
}

export function evaluateFollowUpEligibility(args: {
  policy: FollowUpPolicy;
  input: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
}) {
  const enrollment = evaluateFollowUpEnrollment(args);
  const qualification = args.policy.qualification || {};
  const signals = extractFollowUpSignals(args);
  const reasons = [...enrollment.reasons];

  const inactivityHours = Math.max(1, Number(qualification.inactivity_hours || 24));
  if (!signals.lastCustomerMessageAt) {
    reasons.push("missing_last_customer_message_at");
  } else {
    const last = new Date(signals.lastCustomerMessageAt);
    if (Number.isNaN(last.getTime())) {
      reasons.push("invalid_last_customer_message_at");
    } else if (Date.now() - last.getTime() < inactivityHours * 60 * 60 * 1000) {
      reasons.push("inactivity_window_not_reached");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    specific_interest: enrollment.specific_interest,
    inactivity_hours: inactivityHours,
    timezone: args.policy.timezone,
    preferred_send_time: args.policy.preferred_send_time,
    sequence: args.policy.sequence,
    stop_conditions: args.policy.stop_conditions,
    channel_policy: args.policy.channel_policy,
    message_strategy: args.policy.message_strategy,
  };
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i += 1) {
    const offset = zoneOffsetMs(new Date(guess), timeZone);
    guess = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(guess);
}

function preferredClock(policy: FollowUpPolicy) {
  const [hourRaw, minuteRaw] = String(policy.preferred_send_time || "10:30").split(":");
  return {
    hour: Math.max(0, Math.min(23, Number(hourRaw) || 10)),
    minute: Math.max(0, Math.min(59, Number(minuteRaw) || 30)),
  };
}

function addLocalDays(parts: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days, 12, 0, 0));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function computeInitialFollowUpDueAt(policy: FollowUpPolicy, lastCustomerMessageAt: string | Date) {
  const last = new Date(lastCustomerMessageAt);
  if (Number.isNaN(last.getTime())) throw new Error("Invalid last customer message time.");
  const inactivityHours = Math.max(1, Number(policy.qualification?.inactivity_hours || 24));
  const eligibleAt = new Date(last.getTime() + inactivityHours * 60 * 60 * 1000);
  const timeZone = policy.timezone || "UTC";
  const local = zonedParts(eligibleAt, timeZone);
  const clock = preferredClock(policy);
  let candidate = zonedLocalToUtc(local.year, local.month, local.day, clock.hour, clock.minute, timeZone);

  if (candidate.getTime() < eligibleAt.getTime()) {
    const next = addLocalDays(local, 1);
    candidate = zonedLocalToUtc(next.year, next.month, next.day, clock.hour, clock.minute, timeZone);
  }
  return candidate.toISOString();
}

export function computeSequenceStepDueAt(
  policy: FollowUpPolicy,
  sequenceAnchorAt: string | Date,
  stepNumber: number,
) {
  const sequence = Array.isArray(policy.sequence) ? policy.sequence : [];
  const step = sequence.find((entry) => Number(entry.step) === stepNumber);
  if (!step) return null;
  const anchor = new Date(sequenceAnchorAt);
  if (Number.isNaN(anchor.getTime())) return null;
  const timeZone = policy.timezone || "UTC";
  const anchorLocal = zonedParts(anchor, timeZone);
  const localDate = addLocalDays(anchorLocal, Math.max(0, Number(step.day || stepNumber) - 1));
  const clock = preferredClock(policy);
  return zonedLocalToUtc(localDate.year, localDate.month, localDate.day, clock.hour, clock.minute, timeZone).toISOString();
}
