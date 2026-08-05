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
    const idempotencyKey = text(body.idempotency_key);
    const actions = Array.isArray(body.actions) ? body.actions.map(record) : [];

    if (!organizationId || !agentId || !executionId || !idempotencyKey) {
      return NextResponse.json({ error: "Missing tenant dispatch fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id")
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
        const { data: integration } = await supabase
          .from("organization_integrations")
          .select("id,provider,status,credential_reference,configuration")
          .eq("organization_id", organizationId)
          .eq("status", "connected")
          .in("provider", ["google_calendar", "calendar", "outlook_calendar"])
          .limit(1)
          .maybeSingle();

        if (!integration) {
          results.push({ type, status: "blocked", reason: "calendar_integration_not_connected", payload });
          continue;
        }

        const queued = await supabase.from("command_queue").insert({
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          command_type: "calendar.book_appointment",
          payload: { integration_id: integration.id, credential_reference: integration.credential_reference, appointment: payload },
          status: "queued",
          priority: 60,
          max_attempts: 3,
          idempotency_key: actionKey,
        }).select("id,status").single();
        if (queued.error) throw queued.error;
        results.push({ type, status: "queued", command: queued.data });
        continue;
      }

      if (type === "follow_up") {
        const queued = await supabase.from("command_queue").insert({
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
        }).select("id,status,available_at").single();
        if (queued.error) throw queued.error;
        results.push({ type, status: "queued", command: queued.data });
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

        const providerKeys: Record<string, string[]> = {
          whatsapp: ["whatsapp", "whatsapp_cloud", "meta_whatsapp"],
          email: ["email", "resend", "gmail", "google_workspace", "microsoft_365"],
          telegram: ["telegram"],
          voice: ["voice", "elevenlabs", "vapi", "retell"],
        };
        const providers = providerKeys[channel] || [channel];
        const { data: integration } = await supabase
          .from("organization_integrations")
          .select("id,provider,status,credential_reference,configuration")
          .eq("organization_id", organizationId)
          .eq("status", "connected")
          .in("provider", providers)
          .limit(1)
          .maybeSingle();

        if (!integration) {
          results.push({ type, status: "blocked", reason: `${channel}_integration_not_connected`, payload });
          continue;
        }

        const queued = await supabase.from("command_queue").insert({
          organization_id: organizationId,
          agent_id: agentId,
          execution_id: executionId,
          command_type: `${channel}.send_message`,
          payload: {
            integration_id: integration.id,
            credential_reference: integration.credential_reference,
            recipient: payload.recipient,
            content: payload.content,
            conversation_id: payload.conversation_id,
            customer_id: payload.customer_id,
            lead_id: payload.lead_id,
          },
          status: "queued",
          priority: 50,
          max_attempts: 3,
          idempotency_key: actionKey,
        }).select("id,status").single();
        if (queued.error) throw queued.error;
        results.push({ type, status: "queued", provider: integration.provider, command: queued.data });
        continue;
      }

      results.push({ type, status: "ignored", reason: "unsupported_action" });
    }

    await supabase.from("runtime_progress_events").insert({
      organization_id: organizationId,
      execution_id: executionId,
      event_type: "actions.dispatched",
      message: "Tenant-safe workflow actions were evaluated and queued.",
      payload: { results },
    });

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      idempotency_key: idempotencyKey,
      action_results: results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dispatch tenant actions.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
