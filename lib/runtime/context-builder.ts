import { createHash } from "node:crypto";
import { compileRuntimePrompt } from "./prompt-compiler";
import { evaluateRuntimePolicy } from "./policy-engine";
import { prepareProviderRequest } from "./ai-provider";
import { retrieveRuntimeKnowledge, retrieveRuntimeMemory, retrieveRuntimeTools } from "./retrieval";
import { planToolIntents } from "./tool-planner";
import { asRecord, type SupabaseLike } from "./supabase-types";
import type { CompiledRuntimeContext, RuntimeExecution, RuntimePrompt } from "./types";

function checksumFor(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function loadRuntimeExecution(supabase: SupabaseLike, executionId: string): Promise<RuntimeExecution> {
  const { data, error } = await supabase
    .from("runtime_executions")
    .select("id,organization_id,agent_id,conversation_id,status,input")
    .eq("id", executionId)
    .single();

  if (error || !data) throw new Error("Execution not found.");
  const row = asRecord(data);
  return {
    id: String(row.id || ""),
    organization_id: String(row.organization_id || ""),
    agent_id: String(row.agent_id || ""),
    conversation_id: typeof row.conversation_id === "string" ? row.conversation_id : null,
    status: String(row.status || "queued") as RuntimeExecution["status"],
    input: asRecord(row.input),
  };
}

export async function buildRuntimeContext(supabase: SupabaseLike, executionId: string): Promise<CompiledRuntimeContext> {
  const execution = await loadRuntimeExecution(supabase, executionId);

  const [promptResult, readinessResult, memories, knowledge, tools] = await Promise.all([
    supabase
      .from("agent_prompt_versions")
      .select("version,assembled_prompt")
      .eq("organization_id", execution.organization_id)
      .eq("agent_id", execution.agent_id)
      .eq("status", "published")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("agent_runtime_readiness")
      .select("readiness_score,blockers")
      .eq("organization_id", execution.organization_id)
      .eq("agent_id", execution.agent_id)
      .maybeSingle(),
    retrieveRuntimeMemory(supabase, execution),
    retrieveRuntimeKnowledge(supabase, execution),
    retrieveRuntimeTools(supabase, execution),
  ]);

  if (promptResult.error) throw promptResult.error;
  const promptRow = asRecord(promptResult.data);
  if (!promptRow.assembled_prompt) throw new Error("Published prompt not found.");
  if (readinessResult.error) throw readinessResult.error;

  const prompt: RuntimePrompt = {
    version: Number(promptRow.version || 0),
    assembled_prompt: String(promptRow.assembled_prompt || ""),
  };
  const readiness = readinessResult.data ? asRecord(readinessResult.data) : null;
  const policy = evaluateRuntimePolicy({ execution, readiness, tools });
  const plannedToolCalls = planToolIntents({ tools, conversationInput: execution.input, decisions: policy.decisions });
  const compiledPrompt = compileRuntimePrompt({ prompt, memories, knowledge, tools, conversationInput: execution.input });
  const baseContext = { execution, prompt, compiledPrompt, memories, knowledge, tools, policy, plannedToolCalls };
  const providerRequest = await prepareProviderRequest(supabase, baseContext);
  const checksum = checksumFor({ prompt, compiledPrompt, memories, knowledge, tools, policy, plannedToolCalls, providerRequest });

  return { ...baseContext, providerRequest, checksum };
}
