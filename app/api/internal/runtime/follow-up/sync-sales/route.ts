import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeInitialFollowUpDueAt, evaluateFollowUpEnrollment, resolveFollowUpPolicy, text, truthy } from "@/lib/follow-up-policy";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const persisted = record(body.persisted);
    const qualification = record(body.qualification);
    const input = record(body.input);
    const organizationId = text(persisted.organization_id) || text(body.organization_id);
    const agentId = text(persisted.agent_id) || text(body.agent_id);
    const customerId = text(persisted.customer_id);
    const leadId = text(persisted.lead_id);
    const conversationId = text(persisted.conversation_id);
    const channel = text(body.channel) || "whatsapp";
    if (!organizationId || !agentId || !customerId || !leadId) {
      return NextResponse.json({ error: "Persisted AI sales result is missing tenant CRM references." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const [customerResult, leadResult, conversationResult] = await Promise.all([
      supabase.from("crm_customers").select("*").eq("id", customerId).eq("organization_id", organizationId).maybeSingle(),
      supabase.from("crm_leads").select("*").eq("id", leadId).eq("organization_id", organizationId).maybeSingle(),
      conversationId
        ? supabase.from("agent_conversations").select("*").eq("id", conversationId).eq("organization_id", organizationId).eq("agent_id", agentId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (customerResult.error) throw customerResult.error;
    if (leadResult.error) throw leadResult.error;
    if (conversationResult.error) throw conversationResult.error;

    const organizationKey = text(input.organization_key) || text(record(input.lead_context).organization_key) || null;
    const policy = await resolveFollowUpPolicy(organizationId, organizationKey);

    const inboundText = text(input.message) || text(input.text);
    const specificInterest =
      text(qualification.specific_interest) ||
      text(qualification.property_interest) ||
      text(record(input.lead_context).specific_interest) ||
      text(record(input.lead_context).property_interest);
    const meaningfulConversation =
      truthy(qualification.meaningful_conversation) ||
      truthy(qualification.sales_conversation_established) ||
      Boolean(inboundText && specificInterest);
    const campaignOnly =
      truthy(qualification.campaign_only) ||
      truthy(input.campaign_only) ||
      text(input.engagement_type).toLowerCase() === "campaign";
    const lastCustomerMessageAt = inboundText ? new Date().toISOString() : text(input.last_customer_message_at);

    const followUpInput = {
      follow_up_context: {
        specific_interest: specificInterest,
        property_interest: text(qualification.property_interest) || null,
        meaningful_conversation: meaningfulConversation,
        campaign_only: campaignOnly,
        last_customer_message_at: lastCustomerMessageAt,
        appointment_booked: Boolean(persisted.appointment_required),
      },
    };
    const enrollment = evaluateFollowUpEnrollment({
      policy,
      input: followUpInput,
      customer: customerResult.data as Record<string, unknown> | null,
      lead: leadResult.data as Record<string, unknown> | null,
      conversation: conversationResult.data as Record<string, unknown> | null,
    });

    const oldTasks = await supabase.from("crm_tasks").select("id,metadata")
      .eq("organization_id", organizationId).eq("customer_id", customerId)
      .eq("task_type", "sales_follow_up").eq("status", "scheduled");
    if (oldTasks.error) throw oldTasks.error;
    const now = new Date().toISOString();
    for (const task of oldTasks.data || []) {
      await supabase.from("crm_tasks").update({
        status: "cancelled",
        metadata: { ...record(task.metadata), cancelled_at: now, cancellation_reason: "new_customer_activity" },
        updated_at: now,
      }).eq("id", task.id).eq("organization_id", organizationId);
    }

    const leadDetails = record(leadResult.data?.details);
    await supabase.from("crm_leads").update({
      details: {
        ...leadDetails,
        specific_interest: specificInterest || null,
        property_interest: text(qualification.property_interest) || text(leadDetails.property_interest) || null,
        meaningful_conversation: meaningfulConversation,
        campaign_only: campaignOnly,
        last_customer_message_at: lastCustomerMessageAt || text(leadDetails.last_customer_message_at) || null,
        follow_up_enrollment_reasons: enrollment.reasons,
      },
      updated_at: now,
    }).eq("id", leadId).eq("organization_id", organizationId);

    let followUp: Record<string, unknown> | null = null;
    if (enrollment.eligible && lastCustomerMessageAt) {
      const dueAt = computeInitialFollowUpDueAt(policy, lastCustomerMessageAt);
      const inserted = await supabase.from("crm_tasks").insert({
        organization_id: organizationId,
        customer_id: customerId,
        lead_id: leadId,
        assigned_agent_id: agentId,
        task_type: "sales_follow_up",
        title: "CRM follow-up step 1",
        description: text(qualification.summary) || "Tenant follow-up sequence",
        status: "scheduled",
        due_at: dueAt,
        metadata: {
          workflow_key: "crm_follow_up_v3",
          organization_key: organizationKey,
          conversation_id: conversationId || null,
          channel,
          sequence_step: 1,
          sequence_anchor_at: dueAt,
          specific_interest: specificInterest,
          property_interest: text(qualification.property_interest) || null,
          meaningful_conversation: meaningfulConversation,
          campaign_only: false,
          last_customer_message_at: lastCustomerMessageAt,
          policy_id: text(policy.id) || null,
          source_execution_id: text(persisted.execution_id) || null,
        },
      }).select("id,status,due_at,metadata").single();
      if (inserted.error) throw inserted.error;
      followUp = inserted.data as Record<string, unknown>;
    }

    return NextResponse.json({
      ...persisted,
      follow_up_required: Boolean(followUp),
      follow_up: followUp,
      follow_up_policy: policy,
      follow_up_enrollment: enrollment,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sync AI sales follow-up.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 500 });
  }
}
