import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateFollowUpEligibility, resolveFollowUpPolicy, text } from "@/lib/follow-up-policy";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const limit = Math.max(1, Math.min(250, Number(body.limit) || 100));
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    const tasks = await supabase
      .from("crm_tasks")
      .select("*")
      .eq("task_type", "sales_follow_up")
      .eq("status", "scheduled")
      .lte("due_at", now)
      .order("due_at", { ascending: true })
      .limit(limit);
    if (tasks.error) throw tasks.error;

    const items: Record<string, unknown>[] = [];
    for (const task of tasks.data || []) {
      const meta = record(task.metadata);
      const organizationId = text(task.organization_id);
      const agentId = text(task.assigned_agent_id);
      const customerId = text(task.customer_id);
      const leadId = text(task.lead_id);
      if (!organizationId || !agentId || !customerId) continue;

      const [customerResult, leadResult] = await Promise.all([
        supabase.from("crm_customers").select("*").eq("id", customerId).eq("organization_id", organizationId).maybeSingle(),
        leadId
          ? supabase.from("crm_leads").select("*").eq("id", leadId).eq("organization_id", organizationId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (customerResult.error) throw customerResult.error;
      if (leadResult.error) throw leadResult.error;
      if (!customerResult.data) continue;

      let conversationId = text(meta.conversation_id);
      let conversation: Record<string, unknown> | null = null;
      if (conversationId) {
        const result = await supabase
          .from("agent_conversations")
          .select("*")
          .eq("id", conversationId)
          .eq("organization_id", organizationId)
          .eq("agent_id", agentId)
          .maybeSingle();
        if (result.error) throw result.error;
        conversation = result.data as Record<string, unknown> | null;
      } else {
        const result = await supabase
          .from("agent_conversations")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("agent_id", agentId)
          .eq("customer_id", customerId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (result.error) throw result.error;
        conversation = result.data as Record<string, unknown> | null;
        conversationId = text(result.data?.id);
      }

      let lastCustomerMessageAt = text(meta.last_customer_message_at);
      if (conversationId) {
        const message = await supabase
          .from("conversation_messages")
          .select("created_at")
          .eq("organization_id", organizationId)
          .eq("conversation_id", conversationId)
          .eq("sender_type", "customer")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (message.error) throw message.error;
        if (message.data?.created_at) lastCustomerMessageAt = String(message.data.created_at);
      }

      const policy = await resolveFollowUpPolicy(organizationId, text(meta.organization_key) || null);
      const lead = (leadResult.data || {}) as Record<string, unknown>;
      const leadDetails = record(lead.details);
      const followUpContext = {
        specific_interest: text(meta.specific_interest) || text(leadDetails.specific_interest) || text(leadDetails.property_interest),
        property_interest: text(meta.property_interest) || text(leadDetails.property_interest) || null,
        meaningful_conversation: meta.meaningful_conversation !== false,
        campaign_only: Boolean(meta.campaign_only),
        last_customer_message_at: lastCustomerMessageAt || text(leadDetails.last_customer_message_at),
        sequence_step: Number(meta.sequence_step || 1),
        sequence_anchor_at: text(meta.sequence_anchor_at) || text(task.due_at),
        appointment_booked: Boolean(meta.appointment_booked),
        interest_unavailable: Boolean(meta.interest_unavailable),
      };
      const input = {
        organization_key: text(meta.organization_key) || null,
        customer: customerResult.data,
        lead,
        task,
        conversation: conversation || {},
        follow_up_context: followUpContext,
      };
      const eligibility = evaluateFollowUpEligibility({
        policy,
        input,
        customer: customerResult.data as Record<string, unknown>,
        lead,
        conversation,
      });

      if (!eligibility.eligible) {
        await supabase
          .from("crm_tasks")
          .update({
            status: "cancelled",
            metadata: { ...meta, cancelled_at: now, cancellation_reasons: eligibility.reasons },
            updated_at: now,
          })
          .eq("id", task.id)
          .eq("organization_id", organizationId);
        continue;
      }

      const channelPolicy = record(policy.channel_policy);
      const profile = record(customerResult.data.profile);
      const channel = text(meta.channel) || text(profile.preferred_channel) || text(channelPolicy.default_channel) || "whatsapp";
      items.push({
        organization_id: organizationId,
        organization_key: text(meta.organization_key) || null,
        agent_id: agentId,
        conversation_id: conversationId || null,
        customer_id: customerId,
        customer_key: text(customerResult.data.external_key) || text(customerResult.data.email) || text(customerResult.data.phone) || customerId,
        lead_id: leadId || null,
        task_id: String(task.id),
        idempotency_key: `crm-follow-up:${task.id}:step-${followUpContext.sequence_step}`,
        channel,
        event_type: "follow_up.due",
        input,
      });
    }

    return NextResponse.json({ ok: true, count: items.length, items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load due follow-ups.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
