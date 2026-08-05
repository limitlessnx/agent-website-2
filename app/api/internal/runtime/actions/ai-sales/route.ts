import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const customerKey = text(body.customer_key);
    const idempotencyKey = text(body.idempotency_key);
    const channel = text(body.channel) || "internal";
    const input = record(body.input);
    const qualification = record(body.qualification);

    if (!organizationId || !agentId || !executionId || !customerKey || !idempotencyKey) {
      return NextResponse.json({ error: "Missing required tenant execution fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,conversation_id,status")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionError || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id,organization_id,status,human_handoff_destination,configuration")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();
    if (agentError || !agent) {
      return NextResponse.json({ error: "Agent does not belong to this organization." }, { status: 409 });
    }

    const customerInput = record(input.customer);
    const fullName = text(customerInput.full_name) || text(customerInput.name) || "Unknown lead";
    const email = text(customerInput.email) || null;
    const phone = text(customerInput.phone) || null;
    const companyName = text(customerInput.company_name) || text(customerInput.company) || null;

    let customer: Record<string, unknown> | null = null;
    const existingCustomer = await supabase
      .from("crm_customers")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("external_key", customerKey)
      .maybeSingle();
    if (existingCustomer.error) throw existingCustomer.error;

    if (existingCustomer.data) {
      const updated = await supabase
        .from("crm_customers")
        .update({
          full_name: fullName,
          email,
          phone,
          company_name: companyName,
          status: "active",
          profile: {
            channel,
            qualification_status: qualification.qualification_status,
            last_intent: qualification.intent,
            last_need: qualification.need,
          },
          metadata: { last_idempotency_key: idempotencyKey, last_execution_id: executionId },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingCustomer.data.id)
        .eq("organization_id", organizationId)
        .select("*")
        .single();
      if (updated.error) throw updated.error;
      customer = updated.data;
    } else {
      const inserted = await supabase
        .from("crm_customers")
        .insert({
          organization_id: organizationId,
          external_key: customerKey,
          full_name: fullName,
          email,
          phone,
          company_name: companyName,
          status: "active",
          profile: {
            channel,
            qualification_status: qualification.qualification_status,
            last_intent: qualification.intent,
            last_need: qualification.need,
          },
          metadata: { last_idempotency_key: idempotencyKey, first_execution_id: executionId },
        })
        .select("*")
        .single();
      if (inserted.error) throw inserted.error;
      customer = inserted.data;
    }

    const customerId = String(customer?.id || "");
    let conversationId = text(body.conversation_id) || text(execution.conversation_id);
    if (conversationId) {
      const conversationCheck = await supabase
        .from("agent_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .eq("agent_id", agentId)
        .maybeSingle();
      if (conversationCheck.error) throw conversationCheck.error;
      if (!conversationCheck.data) conversationId = "";
    }

    if (!conversationId) {
      const createdConversation = await supabase
        .from("agent_conversations")
        .insert({
          organization_id: organizationId,
          agent_id: agentId,
          customer_id: customerId,
          channel,
          external_thread_key: text(body.external_thread_key) || null,
          status: qualification.handoff_required ? "human_handoff" : "open",
          current_stage: text(qualification.stage) || "new",
          ai_paused: Boolean(qualification.handoff_required),
          last_message_at: new Date().toISOString(),
          metadata: { workflow_key: "ai_sales_qualification_v2" },
        })
        .select("id")
        .single();
      if (createdConversation.error) throw createdConversation.error;
      conversationId = createdConversation.data.id;
      await supabase
        .from("runtime_executions")
        .update({ conversation_id: conversationId })
        .eq("id", executionId)
        .eq("organization_id", organizationId);
    }

    const inboundText = text(input.message) || text(input.text);
    if (inboundText) {
      const inbound = await supabase.from("conversation_messages").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        sender_type: "customer",
        content_type: "text",
        content: inboundText,
        payload: { idempotency_key: idempotencyKey, channel },
      });
      if (inbound.error) throw inbound.error;
    }

    const leadDetails = record(input.lead_context);
    const valueEstimate = Number(String(qualification.budget ?? leadDetails.budget ?? "").replace(/[^0-9.]/g, "")) || null;
    const leadInsert = await supabase
      .from("crm_leads")
      .insert({
        organization_id: organizationId,
        customer_id: customerId,
        assigned_agent_id: agentId,
        source: text(input.source) || channel,
        stage: text(qualification.stage) || "new",
        score: Number(qualification.score) || 0,
        value_estimate: valueEstimate,
        currency: text(leadDetails.currency) || "NGN",
        summary: text(qualification.summary),
        details: {
          idempotency_key: idempotencyKey,
          execution_id: executionId,
          qualification_status: qualification.qualification_status,
          intent: qualification.intent,
          need: qualification.need,
          budget: qualification.budget,
          timeline: qualification.timeline,
          location: qualification.location,
          objections: qualification.objections,
          missing_fields: qualification.missing_fields,
        },
      })
      .select("id")
      .single();
    if (leadInsert.error) throw leadInsert.error;
    const leadId = leadInsert.data.id;

    const memoryFacts = Array.isArray(qualification.memory_facts) ? qualification.memory_facts : [];
    if (memoryFacts.length) {
      const memoryRows = memoryFacts
        .map((item) => record(item))
        .filter((item) => text(item.summary))
        .map((item) => ({
          organization_id: organizationId,
          customer_key: customerKey,
          memory_type: text(item.type) || "fact",
          summary: text(item.summary),
          confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.8)),
          source_type: "runtime_execution",
          source_id: executionId,
          metadata: { agent_id: agentId, lead_id: leadId },
        }));
      if (memoryRows.length) {
        const memoryInsert = await supabase.from("customer_memories").insert(memoryRows);
        if (memoryInsert.error) throw memoryInsert.error;
      }
    }

    let handoff: Record<string, unknown> | null = null;
    if (qualification.handoff_required) {
      const handoffInsert = await supabase
        .from("handoff_requests")
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          agent_id: agentId,
          reason: text(qualification.handoff_reason) || "AI sales workflow requested human assistance.",
          priority: Number(qualification.score) >= 80 ? "high" : "normal",
          status: "open",
          notes: text(qualification.summary) || null,
        })
        .select("id,status,priority,reason")
        .single();
      if (handoffInsert.error) throw handoffInsert.error;
      handoff = handoffInsert.data;
    }

    let appointment: Record<string, unknown> | null = null;
    if (qualification.appointment_requested) {
      const taskInsert = await supabase
        .from("crm_tasks")
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          lead_id: leadId,
          assigned_agent_id: agentId,
          task_type: "appointment_booking",
          title: "Book sales appointment",
          description: text(qualification.summary),
          status: "pending",
          due_at: text(qualification.requested_datetime) || null,
          metadata: { execution_id: executionId, requested_datetime: qualification.requested_datetime },
        })
        .select("id,status,due_at")
        .single();
      if (taskInsert.error) throw taskInsert.error;
      appointment = taskInsert.data;
    }

    const score = Number(qualification.score) || 0;
    const followUpRequired = !qualification.handoff_required && text(qualification.qualification_status) !== "disqualified";
    let followUp: Record<string, unknown> | null = null;
    if (followUpRequired) {
      const delayHours = score >= 80 ? 1 : score >= 50 ? 24 : 72;
      const dueAt = new Date(Date.now() + delayHours * 60 * 60 * 1000).toISOString();
      const taskInsert = await supabase
        .from("crm_tasks")
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          lead_id: leadId,
          assigned_agent_id: agentId,
          task_type: "sales_follow_up",
          title: score >= 80 ? "Priority sales follow-up" : "Sales follow-up",
          description: text(qualification.summary),
          status: "scheduled",
          due_at: dueAt,
          metadata: { execution_id: executionId, qualification_status: qualification.qualification_status },
        })
        .select("id,status,due_at")
        .single();
      if (taskInsert.error) throw taskInsert.error;
      followUp = taskInsert.data;
    }

    const replyText = text(qualification.reply);
    const replyAction = replyText ? {
      type: "reply",
      channel,
      recipient: phone || email || customerKey,
      content: replyText,
      conversation_id: conversationId,
      customer_id: customerId,
      lead_id: leadId,
    } : null;

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      customer_id: customerId,
      lead_id: leadId,
      conversation_id: conversationId,
      qualification_status: qualification.qualification_status,
      score,
      stage: qualification.stage,
      handoff_required: Boolean(handoff),
      handoff,
      appointment_required: Boolean(appointment),
      appointment,
      follow_up_required: Boolean(followUp),
      follow_up: followUp,
      reply_action: replyAction,
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist AI sales decision.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
