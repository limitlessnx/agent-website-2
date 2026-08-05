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

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function safeDate(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
    const eventType = text(body.event_type) || "follow_up.manual";
    const input = record(body.input);
    const decision = record(body.decision);

    if (!organizationId || !agentId || !executionId || !customerKey || !idempotencyKey) {
      return NextResponse.json(
        { error: "Missing required tenant follow-up fields." },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    const executionResult = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,conversation_id,status,input_payload")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionResult.error || !executionResult.data) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const agentResult = await supabase
      .from("agents")
      .select("id,organization_id,status,configuration")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();
    if (agentResult.error || !agentResult.data) {
      return NextResponse.json({ error: "Agent does not belong to this organization." }, { status: 409 });
    }

    const inputCustomer = record(input.customer);
    let customerId = text(body.customer_id);

    if (customerId) {
      const customerCheck = await supabase
        .from("crm_customers")
        .select("id,external_key,email,phone,status,profile,metadata")
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (customerCheck.error) throw customerCheck.error;
      if (!customerCheck.data) customerId = "";
    }

    if (!customerId) {
      const existingCustomer = await supabase
        .from("crm_customers")
        .select("id,external_key,email,phone,status,profile,metadata")
        .eq("organization_id", organizationId)
        .eq("external_key", customerKey)
        .maybeSingle();
      if (existingCustomer.error) throw existingCustomer.error;

      if (existingCustomer.data) {
        customerId = existingCustomer.data.id;
      } else {
        const insertedCustomer = await supabase
          .from("crm_customers")
          .insert({
            organization_id: organizationId,
            external_key: customerKey,
            full_name: text(inputCustomer.full_name) || text(inputCustomer.name) || "Unknown customer",
            email: text(inputCustomer.email) || null,
            phone: text(inputCustomer.phone) || null,
            company_name: text(inputCustomer.company_name) || null,
            status: "active",
            profile: { preferred_channel: channel },
            metadata: {
              created_by_workflow: "crm_follow_up_v3",
              first_execution_id: executionId,
            },
          })
          .select("id")
          .single();
        if (insertedCustomer.error) throw insertedCustomer.error;
        customerId = insertedCustomer.data.id;
      }
    }

    const explicitLeadId = text(body.lead_id);
    let leadId = "";
    if (explicitLeadId) {
      const leadCheck = await supabase
        .from("crm_leads")
        .select("id,stage,score,details")
        .eq("id", explicitLeadId)
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (leadCheck.error) throw leadCheck.error;
      if (leadCheck.data) leadId = leadCheck.data.id;
    }

    if (!leadId) {
      const recentLead = await supabase
        .from("crm_leads")
        .select("id,stage,score,details")
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recentLead.error) throw recentLead.error;
      if (recentLead.data) leadId = recentLead.data.id;
    }

    const taskId = text(body.task_id);
    let sourceTask: Record<string, unknown> | null = null;
    if (taskId) {
      const taskResult = await supabase
        .from("crm_tasks")
        .select("*")
        .eq("id", taskId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (taskResult.error) throw taskResult.error;
      sourceTask = taskResult.data;
    }

    const existingDecision = await supabase
      .from("conversation_messages")
      .select("id,payload")
      .eq("organization_id", organizationId)
      .contains("payload", { workflow_key: "crm_follow_up_v3", idempotency_key: idempotencyKey })
      .limit(1)
      .maybeSingle();
    if (existingDecision.error) throw existingDecision.error;

    if (existingDecision.data) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        customer_id: customerId,
        lead_id: leadId || null,
        task_id: taskId || null,
        idempotency_key: idempotencyKey,
        actions: [],
      });
    }

    let conversationId = text(body.conversation_id) || text(executionResult.data.conversation_id);
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
      const conversationCreate = await supabase
        .from("agent_conversations")
        .insert({
          organization_id: organizationId,
          agent_id: agentId,
          customer_id: customerId,
          channel,
          status: decision.handoff_required ? "human_handoff" : "open",
          current_stage: text(decision.lead_stage) || "nurturing",
          ai_paused: Boolean(decision.handoff_required),
          last_message_at: new Date().toISOString(),
          metadata: {
            workflow_key: "crm_follow_up_v3",
            event_type: eventType,
          },
        })
        .select("id")
        .single();
      if (conversationCreate.error) throw conversationCreate.error;
      conversationId = conversationCreate.data.id;

      await supabase
        .from("runtime_executions")
        .update({ conversation_id: conversationId })
        .eq("id", executionId)
        .eq("organization_id", organizationId);
    }

    const action = text(decision.action) || "skip";
    const decisionMessage = text(decision.message);
    const now = new Date().toISOString();

    const auditMessage = await supabase
      .from("conversation_messages")
      .insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        sender_type: "system",
        content_type: "workflow_decision",
        content: text(decision.reason) || `CRM follow-up decision: ${action}`,
        payload: {
          workflow_key: "crm_follow_up_v3",
          execution_id: executionId,
          idempotency_key: idempotencyKey,
          event_type: eventType,
          action,
          channel: text(decision.channel) || channel,
          priority: text(decision.priority) || "normal",
          lead_stage: text(decision.lead_stage) || null,
          next_follow_up_at: safeDate(decision.next_follow_up_at),
          stop_sequence: Boolean(decision.stop_sequence),
        },
      });
    if (auditMessage.error) throw auditMessage.error;

    if (leadId) {
      const leadUpdate = await supabase
        .from("crm_leads")
        .update({
          stage: text(decision.lead_stage) || undefined,
          details: {
            last_follow_up_execution_id: executionId,
            last_follow_up_action: action,
            last_follow_up_reason: text(decision.reason),
            last_follow_up_at: now,
            next_follow_up_at: safeDate(decision.next_follow_up_at),
            stop_sequence: Boolean(decision.stop_sequence),
          },
          updated_at: now,
        })
        .eq("id", leadId)
        .eq("organization_id", organizationId);
      if (leadUpdate.error) throw leadUpdate.error;
    }

    if (taskId && sourceTask) {
      const taskUpdate = await supabase
        .from("crm_tasks")
        .update({
          status: text(decision.task_status) || "completed",
          due_at: safeDate(decision.next_follow_up_at),
          metadata: {
            ...record(sourceTask.metadata),
            last_execution_id: executionId,
            last_idempotency_key: idempotencyKey,
            workflow_key: "crm_follow_up_v3",
            decision_action: action,
            decision_reason: text(decision.reason),
          },
          updated_at: now,
        })
        .eq("id", taskId)
        .eq("organization_id", organizationId);
      if (taskUpdate.error) throw taskUpdate.error;
    }

    let rescheduleAction: Record<string, unknown> | null = null;
    const nextFollowUpAt = safeDate(decision.next_follow_up_at);
    if ((action === "reschedule" || action === "send") && nextFollowUpAt && !decision.stop_sequence) {
      const scheduledTask = await supabase
        .from("crm_tasks")
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          lead_id: leadId || null,
          assigned_agent_id: agentId,
          task_type: "sales_follow_up",
          title: "Scheduled CRM follow-up",
          description: text(decision.reason) || "Follow-up scheduled by Fluxknight.",
          status: "scheduled",
          due_at: nextFollowUpAt,
          metadata: {
            workflow_key: "crm_follow_up_v3",
            source_execution_id: executionId,
            source_task_id: taskId || null,
            idempotency_key: `${idempotencyKey}:next`,
            channel: text(decision.channel) || channel,
          },
        })
        .select("id,status,due_at")
        .single();
      if (scheduledTask.error) throw scheduledTask.error;
      rescheduleAction = scheduledTask.data;
    }

    let handoff: Record<string, unknown> | null = null;
    if (decision.handoff_required || action === "handoff") {
      const handoffInsert = await supabase
        .from("handoff_requests")
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          agent_id: agentId,
          reason: text(decision.handoff_reason) || text(decision.reason) || "CRM follow-up requires human review.",
          priority: text(decision.priority) === "urgent" ? "urgent" : text(decision.priority) === "high" ? "high" : "normal",
          status: "open",
          notes: `Execution ${executionId}`,
        })
        .select("id,status,priority,reason")
        .single();
      if (handoffInsert.error) throw handoffInsert.error;
      handoff = handoffInsert.data;

      await supabase
        .from("agent_conversations")
        .update({
          status: "human_handoff",
          ai_paused: true,
          updated_at: now,
        })
        .eq("id", conversationId)
        .eq("organization_id", organizationId);
    }

    const memoryRows = array(decision.memory_facts)
      .map((item) => record(item))
      .filter((item) => text(item.summary))
      .map((item) => ({
        organization_id: organizationId,
        customer_key: customerKey,
        memory_type: text(item.type) || "follow_up",
        summary: text(item.summary),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.8)),
        source_type: "runtime_execution",
        source_id: executionId,
        metadata: {
          agent_id: agentId,
          lead_id: leadId || null,
          task_id: taskId || null,
          workflow_key: "crm_follow_up_v3",
        },
      }));

    if (memoryRows.length) {
      const memoryInsert = await supabase.from("customer_memories").insert(memoryRows);
      if (memoryInsert.error) throw memoryInsert.error;
    }

    const customerResult = await supabase
      .from("crm_customers")
      .select("email,phone,status,profile,metadata")
      .eq("id", customerId)
      .eq("organization_id", organizationId)
      .single();
    if (customerResult.error) throw customerResult.error;

    const customer = customerResult.data;
    const profile = record(customer.profile);
    const metadata = record(customer.metadata);
    const optedOut = Boolean(
      profile.opted_out ||
      metadata.opted_out ||
      metadata.do_not_contact ||
      customer.status === "do_not_contact",
    );

    const selectedChannel = text(decision.channel) || channel;
    const recipient =
      selectedChannel === "email"
        ? text(customer.email)
        : text(customer.phone) || text(customer.email) || customerKey;

    let replyAction: Record<string, unknown> | null = null;
    if (action === "send" && decisionMessage && !optedOut) {
      replyAction = {
        type: "reply",
        channel: selectedChannel,
        recipient,
        subject: text(decision.subject) || null,
        content: decisionMessage,
        conversation_id: conversationId,
        customer_id: customerId,
        lead_id: leadId || null,
        task_id: taskId || null,
      };
    }

    if (decisionMessage) {
      const outboundRecord = await supabase
        .from("conversation_messages")
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          sender_type: "assistant",
          content_type: "text",
          content: decisionMessage,
          payload: {
            workflow_key: "crm_follow_up_v3",
            execution_id: executionId,
            idempotency_key: `${idempotencyKey}:outbound`,
            channel: selectedChannel,
            dispatch_requested: Boolean(replyAction),
            opted_out: optedOut,
          },
        });
      if (outboundRecord.error) throw outboundRecord.error;
    }

    await supabase
      .from("agent_conversations")
      .update({
        current_stage: text(decision.lead_stage) || "nurturing",
        last_message_at: now,
        status: action === "close" ? "closed" : decision.handoff_required ? "human_handoff" : "open",
        updated_at: now,
      })
      .eq("id", conversationId)
      .eq("organization_id", organizationId);

    const usage = record(body.provider_usage);
    const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens) || 0;
    const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens) || 0;
    const totalTokens = Number(usage.total_tokens) || inputTokens + outputTokens;

    if (totalTokens > 0) {
      const usageInsert = await supabase.from("usage_ledger").insert({
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        usage_type: "ai_tokens",
        quantity: totalTokens,
        unit: "tokens",
        metadata: {
          workflow_key: "crm_follow_up_v3",
          provider_response_id: text(body.provider_response_id) || null,
          input_tokens: inputTokens,
          output_tokens: outputTokens,
        },
      });
      if (usageInsert.error) throw usageInsert.error;
    }

    return NextResponse.json({
      ok: true,
      duplicate: false,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      customer_id: customerId,
      lead_id: leadId || null,
      task_id: taskId || null,
      conversation_id: conversationId,
      action,
      channel: selectedChannel,
      stopped: Boolean(decision.stop_sequence),
      opted_out: optedOut,
      handoff_required: Boolean(handoff),
      handoff,
      reschedule_action: rescheduleAction,
      reply_action: replyAction,
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist CRM follow-up decision.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized." ? 401 : 409 },
    );
  }
}
