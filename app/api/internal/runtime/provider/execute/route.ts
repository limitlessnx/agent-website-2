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

function extractOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output
    .flatMap((item) => Array.isArray(record(item).content) ? record(item).content as unknown[] : [])
    .map((item) => text(record(item).text) || text(record(item).output_text))
    .filter(Boolean)
    .join("");
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

    const { data: assignment, error: assignmentError } = await supabase
      .from("agent_provider_assignments")
      .select("id,status,limits,ai_provider_id,ai_model_id,platform_provider_catalog:ai_provider_id(provider_key,status,credential_reference,configuration),platform_provider_models:ai_model_id(model_key,status)")
      .eq("organization_id", organizationId)
      .eq("agent_id", agentId)
      .eq("status", "active")
      .single();
    if (assignmentError || !assignment) {
      return NextResponse.json({ error: "No active AI provider assignment exists for this tenant agent." }, { status: 409 });
    }

    const providerValue = assignment.platform_provider_catalog;
    const modelValue = assignment.platform_provider_models;
    const provider = Array.isArray(providerValue) ? record(providerValue[0]) : record(providerValue);
    const model = Array.isArray(modelValue) ? record(modelValue[0]) : record(modelValue);
    const providerKey = text(provider.provider_key);
    const modelKey = text(model.model_key);
    if (!providerKey || !modelKey || text(provider.status) !== "active" || text(model.status) !== "active") {
      return NextResponse.json({ error: "Assigned provider or model is not active." }, { status: 409 });
    }

    const input = record(body.input);
    const outputSchema = record(body.output_schema);
    const instructions = [
      text(snapshot.compiled_prompt),
      "Return strict JSON only.",
      Object.keys(outputSchema).length ? `Required output contract: ${JSON.stringify(outputSchema)}` : "",
    ].filter(Boolean).join("\n\n");

    let providerPayload: Record<string, unknown>;
    let providerResponse: Response;
    if (providerKey === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the Fluxknight server." }, { status: 503 });
      providerPayload = {
        model: modelKey,
        input: [
          { role: "system", content: [{ type: "input_text", text: instructions }] },
          { role: "user", content: [{ type: "input_text", text: JSON.stringify(input) }] },
        ],
        temperature: Number(record(assignment.limits).temperature ?? 0.2),
      };
      providerResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(providerPayload),
        signal: AbortSignal.timeout(90_000),
      });
    } else {
      return NextResponse.json({ error: `Provider ${providerKey} is assigned but not yet supported by the runtime adapter.` }, { status: 501 });
    }

    const responsePayload = record(await providerResponse.json().catch(() => ({})));
    const latencyMs = Date.now() - startedAt;
    if (!providerResponse.ok) {
      const errorMessage = text(record(responsePayload.error).message) || `Provider request failed with ${providerResponse.status}.`;
      await supabase
        .from("runtime_model_requests")
        .update({ status: "failed", response_payload: responsePayload, latency_ms: latencyMs, error_message: errorMessage, completed_at: new Date().toISOString() })
        .eq("organization_id", organizationId)
        .eq("execution_id", executionId)
        .eq("status", "prepared");
      return NextResponse.json({ error: errorMessage }, { status: 502 });
    }

    const usage = record(responsePayload.usage);
    const outputText = extractOutputText(responsePayload);
    await Promise.all([
      supabase
        .from("runtime_model_requests")
        .update({
          status: "succeeded",
          response_payload: responsePayload,
          input_tokens: Number(usage.input_tokens) || null,
          output_tokens: Number(usage.output_tokens) || null,
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
        quantity: (Number(usage.input_tokens) || 0) + (Number(usage.output_tokens) || 0),
        unit_cost_minor: 0,
        metadata: { provider: providerKey, model: modelKey, purpose, provider_response_id: responsePayload.id },
      }),
      supabase.from("runtime_progress_events").insert({
        organization_id: organizationId,
        execution_id: executionId,
        event_type: "provider.completed",
        message: "Assigned AI provider completed the request.",
        payload: { provider: providerKey, model: modelKey, latency_ms: latencyMs },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      organization_id: organizationId,
      agent_id: agentId,
      execution_id: executionId,
      provider_assignment_id: assignment.id,
      provider: providerKey,
      model: modelKey,
      response_id: responsePayload.id || null,
      output_text: outputText,
      usage,
      latency_ms: latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to execute assigned provider.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 409 });
  }
}
