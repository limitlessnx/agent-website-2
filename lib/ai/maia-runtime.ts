import { createAdminClient } from "@/lib/supabase/admin";
import { maiaPropertyTools } from "@/lib/ai/maia-property-tools";

export type MaiaRuntimeInput = {
  organizationId: string;
  agentId: string;
  message: string;
  sessionId?: string;
  channel?: string;
  externalConversationId?: string;
  autonomous?: boolean;
};

type Model = { id: string; provider: string; model_key: string; display_name: string; capabilities: Record<string, unknown> };
type RuntimeProfile = { enabled: boolean; autonomy_mode: "supervised" | "autonomous"; max_steps: number; model_strategy: "best_available" | "fastest" | "reasoning" | "balanced"; memory_enabled: boolean; tool_policy: Record<string, unknown> };
type ToolContext = { organizationId: string; agentId: string; sessionId: string };
type ToolDefinition = { name: string; description: string; parameters: Record<string, unknown>; execute: (input: Record<string, unknown>, ctx: ToolContext) => Promise<unknown> };

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const json = (value: unknown) => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function configuredProvider(provider: string) {
  const key = provider.toLowerCase();
  if (key === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (key === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (key === "google" || key === "gemini") return Boolean(process.env.GOOGLE_API_KEY?.trim());
  return false;
}

async function loadModels(organizationId: string) {
  const admin = createAdminClient();
  const { data: assignments } = await admin.from("organization_ai_model_assignments").select("model_id,settings").eq("organization_id", organizationId);
  const ids = (assignments || []).map((row) => row.model_id).filter(Boolean);
  if (!ids.length) return [] as Model[];
  const { data } = await admin.from("ai_model_catalog").select("id,provider,model_key,display_name,capabilities").in("id", ids).eq("status", "active");
  return (data || []) as Model[];
}

function scoreModel(model: Model, strategy: RuntimeProfile["model_strategy"], message: string) {
  const caps = json(model.capabilities);
  const capabilityText = JSON.stringify(caps).toLowerCase();
  let score = 0;
  if (model.provider === "openai" && configuredProvider(model.provider)) score += 50;
  if (capabilityText.includes("tool")) score += 20;
  if (capabilityText.includes("reason")) score += strategy === "reasoning" ? 35 : 10;
  if (capabilityText.includes("vision") && /image|photo|pdf|document|screenshot/i.test(message)) score += 30;
  if (strategy === "fastest" && /mini|flash|haiku/i.test(model.model_key)) score += 25;
  if (strategy === "balanced") score += /mini|flash/i.test(model.model_key) ? 10 : 5;
  if (strategy === "best_available") score += 10;
  return score;
}

async function chooseModel(organizationId: string, profile: RuntimeProfile, message: string) {
  const assigned = await loadModels(organizationId);
  const usable = assigned.filter((model) => configuredProvider(model.provider));
  if (usable.length) return usable.sort((a, b) => scoreModel(b, profile.model_strategy, message) - scoreModel(a, profile.model_strategy, message))[0];
  const fallbackKey = process.env.MAIA_DEFAULT_MODEL?.trim() || process.env.SUPPORT_AI_MODEL?.trim();
  if (process.env.OPENAI_API_KEY?.trim() && fallbackKey) return { id: "fallback", provider: "openai", model_key: fallbackKey, display_name: fallbackKey, capabilities: { text: true, tools: true } } as Model;
  return null;
}

async function loadAgent(organizationId: string, agentId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("agents").select("id,organization_id,name,slug,description,system_prompt,agent_type,configuration,communication_channels,status").eq("id", agentId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Agent is not assigned to this organization.");
  return data;
}

async function loadProfile(organizationId: string, agentId: string): Promise<RuntimeProfile> {
  const admin = createAdminClient();
  const { data } = await admin.from("agent_runtime_profiles").select("enabled,autonomy_mode,max_steps,model_strategy,memory_enabled,tool_policy").eq("organization_id", organizationId).eq("agent_id", agentId).maybeSingle();
  return (data || { enabled: true, autonomy_mode: "autonomous", max_steps: 8, model_strategy: "best_available", memory_enabled: true, tool_policy: {} }) as RuntimeProfile;
}

async function loadBusinessContext(organizationId: string) {
  const admin = createAdminClient();
  const [profile, submission, knowledge] = await Promise.all([
    admin.from("client_onboarding_profiles").select("business_name,business_email,industry,website,country,timezone,phone,human_contact_name,human_contact_email").eq("organization_id", organizationId).maybeSingle(),
    admin.from("client_onboarding_submissions").select("business_information,business_services,communication_details,automation_requirements,business_resources").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("knowledge_sources").select("title,source_type,content,metadata").eq("organization_id", organizationId).eq("status", "active").order("updated_at", { ascending: false }).limit(20),
  ]);
  return { profile: profile.data || {}, onboarding: submission.data || {}, approvedKnowledge: knowledge.data || [] };
}

async function createSession(input: MaiaRuntimeInput) {
  const admin = createAdminClient();
  if (input.sessionId) {
    const { data } = await admin.from("agent_runtime_sessions").select("id,organization_id,agent_id,channel,step_count,status").eq("id", input.sessionId).eq("organization_id", input.organizationId).eq("agent_id", input.agentId).maybeSingle();
    if (data) return data;
  }
  const { data, error } = await admin.from("agent_runtime_sessions").insert({ organization_id: input.organizationId, agent_id: input.agentId, channel: input.channel || "web", external_conversation_id: input.externalConversationId || null }).select("id,organization_id,agent_id,channel,step_count,status").single();
  if (error) throw error;
  return data;
}

async function saveMessage(ctx: ToolContext, role: string, content: string | null, metadata: Record<string, unknown> = {}, toolName?: string, toolCallId?: string) {
  const admin = createAdminClient();
  await admin.from("agent_runtime_messages").insert({ organization_id: ctx.organizationId, agent_id: ctx.agentId, session_id: ctx.sessionId, role, content, tool_name: toolName || null, tool_call_id: toolCallId || null, metadata });
}

async function logTool(ctx: ToolContext, toolName: string, input: Record<string, unknown>, output: unknown, status = "completed", approvalRequired = false) {
  const admin = createAdminClient();
  await admin.from("agent_runtime_tool_runs").insert({ organization_id: ctx.organizationId, agent_id: ctx.agentId, session_id: ctx.sessionId, tool_name: toolName, input, output: json(output), status, approval_required: approvalRequired, finished_at: new Date().toISOString() });
}

function toolSet(): ToolDefinition[] {
  return [
    ...maiaPropertyTools(),
    { name: "get_business_context", description: "Read the current tenant's approved business profile, onboarding submission and approved knowledge sources.", parameters: { type: "object", additionalProperties: false, properties: {} }, execute: async (_input, ctx) => loadBusinessContext(ctx.organizationId) },
    {
      name: "search_knowledge",
      description: "Search only this tenant's approved knowledge base for facts, services, policies, property information or documentation guidance.",
      parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" } }, required: ["query"] },
      execute: async (input, ctx) => {
        const query = text(input.query).slice(0, 160);
        if (!query) return { results: [] };
        const admin = createAdminClient();
        const needle = query.replace(/[%_]/g, "");
        const { data } = await admin.from("knowledge_sources").select("id,title,source_type,content,metadata").eq("organization_id", ctx.organizationId).eq("status", "active").or(`title.ilike.%${needle}%,content.ilike.%${needle}%`).limit(8);
        return { results: data || [] };
      },
    },
    {
      name: "get_available_agents",
      description: "List other agents actually assigned to this tenant so Maia can hand work to the correct specialist.",
      parameters: { type: "object", additionalProperties: false, properties: {} },
      execute: async (_input, ctx) => {
        const admin = createAdminClient();
        const { data: selections } = await admin.from("organization_agent_selections").select("agent_key,display_name,status,configuration").eq("organization_id", ctx.organizationId);
        const ids = (selections || []).map((row) => json(row.configuration).provisioned_agent_id).filter(Boolean);
        const { data: agents } = ids.length ? await admin.from("agents").select("id,name,slug,agent_type,status,communication_channels").eq("organization_id", ctx.organizationId).in("id", ids as string[]) : { data: [] };
        return { agents: agents || [] };
      },
    },
    {
      name: "search_leads",
      description: "Search this tenant's CRM leads by name, stage, email, phone or summary.",
      parameters: { type: "object", additionalProperties: false, properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 20 } }, required: ["query"] },
      execute: async (input, ctx) => {
        const query = text(input.query).slice(0, 120).replace(/[%_]/g, "");
        const admin = createAdminClient();
        const limit = Math.min(Number(input.limit || 10), 20);
        const { data } = await admin.from("crm_leads").select("id,customer_id,assigned_agent_id,source,stage,score,value_estimate,currency,summary,details,created_at,updated_at").eq("organization_id", ctx.organizationId).or(`summary.ilike.%${query}%,stage.ilike.%${query}%,source.ilike.%${query}%`).order("updated_at", { ascending: false }).limit(limit);
        return { leads: data || [] };
      },
    },
    {
      name: "create_followup_task",
      description: "Create a tenant CRM follow-up task. This is a low-risk autonomous action and never crosses tenant boundaries.",
      parameters: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, description: { type: "string" }, dueAt: { type: "string" }, leadId: { type: "string" } }, required: ["title"] },
      execute: async (input, ctx) => {
        const admin = createAdminClient();
        const { data, error } = await admin.from("crm_tasks").insert({ organization_id: ctx.organizationId, lead_id: text(input.leadId) || null, assigned_agent_id: ctx.agentId, task_type: "ai_follow_up", title: text(input.title).slice(0, 180), description: text(input.description).slice(0, 1000) || null, due_at: text(input.dueAt) || null, metadata: { source: "maia_agentic_runtime" } }).select("id,title,status,due_at").single();
        if (error) throw error;
        return data;
      },
    },
    {
      name: "upsert_lead",
      description: "Create or update a CRM lead for a person who has expressed business interest. Use only information actually supplied in the conversation or tenant knowledge.",
      parameters: { type: "object", additionalProperties: false, properties: { name: { type: "string" }, email: { type: "string" }, phone: { type: "string" }, summary: { type: "string" }, details: { type: "object" }, stage: { type: "string" }, score: { type: "string" }, valueEstimate: { type: "number" }, currency: { type: "string" } }, required: ["name"] },
      execute: async (input, ctx) => {
        const admin = createAdminClient();
        const name = text(input.name).slice(0, 160);
        const email = text(input.email).slice(0, 200) || null;
        const phone = text(input.phone).slice(0, 80) || null;
        let customer: any = null;
        if (email || phone) {
          let query = admin.from("crm_customers").select("id,full_name,email,phone").eq("organization_id", ctx.organizationId).limit(1);
          if (email) query = query.eq("email", email); else if (phone) query = query.eq("phone", phone);
          const result = await query.maybeSingle();
          customer = result.data;
        }
        if (!customer) {
          const result = await admin.from("crm_customers").insert({ organization_id: ctx.organizationId, full_name: name, email, phone, metadata: { source: "maia_agentic_runtime" } }).select("id,full_name,email,phone").single();
          customer = result.data;
        }
        const existing = await admin.from("crm_leads").select("id").eq("organization_id", ctx.organizationId).eq("customer_id", customer.id).maybeSingle();
        const payload = { organization_id: ctx.organizationId, customer_id: customer.id, assigned_agent_id: ctx.agentId, summary: text(input.summary).slice(0, 500) || null, details: json(input.details), stage: text(input.stage) || "new", score: text(input.score) || null, value_estimate: typeof input.valueEstimate === "number" ? input.valueEstimate : null, currency: text(input.currency) || "NGN", updated_at: new Date().toISOString() };
        const result = existing.data ? await admin.from("crm_leads").update(payload).eq("id", existing.data.id).eq("organization_id", ctx.organizationId).select("id,stage,summary,updated_at").single() : await admin.from("crm_leads").insert(payload).select("id,stage,summary,updated_at").single();
        if (result.error) throw result.error;
        return { customer, lead: result.data };
      },
    },
    {
      name: "handoff_to_agent",
      description: "Queue a task for another agent assigned to this tenant. Use only when the other agent is actually assigned.",
      parameters: { type: "object", additionalProperties: false, properties: { targetAgentId: { type: "string" }, title: { type: "string" }, instructions: { type: "string" } }, required: ["targetAgentId", "title", "instructions"] },
      execute: async (input, ctx) => {
        const target = text(input.targetAgentId);
        const admin = createAdminClient();
        const { data: targetAgent } = await admin.from("agents").select("id,name,agent_type").eq("id", target).eq("organization_id", ctx.organizationId).maybeSingle();
        if (!targetAgent) throw new Error("Target agent is not assigned to this organization.");
        const { data, error } = await admin.from("agent_runtime_goals").insert({ organization_id: ctx.organizationId, agent_id: target, title: text(input.title).slice(0, 180), goal_type: "handoff", priority: 70, status: "queued", input: { instructions: text(input.instructions).slice(0, 3000), source_agent_id: ctx.agentId, source_session_id: ctx.sessionId } }).select("id,title,status,agent_id").single();
        if (error) throw error;
        return { queued: true, targetAgent, goal: data };
      },
    },
  ];
}

