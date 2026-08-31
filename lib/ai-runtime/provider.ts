import type { RuntimeContext, RuntimeModelRoute } from "@/lib/ai-runtime/types";

export type RuntimeReasoningResult = { reply: string; intent: string; confidence: number; needsHumanReview: boolean; toolCalls: Array<{ toolKey: string; arguments: Record<string, unknown>; reason: string }>; usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number } };
export type RuntimeStructuredOutput = {
  outputText: string;
  parsed: Record<string, unknown> | null;
  provider: string;
  modelKey: string;
  responseId?: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  latencyMs: number;
};
type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord { return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {}; }
function extractText(payload: UnknownRecord) {
  if (typeof payload.output_text === "string") return payload.output_text;
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    const row = record(item);
    for (const content of Array.isArray(row.content) ? row.content : []) {
      const part = record(content);
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}
function parseArguments(value: unknown) { try { const parsed = JSON.parse(String(value || "{}")); return record(parsed); } catch { return {}; } }
function usageFrom(payload: UnknownRecord) {
  const usage = record(payload.usage);
  return {
    inputTokens: typeof usage.input_tokens === "number" ? usage.input_tokens : undefined,
    outputTokens: typeof usage.output_tokens === "number" ? usage.output_tokens : undefined,
    totalTokens: typeof usage.total_tokens === "number" ? usage.total_tokens : undefined,
  };
}

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" }, intent: { type: "string" }, confidence: { type: "number", minimum: 0, maximum: 1 }, needsHumanReview: { type: "boolean" },
    toolCalls: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, properties: { toolKey: { type: "string" }, argumentsJson: { type: "string" }, reason: { type: "string" } }, required: ["toolKey", "argumentsJson", "reason"] } },
  },
  required: ["reply", "intent", "confidence", "needsHumanReview", "toolCalls"],
} as const;

export async function generateRuntimeStructuredOutput(input: {
  model: RuntimeModelRoute;
  systemPrompt: string;
  input: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  temperature?: number;
}): Promise<RuntimeStructuredOutput> {
  if (input.model.provider !== "openai") throw new Error(`Runtime provider ${input.model.provider} is not configured.`);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for the runtime engine.");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const outputSchema = input.outputSchema && Object.keys(input.outputSchema).length ? input.outputSchema : undefined;
    const systemPrompt = [
      String(input.systemPrompt || "").trim(),
      "The Fluxknight runtime model router selected this model. Do not change provider, model, permissions, or organization scope.",
      outputSchema ? "Return only JSON satisfying the supplied schema." : "Return the requested output without claiming tool execution.",
    ].filter(Boolean).join("\n\n").slice(0, 50000);
    const body: Record<string, unknown> = {
      model: input.model.modelKey,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(input.input).slice(0, 50000) }] },
      ],
    };
    if (outputSchema) {
      body.text = { format: { type: "json_schema", name: "fluxknight_phase12_structured_output", strict: true, schema: outputSchema } };
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const payload = record(await response.json().catch(() => ({})));
    if (!response.ok) {
      const message = String(record(payload.error).message || `Runtime model request failed with status ${response.status}.`);
      throw new Error(message);
    }
    const outputText = extractText(payload);
    let parsed: Record<string, unknown> | null = null;
    if (outputText.trim().startsWith("{") || outputText.trim().startsWith("[")) {
      try { const value = JSON.parse(outputText); parsed = record(value); } catch { parsed = null; }
    }
    return {
      outputText,
      parsed,
      provider: input.model.provider,
      modelKey: input.model.modelKey,
      responseId: typeof payload.id === "string" ? payload.id : undefined,
      usage: usageFrom(payload),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateRuntimeReasoning(context: RuntimeContext): Promise<RuntimeReasoningResult> {
  if (context.model.provider !== "openai") throw new Error(`Runtime provider ${context.model.provider} is not configured.`);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured for the runtime engine.");

  const allowedTools = context.tools.map((tool) => ({ key: tool.key, title: tool.title, description: tool.description, approval: tool.approval, readOnly: tool.readOnly }));
  const system = [
    context.systemPrompt,
    `RUNTIME AGENT: ${context.agentName}`,
    `RUNTIME ORGANIZATION: ${context.organizationId || "public/platform"}`,
    `ALLOWED TOOLS: ${JSON.stringify(allowedTools)}`,
    "The permission engine and approval ledger are authoritative. You may propose allowed tools, but you cannot approve or execute them yourself.",
    "Never claim execution success unless a later tool result proves it.",
    "Return only the requested structured response.",
  ].join("\n\n").slice(0, 50000);

  const history = context.memory.filter((item) => item.role === "user" || item.role === "assistant").slice(-20).map((item) => ({ role: item.role, content: [{ type: "input_text", text: item.content.slice(0, 4000) }] }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: context.model.modelKey, input: [{ role: "system", content: [{ type: "input_text", text: system }] }, ...history, { role: "user", content: [{ type: "input_text", text: context.objective }] }], text: { format: { type: "json_schema", name: "fluxknight_runtime_response", strict: true, schema } } }), signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`Runtime model request failed with status ${response.status}.`);
    const payload = record(await response.json());
    const parsed = record(JSON.parse(extractText(payload) || "{}"));
    if (typeof parsed.reply !== "string" || !parsed.reply.trim() || !Array.isArray(parsed.toolCalls)) throw new Error("Runtime model returned an invalid structured response.");
    const toolCalls = parsed.toolCalls.map((item) => record(item)).map((item) => ({ toolKey: String(item.toolKey || "").trim(), arguments: parseArguments(item.argumentsJson), reason: String(item.reason || "").trim().slice(0, 600) })).filter((item) => item.toolKey && item.reason).slice(0, 4);
    return { reply: parsed.reply.trim().slice(0, 8000), intent: String(parsed.intent || "general").trim().slice(0, 160), confidence: Math.max(0, Math.min(1, Number(parsed.confidence || 0))), needsHumanReview: parsed.needsHumanReview === true, toolCalls, usage: usageFrom(payload) };
  } finally { clearTimeout(timeout); }
}
