import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase12StructuredAgent } from "@/lib/ai-runtime/migration";

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

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
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

    const runtimeInput = record(body.input);
    const outputSchema = record(body.output_schema);
    const systemPrompt = [
      text(snapshot.compiled_prompt),
      "This execution is running through the Phase 12 shared Fluxknight AI runtime.",
      "The organization and agent boundaries are immutable.",
    ].filter(Boolean).join("\n\n");

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

    const latencyMs = Date.now() - startedAt;
    const usage = result.usage || {};
    const responsePayload = {
      id: result.responseId || null,
      output_text: result.outputText,
      parsed: result.parsed,
      provider: result.provider,
      model: result.modelKey,
      model_source: result.modelSource,
    };

    await Promise.all([
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
        .eq("status", "prepared"),
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
    const message = error instanceof Error ? error.message : "Unable to execute assigned provider.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
