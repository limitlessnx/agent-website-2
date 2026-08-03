import type { RuntimeExecution, RuntimePolicyDecision, RuntimeTool } from "./types";

const sensitiveTerms = ["refund", "discount", "delete", "contract"];

export function evaluateRuntimePolicy(input: {
  execution: RuntimeExecution;
  readiness: Record<string, unknown> | null;
  tools: RuntimeTool[];
}) {
  const decisions: RuntimePolicyDecision[] = [];
  const readinessScore = Number(input.readiness?.readiness_score ?? 0);

  decisions.push({
    key: "tenant_isolation",
    outcome: "allow",
    reason: "Execution, agent, conversation, memory, knowledge, and tools are loaded through organization-scoped queries.",
    details: { organization_id: input.execution.organization_id, agent_id: input.execution.agent_id },
  });

  decisions.push({
    key: "readiness_gate",
    outcome: readinessScore >= 100 ? "allow" : "limit",
    reason: readinessScore >= 100 ? "Agent readiness is complete." : "Agent is not fully ready; live external execution remains limited.",
    details: { readiness_score: readinessScore, blockers: input.readiness?.blockers || [] },
  });

  decisions.push({
    key: "provider_execution",
    outcome: "limit",
    reason: "Live AI provider execution is intentionally disabled in Phase 12.",
    details: { live_provider_execution_enabled: false },
  });

  decisions.push({
    key: "n8n_execution",
    outcome: "limit",
    reason: "n8n workflow execution is intentionally disabled in Phase 12.",
    details: { n8n_execution_enabled: false },
  });

  for (const tool of input.tools) {
    const sensitive = sensitiveTerms.some((term) => `${tool.key} ${tool.description}`.toLowerCase().includes(term));
    decisions.push({
      key: `tool.${tool.key}`,
      outcome: sensitive ? "approval_required" : "allow",
      reason: sensitive ? "Sensitive tool intent requires human approval before any execution." : "Tool is assigned to this agent and active.",
      details: { tool_id: tool.id, handler: tool.handler, required_permissions: tool.required_permissions },
    });
  }

  return {
    external_execution_enabled: false as const,
    live_provider_execution_enabled: false as const,
    n8n_execution_enabled: false as const,
    decisions,
    approval_required_for: sensitiveTerms,
  };
}
