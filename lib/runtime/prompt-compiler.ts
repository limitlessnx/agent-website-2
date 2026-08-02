import type { RuntimeKnowledge, RuntimeMemory, RuntimePrompt, RuntimeTool } from "./types";

function section(title: string, body: string) {
  return body.trim() ? `\n\n## ${title}\n${body.trim()}` : "";
}

export function compileRuntimePrompt(input: {
  prompt: RuntimePrompt;
  memories: RuntimeMemory[];
  knowledge: RuntimeKnowledge[];
  tools: RuntimeTool[];
  conversationInput: Record<string, unknown>;
}) {
  const memoryText = input.memories
    .map((memory) => `- ${memory.type}.${memory.key}: ${JSON.stringify(memory.value)} (confidence ${memory.confidence ?? "unknown"})`)
    .join("\n");

  const knowledgeText = input.knowledge
    .map((item, index) => `[${index + 1}] ${item.title} (${item.type})\n${item.content}`)
    .join("\n\n");

  const toolText = input.tools
    .map((tool) => `- ${tool.key}: ${tool.description}`)
    .join("\n");

  const currentInput = JSON.stringify(input.conversationInput || {}, null, 2);

  return [
    input.prompt.assembled_prompt.trim(),
    section("Tenant Customer Memory", memoryText),
    section("Tenant Knowledge Results", knowledgeText),
    section("Available Approved Tools", toolText),
    section("Runtime Safety Rules", [
      "Stay inside this organization, agent, conversation, memory, knowledge, and tool context.",
      "Do not claim that external providers, n8n workflows, messages, bookings, or CRM updates have been executed.",
      "Return structured tool intent only; execution is disabled until a later phase explicitly enables it.",
    ].join("\n")),
    section("Current Execution Input", currentInput),
  ].join("");
}
