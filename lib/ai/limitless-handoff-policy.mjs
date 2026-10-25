export const LIMITLESS_REALTY_ORGANIZATION_ID = "b15f21b4-5697-4d21-9421-8a34eae3476d";

const ACTIVE_HANDOFF_STATUSES = ["open", "assigned", "in_progress", "waiting_customer"];

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePhone(value) {
  const normalized = text(value).replace(/[^0-9]/g, "");
  return normalized.length >= 8 ? normalized : null;
}

function errorText(error, fallback) {
  return (error instanceof Error ? error.message : text(error?.message) || text(error)) || fallback;
}

function notificationStatus(value) {
  const status = text(value).toLowerCase();
  return ["pending", "sent", "delivered", "read", "failed", "unassigned", "unknown"].includes(status) ? status : "unknown";
}

export function buildLimitlessHandoffAcknowledgement(value) {
  const status = notificationStatus(value);
  const deliveryMessage = ["delivered", "read"].includes(status)
    ? "The staff notification has been delivered."
    : status === "failed"
      ? "The staff notification failed. Your request remains in the team's handover queue for review."
      : status === "unassigned"
        ? "A team member still needs to be assigned. Your request is in the handover queue."
        : "Staff notification delivery is still pending verification. This is not a confirmed appointment.";
  return `Your request for human assistance has been recorded, and Maia is paused for this conversation. ${deliveryMessage}`;
}

/**
 * Build a short, tenant-scoped summary from the canonical CRM message history.
 * The caller is responsible for applying the organization and conversation filters.
 */
export function summarizeCrmMessages(rows, fallback = "Human assistance requested") {
  const messages = Array.isArray(rows) ? rows : [];
  if (!messages.length) return text(fallback).slice(0, 4000) || "Human assistance requested";
  const ordered = [...messages].reverse();
  return ordered
    .map((row) => {
      const speaker = text(row?.direction).toLowerCase() === "inbound" ? "Customer" : "Business";
      return `${speaker}: ${text(row?.content).slice(0, 360)}`;
    })
    .filter((line) => line.length > 10)
    .join("\n")
    .slice(0, 2800) || text(fallback).slice(0, 4000) || "Human assistance requested";
}