const toolSchemas = (tools: ToolDefinition[]) => tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
function modelMessages(systemPrompt: string, history: Array<{ role: string; content: string }>, message: string) { return [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: message }]; }

async function callOpenAI(model: Model, messages: any[], tools: ToolDefinition[]) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: model.model_key, temperature: 0.2, messages, tools: toolSchemas(tools), tool_choice: "auto" }), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`OpenAI request failed (${response.status}).`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

function safeToolPolicy(profile: RuntimeProfile, toolName: string) {
  const policy = json(profile.tool_policy);
  const denied = Array.isArray(policy.denied_tools) ? policy.denied_tools.map(String) : [];
  const allowed = Array.isArray(policy.allowed_tools) ? policy.allowed_tools.map(String) : null;
  if (denied.includes(toolName)) return false;
  if (allowed && !allowed.includes(toolName)) return false;
  return true;
}

export async function runMaia(input: MaiaRuntimeInput) {
  const startedAt = Date.now();
  const agent = await loadAgent(input.organizationId, input.agentId);
  const profile = await loadProfile(input.organizationId, input.agentId);
  if (!profile.enabled) throw new Error("This agent's autonomous runtime is disabled.");
  const session = await createSession(input);
  const ctx: ToolContext = { organizationId: input.organizationId, agentId: input.agentId, sessionId: session.id };
  const model = await chooseModel(input.organizationId, profile, input.message);
  if (!model) throw new Error("No usable AI model is assigned to this organization and no platform fallback model is configured.");
  const business = await loadBusinessContext(input.organizationId);
  const admin = createAdminClient();
  const { data: historyRows } = profile.memory_enabled ? await admin.from("agent_runtime_messages").select("role,content,tool_name,tool_call_id,metadata").eq("session_id", session.id).order("created_at", { ascending: false }).limit(16) : { data: [] };
  const history = (historyRows || []).reverse().filter((row) => ["user", "assistant", "tool"].includes(row.role)).map((row) => ({ role: row.role, content: row.content || "", ...(row.tool_name ? { name: row.tool_name } : {}), ...(row.tool_call_id ? { tool_call_id: row.tool_call_id } : {}) }));
  const tools = toolSet().filter((tool) => safeToolPolicy(profile, tool.name));
  const systemPrompt = [
    `You are ${agent.name}, an agentic AI operating for one organization only.`,
    agent.system_prompt || "Follow the organization's approved business context and act as a helpful professional agent.",
    "You are not a passive chatbot. Understand the goal, inspect approved tenant data when needed, choose the right tool, take low-risk actions, and continue until the task is complete or requires a human.",
    "Never access, infer, or expose another organization's data. Never invent prices, availability, legal status, land documentation facts, policies, credentials or integrations. For land/property documentation questions, use approved tenant knowledge and clearly distinguish education from legal advice.",
    "For named property questions, use search_properties before relying on memory. For property pictures, videos, brochures or documents, resolve one exact property ID first and then use get_property_media. Never guess a property match or attach media from a different property.",
    "Use tools when a tool can verify a fact or perform a useful low-risk action. Do not call tools merely to appear autonomous.",
    "When a request requires approval, sensitive production change, payment, credential change, or a commitment you cannot verify, explain the limitation and create a handoff/task when appropriate.",
    `Autonomy mode: ${profile.autonomy_mode}. Maximum reasoning/tool steps: ${profile.max_steps}.`,
    `CURRENT TENANT CONTEXT:\n${JSON.stringify(business).slice(0, 30000)}`,
  ].join("\n\n");

  await saveMessage(ctx, "user", input.message, { channel: input.channel || "web" });
  let messages: any[] = modelMessages(systemPrompt, history, input.message);
  let finalText = "";
  let steps = 0;
  const toolResults: Array<Record<string, unknown>> = [];
  while (steps < Math.max(1, Math.min(profile.max_steps, 20))) {
    steps += 1;
    const payload = await callOpenAI(model, messages, tools);
    const choice = payload?.choices?.[0];
    const assistant = choice?.message;
    if (!assistant) throw new Error("AI model returned no message.");
    messages.push(assistant);
    const calls = Array.isArray(assistant.tool_calls) ? assistant.tool_calls : [];
    if (!calls.length) { finalText = text(assistant.content) || "I could not produce a useful response from the available tenant context."; break; }
    for (const call of calls) {
      const name = text(call?.function?.name);
      const tool = tools.find((item) => item.name === name);
      let args: Record<string, unknown> = {};
      try { args = call?.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
      if (!tool) { messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify({ error: "Tool is not available to this agent." }) }); continue; }
      try {
        const output = await tool.execute(args, ctx);
        toolResults.push({ tool: name, ok: true });
        await logTool(ctx, name, args, output);
        messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(output).slice(0, 12000) });
      } catch (error) {
        const output = { error: error instanceof Error ? error.message : "Tool execution failed." };
        toolResults.push({ tool: name, ok: false });
        await logTool(ctx, name, args, output, "failed");
        messages.push({ role: "tool", tool_call_id: call.id, name, content: JSON.stringify(output) });
      }
    }
  }
  if (!finalText) finalText = "I reached the configured action limit before completing the task. I have preserved the work already completed and can hand the remaining step to a human or another assigned agent.";
  await saveMessage(ctx, "assistant", finalText, { modelId: model.id, model: model.model_key, provider: model.provider, steps, toolResults, latencyMs: Date.now() - startedAt });
  await admin.from("agent_runtime_sessions").update({ last_model_id: model.id === "fallback" ? null : model.id, step_count: steps, updated_at: new Date().toISOString() }).eq("id", session.id).eq("organization_id", input.organizationId);
  return { reply: finalText, sessionId: session.id, agent: { id: agent.id, name: agent.name }, model: { id: model.id, provider: model.provider, model: model.model_key }, steps, toolResults, autonomous: input.autonomous ?? profile.autonomy_mode === "autonomous" };
}
