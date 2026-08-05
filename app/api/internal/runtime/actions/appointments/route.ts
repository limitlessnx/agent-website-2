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

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
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
    const eventType = text(body.event_type) || "appointment.requested";
    const input = record(body.input);
    const decision = record(body.decision);

    if (!organizationId || !agentId || !executionId || !customerKey || !idempotencyKey) {
      return NextResponse.json({ error: "Missing required appointment fields." }, { status: 400 });
    }

    const supabase = createAdminClient();

    const executionResult = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,conversation_id")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionResult.error || !executionResult.data) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const agentResult = await supabase
      .from("agents")
      .select("id,organization_id,status")
      .eq("id", agentId)
      .eq("organization_id", organizationId)
      .single();
    if (agentResult.error || !agentResult.data) {
      return NextResponse.json({ error: "Agent does not belong to this organization." }, { status: 409 });
    }

    const existingDecision = await supabase
      .from("conversation_messages")
      .select("id,payload")
      .eq("organization_id", organizationId)
      .contains("payload", { workflow_key: "appointment_booking_v4", idempotency_key: idempotencyKey })
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
        idempotency_key: idempotencyKey,
        actions: [],
      });
    }

    const inputCustomer = record(input.customer);
    let customerId = text(body.customer_id);

    if (customerId) {
      const customerCheck = await supabase
        .from("crm_customers")
        .select("id")
        .eq("id", customerId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (customerCheck.error) throw customerCheck.error;
      if (!customerCheck.data) customerId = "";
    }

    if (!customerId) {
      const existingCustomer = await supabase
        .from("crm_customers")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("external_key", customerKey)
        .maybeSingle();
      if (existingCustomer.error) throw existingCustomer.error;

      if (existingCustomer.data) {
        customerId = existingCustomer.data.id;
      } else {
        const inserted = await supabase
          .from("crm_customers")
          .insert({
            organization_id: organizationId,
            external_key: customerKey,
            full_name: text(inputCustomer.full_name) || text(inputCustomer.name) || text(decision.attendee_name) || "Unknown customer",
            email: text(inputCustomer.email) || text(decision.attendee_email) || null,
            phone: text(inputCustomer.phone) || text(decision.attendee_phone) || null,
            status: "active",
            profile: { preferred_channel: channel, timezone: text(decision.timezone) || text(input.timezone) || null },
            metadata: { created_by_workflow: "appointment_booking_v4", first_execution_id: executionId },
          })
          .select("id")
          .single();
        if (inserted.error) throw inserted.error;
        customerId = inserted.data.id;
      }
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
      const created = await supabase
        .from("agent_conversations")
        .insert({
          organization_id: organizationId,
          agent_id: agentId,
          customer_id: customerId,
          channel,
          status: decision.handoff_required ? "human_handoff" : "open",
          current_stage: "appointment",
          ai_paused: Boolean(decision.handoff_required),
          last_message_at: new Date().toISOString(),
          metadata: { workflow_key: "appointment_booking_v4", event_type: eventType },
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      conversationId = created.data.id;

      await supabase
        .from("runtime_executions")
        .update({ conversation_id: conversationId })
        .eq("id", executionId)
        .eq("organization_id", organizationId);
    }

    const now = new Date().toISOString();
    const startAt = safeDate(decision.requested_start_at);
    const durationMinutes = Math.max(5, Math.min(1440, Number(decision.duration_minutes) || 30));
    const endAt = safeDate(decision.requested_end_at) || (startAt ? addMinutes(startAt, durationMinutes) : null);
    const action = text(decision.action) || "request_information";
    const status = text(decision.status) || "needs_information";
    const appointmentId = text(body.appointment_id);

    let appointmentTaskId = "";
    let appointmentTask: Record<string, unknown> | null = null;

    if (appointmentId) {
      const existingTask = await supabase
        .from("crm_tasks")
        .select("*")
        .eq("id", appointmentId)
        .eq("organization_id", organizationId)
        .eq("customer_id", customerId)
        .maybeSingle();
      if (existingTask.error) throw existingTask.error;
      if (existingTask.data) {
        appointmentTaskId = existingTask.data.id;
        appointmentTask = existingTask.data;
      }
    }

    const taskStatus =
      status === "cancelled" ? "cancelled" :
      status === "completed" ? "completed" :
      status === "no_show" ? "completed" :
      startAt ? "scheduled" : "pending";

    const appointmentMetadata = {
      ...record(appointmentTask?.metadata),
      workflow_key: "appointment_booking_v4",
      execution_id: executionId,
      idempotency_key: idempotencyKey,
      event_type: eventType,
      action,
      appointment_status: status,
      start_at: startAt,
      end_at: endAt,
      duration_minutes: durationMinutes,
      timezone: text(decision.timezone) || text(input.timezone) || "Africa/Lagos",
      location_type: text(decision.location_type) || "unspecified",
      location: text(decision.location) || null,
      appointment_type: text(decision.appointment_type) || null,
      attendee_name: text(decision.attendee_name) || null,
      attendee_email: text(decision.attendee_email) || null,
      attendee_phone: text(decision.attendee_phone) || null,
      notes: text(decision.notes) || null,
      reason: text(decision.reason) || null,
      confidence: Math.max(0, Math.min(1, Number(decision.confidence) || 0)),
      updated_at: now,
    };

    if (appointmentTaskId) {
      const updated = await supabase
        .from("crm_tasks")
        .update({
          task_type: "appointment",
          title: text(decision.title) || text(appointmentTask?.title) || "Customer appointment",
          description: text(decision.notes) || text(decision.reason) || "Appointment managed by Fluxknight.",
          status: taskStatus,
          due_at: startAt,
          metadata: appointmentMetadata,
          updated_at: now,
        })
        .eq("id", appointmentTaskId)
        .eq("organization_id", organizationId);
      if (updated.error) throw updated.error;
    } else {
      const created = await supabase
        .from("crm_tasks")
        .insert({
          organization_id: organizationId,
          customer_id: customerId,
          assigned_agent_id: agentId,
          task_type: "appointment",
          title: text(decision.title) || "Customer appointment",
          description: text(decision.notes) || text(decision.reason) || "Appointment managed by Fluxknight.",
          status: taskStatus,
          due_at: startAt,
          metadata: appointmentMetadata,
        })
        .select("id")
        .single();
      if (created.error) throw created.error;
      appointmentTaskId = created.data.id;
    }

    const auditInsert = await supabase.from("conversation_messages").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      sender_type: "system",
      content_type: "workflow_decision",
      content: text(decision.reason) || `Appointment decision: ${action}`,
      payload: {
        workflow_key: "appointment_booking_v4",
        execution_id: executionId,
        idempotency_key: idempotencyKey,
        appointment_id: appointmentTaskId,
        action,
        status,
        start_at: startAt,
        end_at: endAt,
      },
    });
    if (auditInsert.error) throw auditInsert.error;

    const reminderOffsets = array(decision.reminder_offsets_minutes)
      .map(Number)
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 10080)
      .map(Math.round);

    const reminderActions: Record<string, unknown>[] = [];
    if (startAt && ["book", "confirm", "reschedule"].includes(action)) {
      for (const offset of reminderOffsets) {
        const dueAt = new Date(new Date(startAt).getTime() - offset * 60_000).toISOString();
        if (new Date(dueAt).getTime() <= Date.now()) continue;

        const reminderTask = await supabase
          .from("crm_tasks")
          .insert({
            organization_id: organizationId,
            customer_id: customerId,
            assigned_agent_id: agentId,
            task_type: "appointment_reminder",
            title: `Appointment reminder (${offset} minutes before)`,
            description: text(decision.reminder_message) || "Send appointment reminder.",
            status: "scheduled",
            due_at: dueAt,
            metadata: {
              workflow_key: "appointment_booking_v4",
              appointment_id: appointmentTaskId,
              source_execution_id: executionId,
              reminder_offset_minutes: offset,
              channel,
              idempotency_key: `${idempotencyKey}:reminder:${offset}`,
            },
          })
          .select("id,due_at,status")
          .single();
        if (reminderTask.error) throw reminderTask.error;

        reminderActions.push({
          due_at: dueAt,
          task_id: reminderTask.data.id,
          appointment_id: appointmentTaskId,
          channel,
          content: text(decision.reminder_message) || "This is a reminder for your upcoming appointment.",
          customer_id: customerId,
          conversation_id: conversationId,
        });
      }
    }

    let handoff: Record<string, unknown> | null = null;
    if (decision.handoff_required || action === "handoff") {
      const handoffInsert = await supabase
        .from("handoff_requests")
        .insert({
          organization_id: organizationId,
          conversation_id: conversationId,
          agent_id: agentId,
          reason: text(decision.handoff_reason) || text(decision.reason) || "Appointment requires human assistance.",
          priority: "normal",
          status: "open",
          notes: `Execution ${executionId}`,
        })
        .select("id,status,priority,reason")
        .single();
      if (handoffInsert.error) throw handoffInsert.error;
      handoff = handoffInsert.data;

      await supabase
        .from("agent_conversations")
        .update({ status: "human_handoff", ai_paused: true, updated_at: now })
        .eq("id", conversationId)
        .eq("organization_id", organizationId);
    }

    const memoryRows = array(decision.memory_facts)
      .map(record)
      .filter((item) => text(item.summary))
      .map((item) => ({
        organization_id: organizationId,
        customer_key: customerKey,
        memory_type: text(item.type) || "appointment",
        summary: text(item.summary),
        confidence: Math.max(0, Math.min(1, Number(item.confidence) || 0.8)),
        source_type: "runtime_execution",
        source_id: executionId,
        metadata: {
          agent_id: agentId,
          appointment_id: appointmentTaskId,
          workflow_key: "appointment_booking_v4",
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

    const selectedChannel = channel;
    const recipient =
      selectedChannel === "email"
        ? text(customerResult.data.email)
        : text(customerResult.data.phone) || text(customerResult.data.email) || customerKey;

    const notificationContent =
      action === "cancel" ? text(decision.cancellation_message) :
      action === "remind" ? text(decision.reminder_message) :
      text(decision.confirmation_message);

    const calendarAction = decision.calendar_action_required
      ? {
          operation: action,
          appointment_id: appointmentTaskId,
          title: text(decision.title) || "Customer appointment",
          start_at: startAt,
          end_at: endAt,
          timezone: text(decision.timezone) || text(input.timezone) || "Africa/Lagos",
          location_type: text(decision.location_type) || "unspecified",
          location: text(decision.location) || null,
          attendee_name: text(decision.attendee_name) || null,
          attendee_email: text(decision.attendee_email) || text(customerResult.data.email) || null,
          attendee_phone: text(decision.attendee_phone) || text(customerResult.data.phone) || null,
          notes: text(decision.notes) || null,
          customer_id: customerId,
          conversation_id: conversationId,
        }
      : null;

    const notificationAction = decision.notification_required && notificationContent
      ? {
          channel: selectedChannel,
          recipient,
          content: notificationContent,
          conversation_id: conversationId,
          customer_id: customerId,
          appointment_id: appointmentTaskId,
        }
      : null;

    if (notificationContent) {
      const outboundInsert = await supabase.from("conversation_messages").insert({
        organization_id: organizationId,
        conversation_id: conversationId,
        sender_type: "assistant",
        content_type: "text",
        content: notificationContent,
        payload: {
          workflow_key: "appointment_booking_v4",
          execution_id: executionId,
          idempotency_key: `${idempotencyKey}:notification`,
          appointment_id: appointmentTaskId,
          channel: selectedChannel,
          dispatch_requested: Boolean(notificationAction),
        },
      });
      if (outboundInsert.error) throw outboundInsert.error;
    }

    const usage = record(body.provider_usage);
    await supabase.from("usage_ledger").insert({
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      usage_type: "model_tokens",
      quantity: Number(usage.total_tokens) || 0,
      unit: "tokens",
      metadata: {
        workflow_key: "appointment_booking_v4",
        provider_response_id: text(body.provider_response_id) || null,
      },
    });

    await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: executionId,
      event_type: "appointment.decision_persisted",
      message: "Appointment decision and tenant-scoped records were persisted.",
      payload: {
        appointment_id: appointmentTaskId,
        action,
        status,
        reminder_count: reminderActions.length,
      },
    });

    return NextResponse.json({
      ok: true,
      duplicate: false,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      customer_id: customerId,
      conversation_id: conversationId,
      appointment_id: appointmentTaskId,
      idempotency_key: idempotencyKey,
      action,
      status,
      calendar_action: calendarAction,
      notification_action: notificationAction,
      reminder_actions: reminderActions,
      handoff,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to persist appointment decision.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
