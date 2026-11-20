import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase12StructuredAgent } from "@/lib/ai-runtime/migration";
import { assertFluxFeatureAccess, reserveFluxCreditCapacity, finishFluxCreditCapacity, type FluxCreditCapacity } from "@/lib/flux-credits";
import { calculateModeledProviderCostCents } from "@/lib/fluxknight-plans";
import { preflightChargeableFluxAi } from "@/lib/flux-ai-metering-core";

import { EMAIL_DECISION_SCHEMA, EMAIL_INSTRUCTIONS, EMAIL_RESERVATION_SOURCE, EMAIL_WORKFLOW, isEmailFollowUp, readEmailDecisionInput } from "@/lib/runtime/email-decision";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveAgentKind(purpose: string) {
  const value = purpose.toLowerCase();
  if (value.includes("maia") || value.includes("realty") || value.includes("property")) return "maia" as const;
  if (value.includes("voice") || value.includes("reception")) return "voice" as const;
  if (value.includes("sales") || value.includes("lead")) return "sales" as const;
  if (value.includes("support")) return "support" as const;
  return "specialist" as const;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical((value as Record<string, unknown>)[key])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let capacity: FluxCreditCapacity | null = null;
  let capacityOrganization = "";
  let providerCompleted = false;
  let emailProviderStarted = false;
  let capacityFingerprint = "";
  let providerEvidence: Record<string, unknown> = {};
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const requestedPurpose = text(body.purpose) || "runtime";

    if (!organizationId || !agentId || !executionId) {
      return NextResponse.json({ error: "Missing provider execution fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,status,input")
      .eq("id", executionId)
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .single();
    if (executionError || !execution) {
      return NextResponse.json({ error: "Tenant execution was not found." }, { status: 404 });
    }

    const { data: snapshot, error: snapshotError } = await supabase
      .from("runtime_context_snapshots")
      .select("id,compiled_prompt,prompt_version,checksum")
      .eq("organization_id", organizationId)
      .eq("execution_id", executionId)
      .single();
    if (snapshotError || !snapshot) {
      return NextResponse.json({ error: "Runtime context snapshot was not found." }, { status: 409 });
    }

    const { data: assignment } = await supabase
      .from("agent_provider_assignments")
      .select("id,limits")
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .eq("status", "active")
      .maybeSingle();

    const persistedInput = record(execution.input);
    const workflow = text(persistedInput.workflow_key);
    const isEmailPurpose = workflow === EMAIL_WORKFLOW;
    const isVoicePurpose = workflow === "voice_receptionist_v6";
    const channel = isEmailPurpose ? "email" : "voice";
    if (isEmailPurpose || isVoicePurpose) {
      const binding = await supabase.from("agent_workflow_assignments")
        .select("id,workflow_definitions!inner(workflow_key)")
        .eq("organization_id", organizationId).eq("agent_id", agentId)
        .in("status", ["assigned", "ready"])
        .eq("workflow_definitions.environment", "production")
        .eq("workflow_definitions.status", "ready")
        .eq("workflow_definitions.channel", channel)
        .in("workflow_definitions.workflow_key", isEmailPurpose ? ["shared.email.followup"] : ["shared.voice.inbound", "shared.voice.outbound"])
        .limit(1).maybeSingle();
      if (binding.error || !binding.data || text(persistedInput.channel) !== channel) throw new Error("Communication workflow is not authorized for this execution.");
    } else if (/email|voice|reception/i.test(requestedPurpose)) {
      throw new Error("Communication purpose requires a scoped workflow execution.");
    }

    const purpose = isEmailPurpose ? workflow : isVoicePurpose ? "voice_receptionist" : requestedPurpose;
    if (isVoicePurpose) {
      await preflightChargeableFluxAi({ organizationId, feature: "leo_voice", action: "leo_voice_minute", quantity: 1 });
    }

    const runtimeInput = isEmailPurpose ? readEmailDecisionInput(body.input) : isVoicePurpose && Array.isArray(body.messages)
      ? { ...persistedInput, messages: body.messages }
      : record(body.input);
    if (isEmailPurpose) {
      const recipient = record(runtimeInput.recipient);
      if (!Object.keys(recipient).length || text(runtimeInput.event_type) !== text(persistedInput.event_type)
        || Number(runtimeInput.sequence_step ?? 1) !== Number(persistedInput.sequence_step ?? 1)
        || ["campaign_id", "customer_id", "lead_id"].some(key => text(runtimeInput[key]) !== text(persistedInput[key]))
        || text(recipient.email ?? recipient.recipient_email) !== text(persistedInput.email ?? persistedInput.recipient_email)) {
        throw new Error("Email decision input conflicts with the scoped execution.");
      }
    }
    const outputSchema = isEmailPurpose ? EMAIL_DECISION_SCHEMA : record(body.output_schema);
    const systemPrompt = [
      text(snapshot.compiled_prompt),
      "This execution is running through the Phase 12 shared Fluxknight AI runtime.",
      "The organization and agent boundaries are immutable.",
      isEmailPurpose ? EMAIL_INSTRUCTIONS : "",
    ].filter(Boolean).join("\n\n");

    if (!isVoicePurpose) {
      const emailFollowUp = isEmailFollowUp(text(persistedInput.event_type), Number(persistedInput.sequence_step ?? 1));
      const capacityKey = "phase12-provider:" + executionId;
      const source = isEmailPurpose ? EMAIL_RESERVATION_SOURCE : "phase12_provider_runtime";
      const action = isEmailPurpose ? emailFollowUp ? "email_follow_up" : "ai_email" : "web_ai";
      const fingerprint = createHash("sha256").update(canonical({
        organizationId, agentId, executionId, purpose, systemPrompt,
        runtimeInput, outputSchema, assignment: assignment?.id || null,
        temperature: Number(record(assignment?.limits).temperature ?? 0.2),
      })).digest("hex");
      const replay = async (status: string) => {
        if (status === "settled" || (isEmailPurpose && status === "held")) {
          const cached = await supabase.from("runtime_model_requests")
            .select("response_payload,input_tokens,output_tokens,latency_ms")
            .eq("organization_id", organizationId).eq("execution_id", executionId)
            .eq("status", "succeeded").order("completed_at", { ascending: false }).limit(1).maybeSingle();
          if (cached.error) throw new Error("Stored provider result is unavailable. Do not redispatch this execution.");
          const payload = record(cached.data?.response_payload);
          if (isEmailPurpose) {
            const progress = await supabase.from("runtime_progress_events").select("id")
              .eq("organization_id", organizationId).eq("execution_id", executionId)
              .eq("event_type", "provider.completed").contains("payload", { credit_request_fingerprint: fingerprint })
              .limit(1).maybeSingle();
            if (progress.error || !progress.data || payload.credit_request_fingerprint !== fingerprint) {
              return NextResponse.json({ error: "Provider completion is unconfirmed. Do not redispatch this execution.", duplicate: true }, { status: 409 });
            }
          }
          if (typeof payload.output_text === "string" && typeof payload.provider === "string") return NextResponse.json({
            ok: true, duplicate: true, cached: true, billingStatus: status,
            organization_id: organizationId, agent_id: agentId, execution_id: executionId,
            provider_assignment_id: payload.provider_assignment_id || null,
            provider: payload.provider, model: payload.model, model_source: payload.model_source,
            response_id: payload.id || null, ...(isEmailPurpose ? { id: payload.id || null } : {}), output_text: payload.output_text,
            usage: record(payload.usage),
            latency_ms: cached.data?.latency_ms, runtime_phase: 12,
          });
        }
        return NextResponse.json({
          error: "This execution already has credit reservation evidence. Do not redispatch it.",
          duplicate: true, billingStatus: status,
        }, { status: 409 });
      };
      const prior = await supabase.from("flux_credit_reservations").select("status,request_fingerprint,source,action_key")
        .eq("organization_id", organizationId).eq("idempotency_key", capacityKey).maybeSingle();
      if (prior.error) throw new Error("Credit reservation evidence is unavailable.");
      if (prior.data) {
        if (isEmailPurpose && (prior.data.source !== source || prior.data.action_key !== action)) throw new Error("Historical provider billing requires review.");
        if (prior.data.request_fingerprint !== fingerprint) throw new Error("Execution input conflicts with its original credit reservation.");
        return await replay(String(prior.data.status));
      }
      if (isEmailPurpose) {
        if (execution.status !== "running") throw new Error("Email execution is not ready for provider work.");
        const history = await Promise.all([
          supabase.from("runtime_model_requests").select("id").eq("organization_id", organizationId).eq("execution_id", executionId).neq("status", "prepared").limit(1).maybeSingle(),
          supabase.from("runtime_progress_events").select("id").eq("organization_id", organizationId).eq("execution_id", executionId).in("event_type", ["provider.completed", "outbound_email.persisted", "communication.outcome_committed"]).limit(1).maybeSingle(),
          supabase.from("flux_credit_ledger").select("id").eq("organization_id", organizationId).contains("metadata", { execution_id: executionId }).limit(1).maybeSingle(),
          supabase.from("conversation_messages").select("id").eq("organization_id", organizationId)
            .contains("payload", { workflow_key: EMAIL_WORKFLOW, execution_id: executionId }).limit(1).maybeSingle(),
        ]);
        if (history.some(evidence => evidence.error || evidence.data)) {
          throw new Error("Existing email execution evidence requires review.");
        }
        await assertFluxFeatureAccess(organizationId, "cross_channel");
      }
      const claimed = await reserveFluxCreditCapacity({
        organizationId, feature: isEmailPurpose ? emailFollowUp ? "email_follow_up" : "email_automation" : "core_ai_support", action,
        idempotencyKey: capacityKey,
        requestFingerprint: fingerprint, source,
      });
      if (!claimed.created || claimed.status !== "held") return await replay(claimed.status);
      capacityFingerprint = fingerprint;
      capacity = claimed;
      capacityOrganization = organizationId;
    }

    emailProviderStarted = isEmailPurpose;
    const result = await runPhase12StructuredAgent({
      kind: resolveAgentKind(purpose),
      organizationId,
      agentId,
      channel: "api",
      systemPrompt,
      input: runtimeInput,
      outputSchema: Object.keys(outputSchema).length ? outputSchema : undefined,
      temperature: Number(record(assignment?.limits).temperature ?? 0.2),
    });

    providerCompleted = true;
    if (isEmailPurpose && (!result.responseId || !result.parsed)) throw new Error("Email provider response is missing its decision or identity.");
    providerEvidence = { provider_response_id: result.responseId || null, provider: result.provider, model: result.modelKey };
    const latencyMs = Date.now() - startedAt;
    const usage = result.usage || {};
    const tokenQuantity = usage.totalTokens || (usage.inputTokens || 0) + (usage.outputTokens || 0);
    const creditProof = capacity ? { credit_reservation_id: capacity.id, credit_request_fingerprint: capacityFingerprint } : {};
    const responsePayload = {
      ...creditProof,
      ...(capacity && !isEmailPurpose ? { credit_usage_quantity: tokenQuantity, credit_provider_cost_cents: calculateModeledProviderCostCents("web_ai", 1) } : {}),
      provider_assignment_id: assignment?.id || null,
      usage: { input_tokens: usage.inputTokens, output_tokens: usage.outputTokens, total_tokens: usage.totalTokens },
      id: result.responseId || null,
      output_text: result.outputText,
      parsed: result.parsed,
      provider: result.provider,
      model: result.modelKey,
      model_source: result.modelSource,
    };

    const persisted = await Promise.all([
      supabase
        .from("runtime_model_requests")
        .update({
          status: "succeeded",
          response_payload: responsePayload,
          input_tokens: usage.inputTokens || null,
          output_tokens: usage.outputTokens || null,
          latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
        })
        .eq("organization_id", organizationId)
        .eq("execution_id", executionId)
        .eq("status", "prepared").select("id"),
      isEmailPurpose ? Promise.resolve({ error: null }) : supabase.from("usage_ledger").insert({
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        usage_type: "ai_tokens",
        quantity: tokenQuantity,
        unit_cost_minor: 0,
        metadata: {
          ...creditProof,
          provider: result.provider,
          model: result.modelKey,
          model_source: result.modelSource,
          purpose,
          provider_response_id: result.responseId || null,
          runtime_phase: 12,
        },
      }),
      supabase.from("runtime_progress_events").insert({
        organization_id: organizationId,
        execution_id: executionId,
        event_type: "provider.completed",
        message: "Shared Phase 12 AI runtime completed the request.",
        payload: {
          ...creditProof,
          provider_response_id: result.responseId || null,
          provider: result.provider,
          model: result.modelKey,
          model_source: result.modelSource,
          latency_ms: latencyMs,
          runtime_phase: 12,
        },
      }),
    ]);

    if (persisted.some(write => write.error) || (capacity && !persisted[0].data?.length)) throw new Error("Provider result persistence failed. Review this execution before retrying.");
    if (capacity && !isEmailPurpose) {
      const finished = await finishFluxCreditCapacity({
        organizationId, reservationId: capacity.id, outcome: "settled",
        provider: result.provider, providerCostCents: calculateModeledProviderCostCents("web_ai", 1),
        providerUsage: result.usage || {},
        metadata: { ...providerEvidence, agent_id: agentId, execution_id: executionId, purpose },
      });
      if (finished.status !== "settled") return NextResponse.json({
        error: "Provider completed; credit accounting needs attention. Do not redispatch this execution.",
        providerCompleted: true, billingStatus: finished.status,
      }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      provider_assignment_id: assignment?.id || null,
      provider: result.provider,
      model: result.modelKey,
      model_source: result.modelSource,
      response_id: result.responseId || null,
      ...(isEmailPurpose ? { id: result.responseId || null } : {}),
      output_text: result.outputText,
      usage: {
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        total_tokens: usage.totalTokens,
      },
      latency_ms: latencyMs,
      runtime_phase: 12,
    });
  } catch (error) {
    let billingStatus: string | undefined;
    if (capacity) {
      try {
        const evidence = await finishFluxCreditCapacity({
          organizationId: capacityOrganization, reservationId: capacity.id,
          outcome: providerCompleted || emailProviderStarted ? "needs_attention" : "released",
          reason: providerCompleted ? "result_or_settlement_failed" : emailProviderStarted ? "provider_outcome_unconfirmed" : "provider_failed",
          metadata: providerEvidence,
        });
        billingStatus = evidence.status;
      } catch {
        billingStatus = "reconciliation_unavailable"; // The durable hold remains; never assume a refund.
      }
    }
    const message = error instanceof Error ? error.message : "Unable to execute assigned provider.";
    return NextResponse.json({ error: message, ...(capacity ? { providerCompleted, billingStatus, doNotRedispatch: true } : {}) }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
