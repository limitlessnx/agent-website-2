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

function truthy(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveFollowUpPolicy(organizationId: string, organizationKey?: string | null) {
  const supabase = createAdminClient();

  if (organizationKey) {
    const byKey = await supabase
      .from("organization_follow_up_policies")
      .select("*")
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

export function evaluateFollowUpEligibility(args: {
  policy: FollowUpPolicy;
  input: Record<string, unknown>;
  lead?: Record<string, unknown> | null;
  customer?: Record<string, unknown> | null;
  conversation?: Record<string, unknown> | null;
}) {
  const { policy, input } = args;
  const qualification = policy.qualification || {};
  const follow = (input.follow_up_context && typeof input.follow_up_context === "object" && !Array.isArray(input.follow_up_context))
    ? input.follow_up_context as Record<string, unknown>
    : input;
  const lead = args.lead || {};
  const customer = args.customer || {};
  const conversation = args.conversation || {};
  const reasons: string[] = [];

  const campaignOnly = truthy(follow.campaign_only) || text(follow.engagement_type) === "campaign" || truthy(follow.campaign_message_only);
  if (truthy(qualification.exclude_campaign_only) && campaignOnly) reasons.push("campaign_only");

  const specificInterest =
    text(follow.property_interest) ||
    text(follow.specific_interest) ||
    text(follow.interest_reference) ||
    text(lead.property_interest) ||
    text((lead.details as Record<string, unknown> | undefined)?.property_interest);
  if (truthy(qualification.require_specific_interest) && !specificInterest) reasons.push("no_specific_interest");

  const meaningfulConversation =
    truthy(follow.meaningful_conversation) ||
    truthy(follow.sales_conversation_established) ||
    Number(follow.customer_message_count || 0) > 0 ||
    Number(follow.inbound_message_count || 0) > 0;
  if (truthy(qualification.require_meaningful_conversation) && !meaningfulConversation) reasons.push("no_meaningful_conversation");

  const optedOut = truthy(follow.opted_out) || truthy(customer.opted_out) || truthy((customer.profile as Record<string, unknown> | undefined)?.opted_out) || truthy((customer.metadata as Record<string, unknown> | undefined)?.do_not_contact);
  if (optedOut) reasons.push("opted_out");

  const appointmentBooked = truthy(follow.appointment_booked) || truthy(follow.viewing_booked) || text(lead.stage) === "appointment";
  if (appointmentBooked) reasons.push("appointment_booked");

  if (["won", "lost", "disqualified"].includes(text(lead.stage))) reasons.push(`lead_${text(lead.stage)}`);
  if (truthy(conversation.ai_paused) || text(conversation.status) === "human_handoff") reasons.push("human_handoff");

  const lastCustomerMessageAt = text(follow.last_customer_message_at) || text(follow.last_inbound_at) || text(follow.conversation_inactive_since) || text(follow.last_engaged_at);
  const inactivityHours = Math.max(1, Number(qualification.inactivity_hours || 24));
  if (!lastCustomerMessageAt) {
    reasons.push("missing_last_customer_message_at");
  } else {
    const last = new Date(lastCustomerMessageAt);
    if (Number.isNaN(last.getTime())) {
      reasons.push("invalid_last_customer_message_at");
    } else if (Date.now() - last.getTime() < inactivityHours * 60 * 60 * 1000) {
      reasons.push("inactivity_window_not_reached");
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    specific_interest: specificInterest || null,
    inactivity_hours: inactivityHours,
    timezone: policy.timezone,
    preferred_send_time: policy.preferred_send_time,
    sequence: policy.sequence,
    stop_conditions: policy.stop_conditions,
    channel_policy: policy.channel_policy,
    message_strategy: policy.message_strategy,
  };
}
