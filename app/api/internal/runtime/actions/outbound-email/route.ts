import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const safeDate = (v: unknown) => {
  const raw = text(v);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const idempotencyKey = text(body.idempotency_key);
    const customerKey = text(body.customer_key);
    const input = record(body.input);
    const decision = record(body.decision);
    if (!organizationId || !agentId || !executionId || !idempotencyKey || !customerKey) {
      return NextResponse.json({ error: "Missing tenant outbound-email fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const execution = await supabase.from("runtime_executions")
      .select("id,conversation_id").eq("id", executionId)
      .eq("organization_id", organizationId).eq("agent_id", agentId).single();
    if (execution.error || !execution.data) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const duplicate = await supabase.from("conversation_messages")
      .select("id").eq("organization_id", organizationId)
      .contains("payload", { workflow_key: "outbound_email_crm_v5", idempotency_key: idempotencyKey })
      .limit(1).maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) return NextResponse.json({
      ok: true, duplicate: true, organization_id: organizationId,
      agent_id: agentId, execution_id: executionId, idempotency_key: idempotencyKey, actions: []
    });

    const email = text(input.email) || text(input.recipient_email);
    let customerId = text(body.customer_id);
    if (!customerId) {
      const existing = await supabase.from("crm_customers").select("id")
        .eq("organization_id", organizationId).eq("external_key", customerKey).maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) customerId = existing.data.id;
      else {
        const created = await supabase.from("crm_customers").insert({
          organization_id: organizationId,
          external_key: customerKey,
          full_name: text(input.full_name) || "Unknown contact",
          email: email || null,
          company_name: text(input.company_name) || null,
          status: "active",
          profile: { job_title: text(input.job_title) || null, preferred_channel: "email" },
          metadata: { created_by_workflow: "outbound_email_crm_v5", first_execution_id: executionId }
        }).select("id").single();
        if (created.error) throw created.error;
        customerId = created.data.id;
      }
    }

    let leadId = text(body.lead_id);
    if (!leadId) {
      const existingLead = await supabase.from("crm_leads").select("id")
        .eq("organization_id", organizationId).eq("customer_id", customerId)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      if (existingLead.error) throw existingLead.error;
      if (existingLead.data) leadId = existingLead.data.id;
      else {
        const lead = await supabase.from("crm_leads").insert({
          organization_id: organizationId,
          customer_id: customerId,
          assigned_agent_id: agentId,
          source: "outbound_email",
          stage: text(decision.lead_stage) || "new",
          score: 0,
          summary: text(input.campaign_name) || "Outbound email prospect",
          details: { campaign_id: text(body.campaign_id) || null, sequence_step: Number(body.sequence_step) || 1 }
        }).select("id").single();
        if (lead.error) throw lead.error;
        leadId = lead.data.id;
      }
    }

    const customer = await supabase.from("crm_customers")
      .select("email,status,profile,metadata").eq("id", customerId)
      .eq("organization_id", organizationId).single();
    if (customer.error) throw customer.error;
    const profile = record(customer.data.profile);
    const metadata = record(customer.data.metadata);
    const replyClass = text(decision.reply_classification);
    const suppressed = Boolean(
      profile.opted_out || metadata.opted_out || metadata.do_not_contact ||
      customer.data.status === "do_not_contact" || replyClass === "unsubscribe" || replyClass === "bounce"
    );

    let conversationId = text(body.conversation_id) || text(execution.data.conversation_id);
    if (!conversationId) {
      const conversation = await supabase.from("agent_conversations").insert({
        organization_id: organizationId,
        agent_id: agentId,
        customer_id: customerId,
        channel: "email",
        status: decision.handoff_required ? "human_handoff" : "open",
        current_stage: text(decision.lead_stage) || "nurturing",
        ai_paused: Boolean(decision.handoff_required),
        last_message_at: new Date().toISOString(),
        metadata: { workflow_key: "outbound_email_crm_v5", campaign_id: text(body.campaign_id) || null }
      }).select("id").single();
      if (conversation.error) throw conversation.error;
      conversationId = conversation.data.id;
      await supabase.from("runtime_executions").update({ conversation_id: conversationId })
        .eq("id", executionId).eq("organization_id", organizationId);
    }

    const action = suppressed ? "stop" : text(decision.action) || "skip";
    const now = new Date().toISOString();
    const audit = await supabase.from("conversation_messages").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      sender_type: "system",
      content_type: "workflow_decision",
      content: text(decision.reason) || `Outbound email decision: ${action}`,
      payload: {
        workflow_key: "outbound_email_crm_v5", execution_id: executionId,
        idempotency_key: idempotencyKey, action, event_type: text(body.event_type),
        campaign_id: text(body.campaign_id) || null, sequence_step: Number(body.sequence_step) || 1,
        reply_classification: replyClass || null, suppressed
      }
    });
    if (audit.error) throw audit.error;

    const updateLead = await supabase.from("crm_leads").update({
      stage: text(decision.lead_stage) || "nurturing",
      details: {
        workflow_key: "outbound_email_crm_v5", campaign_id: text(body.campaign_id) || null,
        sequence_step: Number(body.sequence_step) || 1, action, reason: text(decision.reason),
        reply_classification: replyClass || null, next_send_at: safeDate(decision.next_send_at),
        stop_sequence: Boolean(decision.stop_sequence || suppressed), last_execution_id: executionId
      },
      updated_at: now
    }).eq("id", leadId).eq("organization_id", organizationId);
    if (updateLead.error) throw updateLead.error;

    if (replyClass === "unsubscribe" || replyClass === "bounce") {
      const suppression = await supabase.from("crm_customers").update({
        status: replyClass === "unsubscribe" ? "do_not_contact" : "inactive",
        metadata: { ...metadata, opted_out: replyClass === "unsubscribe", email_bounced: replyClass === "bounce",
          suppression_source: "outbound_email_crm_v5", suppression_execution_id: executionId },
        updated_at: now
      }).eq("id", customerId).eq("organization_id", organizationId);
      if (suppression.error) throw suppression.error;
    }

    let followUp = null;
    const nextSendAt = safeDate(decision.next_send_at);
    if (!suppressed && !decision.stop_sequence && nextSendAt && ["send","reschedule"].includes(action)) {
      const task = await supabase.from("crm_tasks").insert({
        organization_id: organizationId, customer_id: customerId, lead_id: leadId,
        assigned_agent_id: agentId, task_type: "outbound_email_sequence",
        title: `Outbound email step ${Number(decision.next_step) || Number(body.sequence_step) + 1}`,
        description: text(decision.reason) || "Continue outbound email sequence.",
        status: "scheduled", due_at: nextSendAt,
        metadata: { workflow_key: "outbound_email_crm_v5", campaign_id: text(body.campaign_id) || null,
          sequence_step: Number(decision.next_step) || Number(body.sequence_step) + 1,
          source_execution_id: executionId, idempotency_key: `${idempotencyKey}:next` }
      }).select("id,status,due_at").single();
      if (task.error) throw task.error;
      followUp = task.data;
    }

    let handoff = null;
    if (decision.handoff_required || action === "handoff") {
      const created = await supabase.from("handoff_requests").insert({
        organization_id: organizationId, conversation_id: conversationId, agent_id: agentId,
        reason: text(decision.handoff_reason) || text(decision.reason) || "Outbound email requires human review.",
        priority: ["urgent","high"].includes(text(decision.priority)) ? text(decision.priority) : "normal",
        status: "open", notes: `Execution ${executionId}`
      }).select("id,status,priority,reason").single();
      if (created.error) throw created.error;
      handoff = created.data;
    }

    const subject = text(decision.subject);
    const message = text(decision.message);
    const emailAction = action === "send" && subject && message && !suppressed ? {
      type: "reply", channel: "email", recipient: email || text(customer.data.email),
      subject, content: message, conversation_id: conversationId,
      customer_id: customerId, lead_id: leadId,
      campaign_id: text(body.campaign_id) || null, sequence_step: Number(body.sequence_step) || 1
    } : null;

    if (subject || message) {
      const outbound = await supabase.from("conversation_messages").insert({
        organization_id: organizationId, conversation_id: conversationId,
        sender_type: "assistant", content_type: "email", content: message || subject,
        payload: { workflow_key: "outbound_email_crm_v5", execution_id: executionId,
          idempotency_key: `${idempotencyKey}:outbound`, subject: subject || null,
          recipient: email || text(customer.data.email), dispatch_requested: Boolean(emailAction), suppressed }
      });
      if (outbound.error) throw outbound.error;
    }

    await supabase.from("usage_ledger").insert({
      organization_id: organizationId, agent_id: agentId, execution_id: executionId,
      usage_type: "ai_model", quantity: Number(record(body.provider_usage).total_tokens) || 0,
      unit: "tokens", metadata: { workflow_key: "outbound_email_crm_v5",
        provider_response_id: text(body.provider_response_id) || null }
    });
    await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId, execution_id: executionId,
      event_type: "outbound_email.persisted",
      message: "Tenant outbound email decision was persisted.",
      payload: { action, customer_id: customerId, lead_id: leadId, suppressed }
    });

    return NextResponse.json({
      ok: true, organization_id: organizationId, agent_id: agentId,
      execution_id: executionId, conversation_id: conversationId,
      customer_id: customerId, lead_id: leadId,
      campaign_id: text(body.campaign_id) || null,
      sequence_step: Number(body.sequence_step) || 1,
      idempotency_key: idempotencyKey, action, suppressed,
      reply_classification: replyClass || null,
      email_action: emailAction, follow_up: followUp, handoff
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist outbound-email decision.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
