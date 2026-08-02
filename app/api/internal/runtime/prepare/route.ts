import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function secureEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const expected = process.env.RUNTIME_GATEWAY_SECRET || "";
  const supplied = request.headers.get("x-runtime-secret") || "";
  if (!expected || !secureEqual(expected, supplied)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const executionId = String(body.execution_id || "");
  if (!executionId) return NextResponse.json({ error: "execution_id is required." }, { status: 400 });

  const supabase = createAdminClient();
  const { data: execution, error: executionError } = await supabase
    .from("runtime_executions")
    .select("id,organization_id,agent_id,conversation_id,status")
    .eq("id", executionId)
    .single();
  if (executionError || !execution) return NextResponse.json({ error: "Execution not found." }, { status: 404 });

  const [promptResult, memoryResult, bindingResult, toolResult] = await Promise.all([
    supabase.from("agent_prompt_versions").select("version,assembled_prompt").eq("organization_id", execution.organization_id).eq("agent_id", execution.agent_id).order("version", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("customer_memories").select("id,memory_type,memory_key,value,confidence,updated_at").eq("organization_id", execution.organization_id).eq("agent_id", execution.agent_id).order("updated_at", { ascending: false }).limit(20),
    supabase.from("agent_knowledge_bindings").select("knowledge_source_id,knowledge_sources(id,title,source_type,content,status)").eq("organization_id", execution.organization_id).eq("agent_id", execution.agent_id).eq("enabled", true),
    supabase.from("agent_tool_assignments").select("tool_definitions(tool_key,display_name,description,handler_type,input_schema,status)").eq("organization_id", execution.organization_id).eq("agent_id", execution.agent_id).eq("enabled", true),
  ]);

  const prompt = promptResult.data;
  if (!prompt?.assembled_prompt) return NextResponse.json({ error: "Published prompt not found." }, { status: 409 });

  const memories = memoryResult.data || [];
  const knowledge = (bindingResult.data || []).flatMap((row: any) => {
    const source = Array.isArray(row.knowledge_sources) ? row.knowledge_sources[0] : row.knowledge_sources;
    return source?.status === "ready" ? [{ id: source.id, title: source.title, type: source.source_type, content: String(source.content || "").slice(0, 2000) }] : [];
  });
  const tools = (toolResult.data || []).flatMap((row: any) => {
    const tool = Array.isArray(row.tool_definitions) ? row.tool_definitions[0] : row.tool_definitions;
    return tool?.status === "active" ? [{ key: tool.tool_key, name: tool.display_name, description: tool.description, handler: tool.handler_type, input_schema: tool.input_schema }] : [];
  });
  const policy = { readiness_required: true, external_execution_enabled: false, approval_required_for: ["refund", "discount", "delete", "contract"] };
  const checksum = createHash("sha256").update(JSON.stringify([prompt.assembled_prompt, memories, knowledge, tools, policy])).digest("hex");

  const { data: snapshot, error: snapshotError } = await supabase.from("runtime_context_snapshots").upsert({
    organization_id: execution.organization_id,
    execution_id: execution.id,
    agent_id: execution.agent_id,
    conversation_id: execution.conversation_id,
    prompt_version: prompt.version,
    compiled_prompt: prompt.assembled_prompt,
    memory_snapshot: memories,
    knowledge_snapshot: knowledge,
    tool_snapshot: tools,
    policy_snapshot: policy,
    checksum,
  }, { onConflict: "organization_id,execution_id" }).select("id,checksum,prompt_version").single();
  if (snapshotError) return NextResponse.json({ error: snapshotError.message }, { status: 409 });

  await Promise.all([
    supabase.from("runtime_executions").update({ execution_context: { snapshot_id: snapshot.id, checksum }, prompt_version: prompt.version }).eq("id", execution.id).eq("organization_id", execution.organization_id),
    supabase.from("runtime_progress_events").insert({ organization_id: execution.organization_id, execution_id: execution.id, event_type: "context.prepared", message: "Runtime context prepared." }),
  ]);

  return NextResponse.json({ snapshot, memory_count: memories.length, knowledge_count: knowledge.length, tool_count: tools.length, external_execution_enabled: false });
}
