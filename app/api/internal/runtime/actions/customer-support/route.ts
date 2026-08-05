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
    const support = record(body.support);

    if (!organizationId || !agentId || !executionId || !customerKey || !idempotencyKey) {
      return NextResponse.json({ error: "Missing required tenant support fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const executionResult = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,status")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionResult.error || !executionResult.data) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const agentResult = await supabase
      .from("agents")
      .select("id,organization_id,name,status,human_handoff_destination")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();
    if (agentResult.error || !agentResult.data) {
      return NextResponse.json({ error: "Agent does not belong to this organization." }, { status: 409 });
    }

    const duplicate = await supabase
      .from("support_messages")
      .select("id,conversation_id,diagnostics")
      .eq("diagnostics->>idempotency_key", idempotencyKey)
      .maybeSingle();
    if (duplicate.error) throw duplicate.error;
    if (duplicate.data) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        support_conversation_id: duplicate.data.conversation_id,
        idempotency_key: idempotencyKey,
      });
    }

    let supportConversationId = text(body.conversation_id);
    if (supportConversationId) {
      const existingConversation = await supabase
        .from("support_conversations")
        .select("id,organization_id,status")
        .eq("id", supportConversationId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (existingConversation.error) throw existingConversation.error;
      if (!existingConversation.data) supportConversationId = "";
    }

    const priority = ["low", "normal", "high", "urgent"].includes(text(support.priority))
      ? text(support.priority)
      : "normal";
    const status = ["open", "diagnosing", "waiting_approval", "resolved", "closed"].includes(text(support.conversation_status))
      ? text(support.conversation_status)
      : "open";
    const issueSummary = text(support.issue_summary) || text(input.message) || "Customer support request";

    if (!supportConversationId) {
      const created = await supabase
        .from("support_conversations")
        .insert({
          organization_id: organizationId,
          title: issueSummary.slice(0, 160),
          status,
          priority,
          created_by: customerKey,
          assigned_agent: String(agentResult.data.name || "customer-support-ai"),
          summary: issueSummary,
          metadata: {
            workflow_key: "customer_support_v2",
            agent_id: agentId,
            execution_id: executionId,
            customer_key: customerKey,
            channel,
            external_thread_key: text(body.external_thread_key) || null,
            category: support.category,
            sentiment: support.sentiment,
          },
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      supportConversationId = created.data.id;
    } else {
      const updated = await supabase
        .from("support_conversations")
        .update({
          status,
          priority,
          summary: issueSummary,
          metadata: {
            workflow_key: "customer_support_v2",
            agent_id: agentId,
            execution_id: executionId,
            customer_key: customerKey,
            channel,
            external_thread_key: text(body.external_thread_key) || null,
            category: support.category,
            sentiment: support.sentiment,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", supportConversationId)
        .eq("organization_id", organizationId);
      if (updated.error) throw updated.error;
    }

    const inbound = await supabase.from("support_messages").insert({
      conversation_id: supportConversationId,
      role: "user",
      content: text(input.message),
      diagnostics: {
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        idempotency_key: idempotencyKey,
        channel,
        customer_key: customerKey,
      },
    });
    if (inbound.error) throw inbound.error;

    const reply = text(support.reply);
    if (reply) {
      const outbound = await supabase.from("support_messages").insert({
        conversation_id: supportConversationId,
        role: "assistant",
        content: reply,
        diagnostics: {
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          provider_response_id: body.provider_response_id || null,
          category: support.category,
          priority,
          sentiment: support.sentiment,
          resolution_status: support.resolution_status,
          confidence: support.confidence,
          grounded: true,
        },
      });
      if (outbound.error) throw outbound.error;
    }

    const memoryFacts = Array.isArray(support.memory_facts) ? support.memory_facts : [];
    const memories = memoryFacts
      .map((item) => record(item))
      .filter((item) => text(item.summary))
      .map((item) => ({
        organization_id: organizationId,
        customer_key: customerKey,
        memory_type: text(item.type) || "issue",
        summary: text(item.summary),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.8)),
        source_type: "support_conversation",
        source_id: supportConversationId,
        metadata: { agent_id: agentId, execution_id: executionId },
      }));
    if (memories.length) {
      const memoryInsert = await supabase.from("customer_memories").insert(memories);
      if (memoryInsert.error) throw memoryInsert.error;
    }

    let handoff: Record<string, unknown> | null = null;
    if (Boolean(support.handoff_required)) {
      const proposed = await supabase
        .from("support_actions")
        .insert({
          conversation_id: supportConversationId,
          organization_id: organizationId,
          action_key: "human_handoff",
          title: "Escalate customer support request",
          description: text(support.handoff_reason) || issueSummary,
          risk_level: priority === "urgent" ? "high" : "medium",
          status: "proposed",
          payload: {
            agent_id: agentId,
            execution_id: executionId,
            customer_key: customerKey,
            channel,
            priority,
            destination: agentResult.data.human_handoff_destination || {},
          },
        })
        .select("id,status,risk_level,title")
        .single();
      if (proposed.error) throw proposed.error;
      handoff = proposed.data;
    }

    const approvalActions: Record<string, unknown>[] = [];
    const recommendedActions = Array.isArray(support.recommended_actions) ? support.recommended_actions : [];
    for (const rawAction of recommendedActions) {
      const action = record(rawAction);
      if (text(action.type) !== "approval") continue;
      const riskLevel = ["low", "medium", "high"].includes(text(action.risk_level)) ? text(action.risk_level) : "medium";
      const proposed = await supabase
        .from("support_actions")
        .insert({
          conversation_id: supportConversationId,
          organization_id: organizationId,
          action_key: "approval_required",
          title: text(action.title) || "Support action requires approval",
          description: text(action.description) || issueSummary,
          risk_level: riskLevel,
          status: "proposed",
          payload: { agent_id: agentId, execution_id: executionId, customer_key: customerKey, action },
        })
        .select("id,status,risk_level,title")
        .single();
      if (proposed.error) throw proposed.error;
      approvalActions.push(proposed.data);
    }

    let followUp: Record<string, unknown> | null = null;
    if (Boolean(support.follow_up_required)) {
      const hours = Math.max(1, Math.min(720, Math.round(Number(support.follow_up_hours) || 24)));
      const dueAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      const task = await supabase
        .from("crm_tasks")
        .insert({
          organization_id: organizationId,
          assigned_agent_id: agentId,
          task_type: "support_follow_up",
          title: "Customer support follow-up",
          description: issueSummary,
          status: "scheduled",
          due_at: dueAt,
          metadata: {
            support_conversation_id: supportConversationId,
            execution_id: executionId,
            customer_key: customerKey,
            category: support.category,
            priority,
          },
        })
        .select("id,status,due_at")
        .single();
      if (task.error) throw task.error;
      followUp = task.data;
    }

    const replyAction = reply ? {
      type: "reply",
      channel,
      recipient: text(record(input.customer).phone) || text(record(input.customer).email) || customerKey,
      content: reply,
      support_conversation_id: supportConversationId,
      customer_key: customerKey,
    } : null;

    const usage = record(body.provider_usage);
    const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || 0);
    const outputTokens = Number(usage.output_tokens || usage.completion_tokens || 0);
    if (inputTokens + outputTokens > 0) {
      const usageInsert = await supabase.from("usage_ledger").insert({
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        usage_type: "ai_tokens",
        quantity: inputTokens + outputTokens,
        unit_cost_minor: 0,
        metadata: { workflow_key: "customer_support_v2", input_tokens: inputTokens, output_tokens: outputTokens },
      });
      if (usageInsert.error) throw usageInsert.error;
    }

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      support_conversation_id: supportConversationId,
      category: support.category,
      priority,
      sentiment: support.sentiment,
      resolution_status: support.resolution_status,
      conversation_status: status,
      handoff_required: Boolean(handoff),
      handoff,
      approval_actions: approvalActions,
      follow_up_required: Boolean(followUp),
      follow_up: followUp,
      reply_action: replyAction,
      idempotency_key: idempotencyKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist customer support decision.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
