import { buildRuntimeContext } from "./context-builder";
import { persistRuntimeContext } from "./snapshot-store";
import { asRecord, type SupabaseLike } from "./supabase-types";

export async function prepareExecutionWithoutDispatch(supabase: SupabaseLike, executionId: string) {
  const context = await buildRuntimeContext(supabase, executionId);
  const snapshot = await persistRuntimeContext(supabase, context);
  return {
    snapshot,
    memory_count: context.memories.length,
    knowledge_count: context.knowledge.length,
    tool_count: context.tools.length,
    planned_tool_count: context.plannedToolCalls.length,
    provider_request_prepared: true,
    live_provider_execution_enabled: false,
    n8n_execution_enabled: false,
  };
}

export async function prepareNextQueuedExecution(supabase: SupabaseLike) {
  const { data, error } = await supabase
    .from("runtime_executions")
    .select("id")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const row = asRecord(data);
  if (!row.id) return null;
  return prepareExecutionWithoutDispatch(supabase, String(row.id));
}
