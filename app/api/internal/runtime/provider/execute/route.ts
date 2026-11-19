import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase12StructuredAgent } from "@/lib/ai-runtime/migration";
import { assertFluxFeatureAccess, reserveFluxCreditCapacity, finishFluxCreditCapacity, type FluxCreditCapacity } from "@/lib/flux-credits";
import { calculateModeledProviderCostCents } from "@/lib/fluxknight-plans";
import { preflightChargeableFluxAi } from "@/lib/flux-ai-metering-core";

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
  let providerEvidence: Record<string, unknown> = {};
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id);
    const agentId = text(body.agent_id);
    const executionId = text(body.execution_id);
    const purpose = text(body.purpose) || "runtime";

    if (!organizationId || !agentId || !executionId) {
      return NextResponse.json({ error: "Missing provider execution fields." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: execution, error: executionError } = await supabase
      .from("runtime_executions")
      .select("id,organization_id,agent_id,status")
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

    const purposeKey = purpose.toLowerCase();
    const isEmailPurpose = purposeKey.includes("email");
    const isFollowUpPurpose = isEmailPurpose && (purposeKey.includes("follow") || purposeKey.includes("sequence"));
    const isVoicePurpose = purposeKey.includes("voice") || purposeKey.includes("reception");

    if (isEmailPurpose) {
      await assertFluxFeatureAccess(organizationId, "cross_channel");
      await preflightChargeableFluxAi({
        organizationId,
        feature:isFollowUpPurpose ? "follow_ups" : "cross_channel",
        action:isFollowUpPurpose ? "email_follow_up" : "ai_email",
      });
    } else if (isVoicePurpose) {
      await preflightChargeableFluxAi({ organizationId, feature:"leo_voice", action:"leo_voice_minute", quantity:1 });
    } // Web AI uses the scoped reservation preflight below; replay reads must remain available at zero balance.

    const runtimeInput = record(body.input);
    const outputSchema = record(body.output_schema);
    const systemPrompt = [
      text(snapshot.compiled_prompt),
      "This execution is running through the Phase 12 shared Fluxknight AI runtime.",
      "The organization and agent boundaries are immutable.",
    ].filter(Boolean).join("\n\n");

    if (!isEmailPurpose && !isVoicePurpose) {
      const fingerprint = createHash("sha256").update(canonical({
        organizationId, agentId, executionId, purpose, systemPrompt,
        runtimeInput, outputSchema, assignment: assignment?.id || null,
        temperature: Number(record(assignment?.limits).temperature ?? 0.2),
      })).digest("hex");
      const replay = async (status: string) => {
        if (status === "settled") {
          const cached = await supabase.from("runtime_model_requests")
            .select("response_payload,input_tokens,output_tokens,latency_ms")
            .eq("organization_id", organizationId).eq("execution_id", executionId)
            .eq("status", "succeeded").order("completed_at", { ascending: false }).limit(1).maybeSingle();
          if (cached.error) throw new Error("Stored provider result is unavailable. Do not redispatch this execution.");
          const payload = record(cached.data?.response_payload);
          if (typeof payload.output_text === "string" && typeof payload.provider === "string") return NextResponse.json({
            ok: true, duplicate: true, cached: true, billingStatus: "settled",
            organization_id: organizationId, agent_id: agentId, execution_id: executionId,
            provider_assignment_id: payload.provider_assignment_id || null,
            provider: payload.provider, model: payload.model, model_source: payload.model_source,
            response_id: payload.id || null, output_text: payload.output_text,
            usage: record(payload.usage),
            latency_ms: cached.data?.latency_ms, runtime_phase: 12,
          });
        }
        return NextResponse.json({
          error: "This execution already has credit reservation evidence. Do not redispatch it.",
          duplicate: true, billingStatus: status,
        }, { status: 409 });
      };
      const prior = await supabase.from("flux_credit_reservations").select("status,request_fingerprint")
        .eq("organization_id", organizationId).eq("idempotency_key", "phase12-provider:" + executionId).maybeSingle();
      if (prior.error) throw new Error("Credit reservation evidence is unavailable.");
      if (prior.data) {
        if (prior.data.request_fingerprint !== fingerprint) throw new Error("Execution input conflicts with its original credit reservation.");
        return await replay(String(prior.data.status));
      }
      const claimed = await reserveFluxCreditCapacity({
        organizationId, feature: "core_ai_support", action: "web_ai",
        idempotencyKey: "phase12-provider:" + executionId,
        requestFingerprint: fingerprint, source: "phase12_provider_runtime",
      });
      if (!claimed.created || claimed.status !== "held") return await replay(claimed.status);
      capacity = claimed;
      capacityOrganization = organizationId;
    }

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
    providerEvidence = { provider_response_id: result.responseId || null, provider: result.provider, model: result.modelKey };
    const latencyMs = Date.now() - startedAt;
    const usage = result.usage || {};
    const responsePayload = {
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
      supabase.from("usage_ledger").insert({
        organization_id: organizationId,
        agent_id: agentId,
        execution_id: executionId,
        usage_type: "ai_tokens",
        quantity: usage.totalTokens || (usage.inputTokens || 0) + (usage.outputTokens || 0),
        unit_cost_minor: 0,
        metadata: {
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
          provider: result.provider,
          model: result.modelKey,
          model_source: result.modelSource,
          latency_ms: latencyMs,
          runtime_phase: 12,
        },
      }),
    ]);

    if (persisted.some(write => write.error) || (capacity && !persisted[0].data?.length)) throw new Error("Provider result persistence failed. Review this execution before retrying.");
    if (capacity) {
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
          outcome: providerCompleted ? "needs_attention" : "released",
          reason: providerCompleted ? "result_or_settlement_failed" : "provider_failed",
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
