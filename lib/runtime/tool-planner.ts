import type { PlannedToolCall, RuntimePolicyDecision, RuntimeTool } from "./types";

function toolMatchesInput(tool: RuntimeTool, inputText: string) {
  const haystack = `${tool.key} ${tool.name} ${tool.description}`.toLowerCase();
  if (!inputText.trim()) return tool.key === "handoff.request";
  return inputText
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 3)
    .some((term) => haystack.includes(term));
}

export function planToolIntents(input: {
  tools: RuntimeTool[];
  conversationInput: Record<string, unknown>;
  decisions: RuntimePolicyDecision[];
}): PlannedToolCall[] {
  const inputText = JSON.stringify(input.conversationInput || {});
  const decisionByTool = new Map(input.decisions.filter((decision) => decision.key.startsWith("tool.")).map((decision) => [decision.key.slice(5), decision]));

  return input.tools
    .filter((tool) => toolMatchesInput(tool, inputText))
    .slice(0, 5)
    .map((tool) => {
      const policy = decisionByTool.get(tool.key) || {
        key: `tool.${tool.key}`,
        outcome: "deny",
        reason: "No policy decision was available for this tool.",
        details: { tool_id: tool.id },
      } as RuntimePolicyDecision;
      return {
        tool_id: tool.id,
        tool_key: tool.key,
        status: policy.outcome === "deny" ? "denied" : "requested",
        input: { intent_only: true, source: "phase_12_tool_planner" },
        policy,
      };
    });
}
