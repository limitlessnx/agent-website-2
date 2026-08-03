import type { CompiledRuntimeContext } from "./types";
import { asRecord, type SupabaseLike } from "./supabase-types";

export async function persistRuntimeContext(supabase: SupabaseLike, context: CompiledRuntimeContext) {
  const snapshotResult = await supabase
    .from("runtime_context_snapshots")
    .upsert({
      organization_id: context.execution.organization_id,
      execution_id: context.execution.id,
      agent_id: context.execution.agent_id,
      conversation_id: context.execution.conversation_id,
      prompt_version: context.prompt.version,
      compiled_prompt: context.compiledPrompt,
      memory_snapshot: context.memories,
      knowledge_snapshot: context.knowledge,
      tool_snapshot: context.tools,
      policy_snapshot: context.policy,
      checksum: context.checksum,
    }, { onConflict: "organization_id,execution_id" })
    .select("id,checksum,prompt_version")
    .single();

  if (snapshotResult.error) throw snapshotResult.error;
  const snapshot = asRecord(snapshotResult.data);

  const retrievalRows = [
    ...context.memories.map((memory, index) => ({
      organization_id: context.execution.organization_id,
      execution_id: context.execution.id,
      source_type: "memory",
      source_id: memory.id,
      rank: index + 1,
      score: memory.score,
      excerpt: JSON.stringify(memory.value).slice(0, 500),
      metadata: { type: memory.type, key: memory.key },
    })),
    ...context.knowledge.map((item, index) => ({
      organization_id: context.execution.organization_id,
      execution_id: context.execution.id,
      source_type: "knowledge",
      source_id: item.id,
      rank: index + 1,
      score: item.score,
      excerpt: item.content.slice(0, 500),
      metadata: { title: item.title, type: item.type, collection_id: item.collection_id },
    })),
  ];

  const policyRows = context.policy.decisions.map((decision) => ({
    organization_id: context.execution.organization_id,
    execution_id: context.execution.id,
    decision_key: decision.key,
    outcome: decision.outcome,
    reason: decision.reason,
    details: decision.details,
  }));

  const modelRequest = {
    organization_id: context.execution.organization_id,
    execution_id: context.execution.id,
    provider_assignment_id: context.providerRequest.provider_assignment_id,
    status: context.providerRequest.status,
    request_payload: context.providerRequest.request_payload,
  };

  const toolRows = context.plannedToolCalls.map((toolCall) => ({
    organization_id: context.execution.organization_id,
    execution_id: context.execution.id,
    tool_id: toolCall.tool_id,
    status: toolCall.status,
    input: toolCall.input,
    error_message: toolCall.status === "denied" ? toolCall.policy.reason : null,
  }));

  await Promise.all([
    supabase.from("runtime_retrieval_results").delete().eq("organization_id", context.execution.organization_id).eq("execution_id", context.execution.id),
    supabase.from("runtime_policy_decisions").delete().eq("organization_id", context.execution.organization_id).eq("execution_id", context.execution.id),
    supabase.from("runtime_model_requests").delete().eq("organization_id", context.execution.organization_id).eq("execution_id", context.execution.id).eq("status", "prepared"),
    supabase.from("runtime_tool_calls").delete().eq("organization_id", context.execution.organization_id).eq("execution_id", context.execution.id).in("status", ["requested", "denied"]),
  ]);

  await Promise.all([
    retrievalRows.length ? supabase.from("runtime_retrieval_results").insert(retrievalRows) : Promise.resolve({ error: null }),
    policyRows.length ? supabase.from("runtime_policy_decisions").insert(policyRows) : Promise.resolve({ error: null }),
    toolRows.length ? supabase.from("runtime_tool_calls").insert(toolRows) : Promise.resolve({ error: null }),
    supabase.from("runtime_model_requests").insert(modelRequest),
    supabase
      .from("runtime_executions")
      .update({
        status: context.execution.status === "queued" ? "running" : context.execution.status,
        execution_context: { snapshot_id: snapshot.id, checksum: context.checksum, model_request_prepared: true },
        prompt_version: context.prompt.version,
        started_at: new Date().toISOString(),
      })
      .eq("id", context.execution.id)
      .eq("organization_id", context.execution.organization_id),
    supabase.from("runtime_progress_events").insert({
      organization_id: context.execution.organization_id,
      execution_id: context.execution.id,
      event_type: "context.prepared",
      message: "Runtime context prepared without live provider or n8n execution.",
      payload: {
        memory_count: context.memories.length,
        knowledge_count: context.knowledge.length,
        tool_count: context.tools.length,
        checksum: context.checksum,
      },
    }),
  ]);

  return snapshot;
}
