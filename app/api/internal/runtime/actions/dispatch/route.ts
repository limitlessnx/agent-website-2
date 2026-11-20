import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueRuntimeCommand } from "@/lib/runtime/command-queue";
import { dispatchMaiaWhatsAppFollowUp } from "@/lib/maia-action-gateway";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

const WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function safeTimestamp(value: unknown) {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function buildTemplateVariables(
  variableKeys: string[],
  customer: Record<string, unknown>,
  lead: Record<string, unknown>,
) {
  const details = record(lead.details);
  const values: Record<string, string> = {
    customer_name: text(customer.full_name) || "there",
    last_topic: text(details.last_topic) || text(lead.summary) || "your property enquiry",
    property_name: text(details.property_name) || text(details.property_interest) || text(details.specific_interest) || "the property you asked about",
    property_location: text(details.property_location) || text(details.location) || "the property location",
    customer_interest: text(details.customer_interest) || text(details.property_interest) || text(details.specific_interest) || "your property interest",
    customer_goal: text(details.customer_goal) || text(details.goal) || "your property plans",
    objection: text(details.objection) || text(details.last_objection) || "any questions you may have",
  };

  return {
    values,
    parameters: variableKeys.map((key) => values[key] || "Not specified"),
  };
}

export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const idempotencyKey = text(body.idempotency_key);
    const actions = Array.isArray(body.actions) ? body.actions.map(record) : [];

    if (!organizationId || !agentId || !executionId || !idempotencyKey) {
      return NextResponse.json({ error: "Missing tenant dispatch fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,input")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionError || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const results: Record<string, unknown>[] = [];
    for (let index = 0; index < actions.length; index += 1) {
      const action = actions[index];
      const type = text(action.type);
      const payload = record(action.payload);
      const actionKey = `${idempotencyKey}:${type}:${index}`;

      if (type === "handoff") {
        results.push({ type, status: "recorded", payload });
        continue;
      }

      if (type === "appointment") {
        const { data: integration, error: integrationError } = await supabase
          .from("organization_integrations")
          .select("id,provider,status,credential_reference,configuration")
          .eq("organization_id", organizationId)
          .eq("status", "connected")
          .in("provider", ["google_calendar", "calendar", "outlook_calendar"])
          .limit(1)
          .maybeSingle();

        if (integrationError) throw new Error("Integration evidence is unavailable. Retry only the same operation.");
        if (!integration) {
          results.push({ type, status: "blocked", reason: "calendar_integration_not_connected", payload });
          continue;
        }

        const command = await enqueueRuntimeCommand(supabase, {
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          command_type: "calendar.book_appointment",
          payload: { integration_id: integration.id, credential_reference: integration.credential_reference, appointment: payload },
          status: "queued",
          priority: 60,
          max_attempts: 3,
          idempotency_key: actionKey,
        });
        results.push({ type, status: "queued", command });
        continue;
      }

      if (type === "follow_up") {
        const command = await enqueueRuntimeCommand(supabase, {
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          command_type: "crm.schedule_follow_up",
          payload,
          status: "queued",
          priority: 80,
          max_attempts: 3,
          available_at: text(payload.due_at) || new Date().toISOString(),
          idempotency_key: actionKey,
        });
        results.push({ type, status: "queued", command });
        continue;
      }

      if (type === "reply") {
        const channel = text(payload.channel);
        if (channel === "web_chat" || channel === "internal") {
          if (text(payload.conversation_id) && text(payload.content)) {
            const messageInsert = await supabase.from("conversation_messages").insert({
              organization_id: organizationId,
              conversation_id: text(payload.conversation_id),
              sender_type: "agent",
              sender_id: agentId,
              content_type: "text",
              content: text(payload.content),
              payload: { execution_id: executionId, idempotency_key: actionKey },
            }).select("id").single();
            if (messageInsert.error) throw messageInsert.error;
            results.push({ type, status: "ready", message_id: messageInsert.data.id, content: payload.content });
          } else {
            results.push({ type, status: "blocked", reason: "missing_conversation_or_content" });
          }
          continue;
        }

        if (channel === "whatsapp") {
          const conversationId = text(payload.conversation_id);
          const taskId = text(payload.task_id);
          const customerId = text(payload.customer_id);
          const leadId = text(payload.lead_id);

          const [lastInboundResult, taskResult, customerResult, leadResult] = await Promise.all([
            conversationId
              ? supabase
                .from("conversation_messages")
                .select("created_at")
                .eq("organization_id", organizationId)
                .eq("conversation_id", conversationId)
                .in("sender_type", ["customer", "user"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            taskId
              ? supabase
                .from("crm_tasks")
                .select("id,metadata")
                .eq("organization_id", organizationId)
                .eq("id", taskId)
                .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            customerId
              ? supabase
                .from("crm_customers")
                .select("id,full_name")
                .eq("organization_id", organizationId)
                .eq("id", customerId)
                .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            leadId
              ? supabase
                .from("crm_leads")
                .select("id,summary,details")
                .eq("organization_id", organizationId)
                .eq("id", leadId)
                .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
          ]);

          if (lastInboundResult.error) throw lastInboundResult.error;
          if (taskResult.error) throw taskResult.error;
          if (customerResult.error) throw customerResult.error;
          if (leadResult.error) throw leadResult.error;

          const lastInboundAt = safeTimestamp(lastInboundResult.data?.created_at);
          const windowOpen = Boolean(
            lastInboundAt &&
            Date.now() - lastInboundAt.getTime() >= 0 &&
            Date.now() - lastInboundAt.getTime() < WHATSAPP_CUSTOMER_SERVICE_WINDOW_MS,
          );

          const executionInput = record(execution.input);
          const taskMetadata = record(taskResult.data?.metadata);
          const workflowKey = text(taskMetadata.workflow_key) || text(executionInput.workflow_key);
          const isCrmFollowUp = workflowKey === "crm_follow_up_v3" || taskMetadata.source_execution_id === executionId;

          if (isCrmFollowUp) {
            const recipient = text(payload.recipient);
            if (!recipient) {
              results.push({ type, status: "blocked", reason: "whatsapp_recipient_missing" });
              continue;
            }

            if (!windowOpen) {
              const { data: templateConfig, error: templateError } = await supabase
                .from("whatsapp_template_configs")
                .select("id,purpose,template_name,language_code,variable_keys,status,metadata")
                .eq("organization_id", organizationId)
                .eq("purpose", "follow_up_outside_24h")
                .eq("status", "active")
                .limit(1)
                .maybeSingle();
              if (templateError) throw templateError;

              if (!templateConfig) {
                results.push({ type, status: "blocked", reason: "whatsapp_follow_up_template_not_configured" });
                continue;
              }

              const variableKeys = Array.isArray(templateConfig.variable_keys)
                ? templateConfig.variable_keys.map((key) => text(key)).filter(Boolean)
                : [];
              const templateVariables = buildTemplateVariables(
                variableKeys,
                record(customerResult.data),
                record(leadResult.data),
              );

              const delivery = await dispatchMaiaWhatsAppFollowUp({
                commandId: actionKey,
                recipient,
                recipientName: text(customerResult.data?.full_name) || "there",
                message: text(payload.content) || "Following up on your property enquiry.",
                deliveryMode: "template",
                templateName: templateConfig.template_name,
                templateLanguage: templateConfig.language_code,
                templateParameters: templateVariables.parameters,
                templateVariableKeys: variableKeys,
                topic: "Maia CRM follow-up",
                propertyTitle: templateVariables.values.property_name,
                createdBy: `runtime:${executionId}`,
              });

              results.push({
                type,
                status: delivery.accepted > 0 ? "submitted" : delivery.status,
                provider: "maia_action_n8n",
                delivery_mode: "template",
                template_name: templateConfig.template_name,
                customer_service_window: {
                  open: false,
                  hours: 24,
                  last_inbound_at: lastInboundAt?.toISOString() || null,
                },
                delivery: {
                  execution_id: delivery.executionId,
                  accepted: delivery.accepted,
                  failed: delivery.failed,
                  pending_delivery: delivery.pendingDelivery,
                  template_sent: delivery.templateSent,
                },
              });
              continue;
            }

            const delivery = await dispatchMaiaWhatsAppFollowUp({
              commandId: actionKey,
              recipient,
              recipientName: text(customerResult.data?.full_name) || "there",
              message: text(payload.content),
              deliveryMode: "direct",
              topic: "Maia CRM follow-up",
              createdBy: `runtime:${executionId}`,
            });

            results.push({
              type,
              status: delivery.accepted > 0 ? "submitted" : delivery.status,
              provider: "maia_action_n8n",
              delivery_mode: "free_form",
              customer_service_window: {
                open: true,
                hours: 24,
                last_inbound_at: lastInboundAt?.toISOString() || null,
              },
              delivery: {
                execution_id: delivery.executionId,
                accepted: delivery.accepted,
                failed: delivery.failed,
                pending_delivery: delivery.pendingDelivery,
                free_form_sent: delivery.freeFormSent,
              },
            });
            continue;
          }
        }

        const providerKeys: Record<string, string[]> = {
          whatsapp: ["whatsapp", "whatsapp_cloud", "meta_whatsapp"],
          email: ["email", "resend", "gmail", "google_workspace", "microsoft_365"],
          telegram: ["telegram"],
          voice: ["voice", "elevenlabs", "vapi", "retell"],
        };
        if (["email", "voice"].includes(channel) && (!text(payload.recipient) || !text(payload.content) || (channel === "email" && !text(payload.subject)))) {
          results.push({ type, status: "blocked", reason: `${channel}_recipient_or_content_missing` });
          continue;
        }
        if (channel === "email") {
          const customerId = text(payload.customer_id);
          if (!customerId) { results.push({ type, status: "blocked", reason: "email_customer_scope_missing" }); continue; }
          const contact = await supabase.from("crm_customers").select("id,email,status,profile,metadata").eq("id", customerId).eq("organization_id", organizationId).maybeSingle();
          if (contact.error) throw new Error("Email suppression evidence is unavailable. Retry only the same operation.");
          const profile = record(contact.data?.profile), metadata = record(contact.data?.metadata);
          if (!contact.data || contact.data.status !== "active" || profile.opted_out || metadata.opted_out || metadata.do_not_contact || metadata.email_bounced) {
            results.push({ type, status: "blocked", reason: "email_customer_suppressed_or_unavailable" }); continue;
          }
          if (text(contact.data.email).toLowerCase() !== text(payload.recipient).toLowerCase()) {
            results.push({ type, status: "blocked", reason: "email_recipient_requires_review" }); continue;
          }
        }
        const providers = providerKeys[channel] || [channel];
        const { data: integration, error: integrationError } = await supabase
          .from("organization_integrations")
          .select("id,provider,status,credential_reference,configuration")
          .eq("organization_id", organizationId)
          .eq("status", "connected")
          .in("provider", providers)
          .limit(1)
          .maybeSingle();

        if (integrationError) throw new Error("Integration evidence is unavailable. Retry only the same operation.");
        if (!integration) {
          results.push({ type, status: "blocked", reason: `${channel}_integration_not_connected`, payload });
          continue;
        }

        const command = await enqueueRuntimeCommand(supabase, {
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          command_type: `${channel}.send_message`,
          payload: {
            integration_id: integration.id,
            credential_reference: integration.credential_reference,
            recipient: payload.recipient,
            ...(channel === "email" ? { subject: text(payload.subject) } : {}),
            content: payload.content,
            conversation_id: payload.conversation_id,
            customer_id: payload.customer_id,
            lead_id: payload.lead_id,
          },
          status: "queued",
          priority: 50,
          max_attempts: 3,
          idempotency_key: actionKey,
        });
        results.push({ type, status: "queued", provider: integration.provider, command });
        continue;
      }

      results.push({ type, status: "ignored", reason: "unsupported_action" });
    }

    const blocked = results.some(result => result.status === "blocked");
    const progress = await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: executionId,
      event_type: blocked ? "actions.blocked" : "actions.dispatched",
      message: blocked ? "Some workflow actions require attention. Queued work was retained." : "Workflow actions were evaluated; queued work is not delivery confirmation.",
      payload: { results },
    });
    if (progress.error) throw new Error("Dispatch evidence could not be saved. Retry only the same operation; queued work was retained.");

    return NextResponse.json({
      ok: !blocked,
      needs_attention: blocked,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      idempotency_key: idempotencyKey,
      action_results: results,
    }, { status: blocked ? 409 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dispatch tenant actions.";
    return NextResponse.json({ ok: false, error: message, needs_attention: true, do_not_redispatch: true }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