async function findExistingHandoff(admin, input) {
  let query = admin
    .from("human_handoffs")
    .select("id,status,assigned_membership_id,conversation_id,correlation_id,reason,conversation_summary")
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", input.conversationId)
    .in("status", ACTIVE_HANDOFF_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1);
  if (text(input.correlationId)) query = query.eq("correlation_id", text(input.correlationId));
  else query = query.is("correlation_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

async function readPersistedNotification(admin, organizationId, handoffId) {
  const { data, error } = await admin
    .from("handoff_notifications")
    .select("id,status,error_message,recipient,provider_message_id,channel")
    .eq("organization_id", organizationId)
    .eq("handoff_id", handoffId)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

function notificationReturn(notification, fallback = {}) {
  if (!notification) {
    return {
      notificationId: null,
      notificationStatus: fallback.notificationStatus || "unknown",
      notificationError: fallback.notificationError || null,
      notificationRecipient: fallback.notificationRecipient || null,
      missingDestination: Boolean(fallback.missingDestination),
    };
  }
  return {
    notificationId: text(notification.id) || null,
    notificationStatus: notificationStatus(notification.status),
    notificationError: text(notification.error_message) || null,
    notificationRecipient: text(notification.recipient) || null,
    missingDestination: false,
  };
}

async function resolveSummary(admin, input) {
  const supplied = text(input.summary);
  if (supplied) return supplied.slice(0, 4000);
  const { data, error } = await admin
    .from("crm_messages")
    .select("direction,content,created_at")
    .eq("organization_id", input.organizationId)
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return summarizeCrmMessages(data, input.reason);
}

async function loadCustomer(admin, input) {
  const { data, error } = await admin
    .from("crm_customers")
    .select("full_name,company_name,phone,current_stage_id")
    .eq("organization_id", input.organizationId)
    .eq("id", input.customerId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function loadStageName(admin, organizationId, stageId) {
  if (!text(stageId)) return null;
  const { data, error } = await admin
    .from("organization_customer_stages")
    .select("name")
    .eq("organization_id", organizationId)
    .eq("id", stageId)
    .maybeSingle();
  if (error) throw error;
  return text(data?.name) || null;
}

async function resolveRecipient(admin, input, assignment) {
  let recipient = normalizePhone(assignment?.destinationPhone);
  if (!assignment?.membershipId) {
    return {
      recipient,
      destinationSource: recipient ? "agent_configuration" : "unassigned_queue",
      disabled: false,
      missing: !recipient,
    };
  }

  const { data: preference, error } = await admin
    .from("organization_member_notification_preferences")
    .select("whatsapp_phone,notify_whatsapp_handoffs")
    .eq("organization_id", input.organizationId)
    .eq("membership_id", assignment.membershipId)
    .maybeSingle();
  if (error) throw error;
  if (preference?.notify_whatsapp_handoffs === false || assignment.notifyWhatsApp === false) {
    return { recipient: null, destinationSource: "membership", disabled: true, missing: false };
  }
  recipient = normalizePhone(preference?.whatsapp_phone);
  return { recipient, destinationSource: "membership", disabled: false, missing: !recipient };
}

async function recordDashboardNotification(admin, input, handoffId, assignment, customer, stageName, nextAction) {
  if (!(assignment?.notifyDashboard && assignment?.membershipId)) return;
  const { error } = await admin.from("handoff_notifications").insert({
    organization_id: input.organizationId,
    handoff_id: handoffId,
    membership_id: assignment.membershipId,
    channel: "dashboard",
    status: "sent",
    sent_at: new Date().toISOString(),
    metadata: {
      customer_name: text(customer?.full_name || customer?.company_name) || "Customer",
      customer_phone: normalizePhone(customer?.phone),
      stage_name: stageName,
      next_action: nextAction,
    },
  });
  if (error) throw error;
}

/**
 * Limitless-only handoff path. The RPC is deliberately called before any delivery
 * attempt: it is the canonical transaction boundary that persists and pauses the
 * conversation. Duplicate calls return the existing persisted notification and do
 * not send again, including after a previous delivery failure.
 */
export async function createLimitlessHumanHandoff({ admin, input, assignment, sendWhatsAppMessage }) {
  const summary = await resolveSummary(admin, input);
  const nextAction = text(input.nextAction) || null;
  const existing = await findExistingHandoff(admin, input);
  if (existing) {
    const notification = await readPersistedNotification(admin, input.organizationId, String(existing.id));
    return {
      handoffId: String(existing.id),
      status: text(existing.status) || "open",
      assignedMembershipId: existing.assigned_membership_id || null,
      summary: text(existing.conversation_summary) || summary,
      nextAction,
      duplicate: true,
      conversationPaused: true,
      ...notificationReturn(notification),
    };
  }

  const customer = await loadCustomer(admin, input);
  const stageName = await loadStageName(admin, input.organizationId, customer?.current_stage_id);
  const category = text(input.category) || "general";
  const priorityCandidate = text(input.priority).toLowerCase() || "normal";
  const priority = ["low", "normal", "high", "critical"].includes(priorityCandidate) ? priorityCandidate : "normal";
  const sourceAgentId = text(input.sourceAgentId) || null;
  const correlationId = text(input.correlationId) || null;

  // create_human_handoff atomically inserts the canonical handoff and sets the
  // canonical conversation to waiting/paused_for_handoff.
  const { data, error } = await admin.rpc("create_real_estate_handoff_once", {
    p_organization_id: input.organizationId,
    p_customer_id: input.customerId,
    p_conversation_id: input.conversationId,
    p_reason: text(input.reason).slice(0, 1000),
    p_category: category,
    p_priority: priority,
    p_source_system_id: null,
    p_source_agent_id: sourceAgentId,
    p_correlation_id: correlationId,
    p_sla_due_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    p_created_by_type: "agent",
    p_created_by_id: sourceAgentId,
    p_metadata: {
      source: "maia_runtime",
      limitless_handoff_reliability_phase: 1,
      assignment_source: assignment?.source || "unknown",
      structured_handoff: {
        customerIntent: text(input.reason) || null,
        keyPoints: [],
        customerQuestions: [],
        followUpRequired: true,
      },
    },
  });
  if (error) throw error;
  if (!data || typeof data.handoffId !== "string" || typeof data.created !== "boolean") throw new Error("Canonical handoff creation did not return a verified result.");
  const handoffId = data.handoffId;
  if (!data.created) {
    const notification = await readPersistedNotification(admin, input.organizationId, handoffId);
    return { handoffId, status: "open", assignedMembershipId: assignment?.membershipId || null,
      summary, nextAction, duplicate: true, conversationPaused: true, ...notificationReturn(notification) };
  }

  // Finish the persisted canonical record before any external delivery attempt.
  const { error: updateError } = await admin
    .from("human_handoffs")
    .update({
      conversation_summary: summary,
      stage_id_at_handoff: customer?.current_stage_id || null,
      next_action: nextAction,
      assigned_membership_id: assignment?.membershipId || null,
      status: assignment?.membershipId ? "assigned" : "open",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", input.organizationId)
    .eq("id", handoffId);
  if (updateError) throw updateError;

  await recordDashboardNotification(admin, input, handoffId, assignment, customer, stageName, nextAction);

  const destination = await resolveRecipient(admin, input, assignment);
  if (!destination.recipient) {
    const isUnassignedQueue = !assignment?.membershipId && !assignment?.destinationPhone;
    const notificationError = destination.disabled
      ? "WhatsApp handoff notifications are disabled for this destination."
      : "No WhatsApp notification destination is configured; handoff remains in the queue.";
    return {
      handoffId,
      status: assignment?.membershipId ? "assigned" : "open",
      assignedMembershipId: assignment?.membershipId || null,
      summary,
      nextAction,
      duplicate: false,
      conversationPaused: true,
      ...notificationReturn(null, {
        notificationStatus: isUnassignedQueue ? "unassigned" : "unknown",
        notificationError,
        notificationRecipient: null,
        missingDestination: destination.missing,
      }),
    };
  }

  const { data: insertedNotification, error: notificationInsertError } = await admin
    .from("handoff_notifications")
    .insert({
      organization_id: input.organizationId,
      handoff_id: handoffId,
      membership_id: assignment?.membershipId || null,
      channel: "whatsapp",
      recipient: destination.recipient,
      status: "pending",
      metadata: {
        customer_name: text(customer?.full_name || customer?.company_name) || "Customer",
        customer_phone: normalizePhone(customer?.phone),
        stage_name: stageName,
        next_action: nextAction,
        destination_source: destination.destinationSource,
      },
    })
    .select("id")
    .single();
  if (notificationInsertError || !insertedNotification?.id) {
    const notification = await readPersistedNotification(admin, input.organizationId, handoffId).catch(() => null);
    return {
      handoffId,
      status: assignment?.membershipId ? "assigned" : "open",
      assignedMembershipId: assignment?.membershipId || null,
      summary,
      nextAction,
      duplicate: false,
      conversationPaused: true,
      ...notificationReturn(notification, {
        notificationStatus: "failed",
        notificationError: errorText(notificationInsertError, "Handoff notification could not be persisted."),
        notificationRecipient: destination.recipient,
      }),
    };
  }

  const notificationId = String(insertedNotification.id);
  try {
    const result = await sendWhatsAppMessage({
      organizationId: input.organizationId,
      to: destination.recipient,
      text: `New customer handoff: ${text(customer?.full_name || customer?.company_name) || "Customer"}\nCustomer WhatsApp: ${normalizePhone(customer?.phone) || "Not recorded"}\nStage: ${stageName || "Not set"}\nSummary: ${summary}\nNext action: ${nextAction || "Review customer conversation"}`,
      deliveryMode: "direct",
      recipientType: "internal_staff",
    });
    await admin.from("handoff_notifications").update({
      status: result?.providerMessageId ? "sent" : "pending",
      provider_message_id: result?.providerMessageId || null,
      sent_at: new Date().toISOString(),
      error_message: null,
    }).eq("organization_id", input.organizationId).eq("id", notificationId).eq("status", "pending");
  } catch (error) {
    await admin.from("handoff_notifications").update({
      status: "failed",
      error_message: errorText(error, "WhatsApp handoff notification failed." ).slice(0, 2000),
    }).eq("organization_id", input.organizationId).eq("id", notificationId).eq("status", "pending");
  }

  const persistedNotification = await readPersistedNotification(admin, input.organizationId, handoffId);
  const result = notificationReturn(persistedNotification, { notificationRecipient: destination.recipient });
  if (["sent", "delivered", "read"].includes(result.notificationStatus)) {
    await admin.from("human_handoffs").update({ notified_at: new Date().toISOString() })
      .eq("organization_id", input.organizationId).eq("id", handoffId);
  }
  return {
    handoffId,
    status: assignment?.membershipId ? "assigned" : "open",
    assignedMembershipId: assignment?.membershipId || null,
    summary,
    nextAction,
    duplicate: false,
    conversationPaused: true,
    ...result,
  };
}
