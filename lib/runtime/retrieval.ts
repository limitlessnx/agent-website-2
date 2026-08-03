import type { RuntimeExecution, RuntimeKnowledge, RuntimeMemory, RuntimeTool } from "./types";
import { asRecord, asRecordArray, type SupabaseLike } from "./supabase-types";

const readyKnowledgeStatuses = new Set(["ready", "active", "processed"]);

function scoreText(query: string, value: string, baseScore: number) {
  const normalized = query.toLowerCase();
  if (!normalized || !value) return baseScore;
  const terms = normalized.split(/\W+/).filter((term) => term.length > 2);
  const hits = terms.filter((term) => value.toLowerCase().includes(term)).length;
  return baseScore + Math.min(hits / Math.max(terms.length, 1), 1);
}

export function getRetrievalQuery(input: Record<string, unknown>) {
  return [
    input.message,
    input.text,
    input.query,
    input.intent,
    typeof input.payload === "object" && input.payload ? JSON.stringify(input.payload) : "",
  ].filter(Boolean).join(" ");
}

export async function retrieveRuntimeMemory(supabase: SupabaseLike, execution: RuntimeExecution): Promise<RuntimeMemory[]> {
  const query = getRetrievalQuery(execution.input);
  const { data, error } = await supabase
    .from("customer_memories")
    .select("id,memory_type,memory_key,value,confidence,updated_at,customer_id,agent_id")
    .eq("organization_id", execution.organization_id)
    .or(`agent_id.eq.${execution.agent_id},agent_id.is.null`)
    .order("updated_at", { ascending: false })
    .limit(30);

  if (error) throw error;

  return asRecordArray(data)
    .map((row) => ({
      id: String(row.id || ""),
      type: String(row.memory_type || ""),
      key: String(row.memory_key || ""),
      value: row.value,
      confidence: typeof row.confidence === "number" ? row.confidence : null,
      updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
      score: scoreText(query, `${row.memory_type} ${row.memory_key} ${JSON.stringify(row.value)}`, Number(row.confidence ?? 1)),
    }))
    .sort((left: RuntimeMemory, right: RuntimeMemory) => right.score - left.score)
    .slice(0, 20);
}

export async function retrieveRuntimeKnowledge(supabase: SupabaseLike, execution: RuntimeExecution): Promise<RuntimeKnowledge[]> {
  const query = getRetrievalQuery(execution.input);
  const bindings = await supabase
    .from("agent_knowledge_bindings")
    .select("collection_id")
    .eq("organization_id", execution.organization_id)
    .eq("agent_id", execution.agent_id)
    .eq("status", "active");

  if (bindings.error) throw bindings.error;

  const collectionIds = Array.from(new Set(asRecordArray(bindings.data).map((row) => row.collection_id).filter(Boolean)));
  if (!collectionIds.length) return [];

  const sources = await supabase
    .from("knowledge_sources")
    .select("id,collection_id,title,source_type,content,status,updated_at")
    .eq("organization_id", execution.organization_id)
    .in("collection_id", collectionIds)
    .in("status", Array.from(readyKnowledgeStatuses))
    .order("updated_at", { ascending: false })
    .limit(30);

  if (sources.error) throw sources.error;

  return asRecordArray(sources.data)
    .map((row) => ({
      id: String(row.id || ""),
      collection_id: typeof row.collection_id === "string" ? row.collection_id : null,
      title: String(row.title || ""),
      type: String(row.source_type || ""),
      content: String(row.content || "").slice(0, 2000),
      status: String(row.status || ""),
      score: scoreText(query, `${row.title} ${row.source_type} ${row.content || ""}`, 1),
    }))
    .sort((left: RuntimeKnowledge, right: RuntimeKnowledge) => right.score - left.score)
    .slice(0, 10);
}

export async function retrieveRuntimeTools(supabase: SupabaseLike, execution: RuntimeExecution): Promise<RuntimeTool[]> {
  const assignments = await supabase
    .from("agent_tool_assignments")
    .select("tool_definitions(id,tool_key,display_name,description,handler_type,input_schema,required_permissions,status)")
    .eq("organization_id", execution.organization_id)
    .eq("agent_id", execution.agent_id)
    .eq("enabled", true);

  if (assignments.error) throw assignments.error;

  return asRecordArray(assignments.data).flatMap((row) => {
    const nested = row.tool_definitions;
    const tool = Array.isArray(nested) ? asRecord(nested[0]) : asRecord(nested);
    if (!tool || tool.status !== "active") return [];
    return [{
      id: String(tool.id || ""),
      key: String(tool.tool_key || ""),
      name: String(tool.display_name || ""),
      description: String(tool.description || ""),
      handler: tool.handler_type === "workflow" || tool.handler_type === "approval" ? tool.handler_type : "internal",
      input_schema: asRecord(tool.input_schema),
      required_permissions: Array.isArray(tool.required_permissions) ? tool.required_permissions.map(String) : [],
      status: String(tool.status || ""),
    }];
  });
}
