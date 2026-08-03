import type { CompiledRuntimeContext, ProviderRequest } from "./types";
import { asRecord, type SupabaseLike } from "./supabase-types";

export async function prepareProviderRequest(supabase: SupabaseLike, context: Omit<CompiledRuntimeContext, "providerRequest" | "checksum">): Promise<ProviderRequest> {
  const assignment = await supabase
    .from("agent_provider_assignments")
    .select("id,status,ai_provider_id,ai_model_id,platform_provider_catalog:ai_provider_id(provider_key,status),platform_provider_models:ai_model_id(model_key,status)")
    .eq("organization_id", context.execution.organization_id)
    .eq("agent_id", context.execution.agent_id)
    .eq("status", "active")
    .maybeSingle();

  if (assignment.error) throw assignment.error;

  const assignmentRow = asRecord(assignment.data);
  const providerValue = assignmentRow.platform_provider_catalog;
  const modelValue = assignmentRow.platform_provider_models;
  const provider = Array.isArray(providerValue) ? asRecord(providerValue[0]) : asRecord(providerValue);
  const model = Array.isArray(modelValue) ? asRecord(modelValue[0]) : asRecord(modelValue);

  return {
    provider_assignment_id: typeof assignmentRow.id === "string" ? assignmentRow.id : null,
    status: "prepared",
    request_payload: {
      execution_id: context.execution.id,
      provider: provider.provider_key || "unassigned",
      provider_status: provider.status || "unassigned",
      model: model.model_key || "unassigned",
      model_status: model.status || "unassigned",
      prompt_version: context.prompt.version,
      compiled_prompt: context.compiledPrompt,
      tool_intents: context.plannedToolCalls,
      live_provider_execution_enabled: false,
    },
  };
}
