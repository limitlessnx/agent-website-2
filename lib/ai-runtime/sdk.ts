import { randomUUID } from "node:crypto";
import type { LeoIdentity } from "@/lib/leo-core";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";
import { buildRuntimeContext } from "@/lib/ai-runtime/context";
import { generateRuntimeReasoning } from "@/lib/ai-runtime/provider";
import { appendRuntimeMessage } from "@/lib/ai-runtime/memory";
import { resolveRuntimeSession, advanceRuntimeSession } from "@/lib/ai-runtime/session";
import { createRuntimeApproval, requireRuntimeApproval } from "@/lib/ai-runtime/approvals";
import { RuntimeToolRegistry, createRuntimeToolRegistry } from "@/lib/ai-runtime/tool-registry";
import type { RuntimeChannel, RuntimeToolExecutionResult } from "@/lib/ai-runtime/types";

export type RuntimeReasonInput = {
  identity: LeoIdentity;
  objective: string;
  organizationId?: string;
  agentId?: string;
  sessionId?: string;
  externalConversationId?: string;
  channel?: RuntimeChannel;
  overrideModelId?: string;
  pageContext?: unknown;
  metadata?: Record<string, unknown>;
};

export type RuntimeReasonOutput = {
  executionId: string;
  sessionId?: string;
  reply: string;
  intent: string;
  confidence: number;
  needsHumanReview: boolean;
  model: { provider: string; modelKey: string; source: string };
  toolCalls: Array<{ toolKey: string; arguments: Record<string, unknown>; reason: string; approval: string; approvalRequestId?: string }>;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
};

async function logToolRun(input: { organizationId?: string; agentId?: string; sessionId?: string; toolKey: string; args: Record<string, unknown>; output?: unknown; status: string; approvalRequired: boolean; startedAt: string; finishedAt: string }) {
  if (!input.organizationId || !input.agentId) return;
  await supabaseServerRequest("agent_runtime_tool_runs", { method: "POST", body: JSON.stringify({ organization_id: input.organizationId, agent_id: input.agentId, session_id: input.sessionId || null, tool_name: input.toolKey, input: input.args, output: input.output ?? {}, status: input.status, approval_required: input.approvalRequired, started_at: input.startedAt, finished_at: input.finishedAt }) }).catch(() => null);
}

export class AgentRuntimeSDK {
  constructor(readonly tools: RuntimeToolRegistry = createRuntimeToolRegistry()) {}

  async reason(input: RuntimeReasonInput): Promise<RuntimeReasonOutput> {
    const executionId = randomUUID();
    let sessionId = input.sessionId;
    const organizationId = input.identity.scope === "tenant" ? input.identity.organizationId : input.organizationId;

    if (input.agentId && organizationId && input.identity.scope !== "public") {
      const session = await resolveRuntimeSession({ identity: input.identity, organizationId, agentId: input.agentId, channel: input.channel || input.identity.channel, sessionId: input.sessionId, externalConversationId: input.externalConversationId, context: input.metadata });
      sessionId = session.id;
      await appendRuntimeMessage({ identity: input.identity, organizationId, agentId: input.agentId, sessionId, message: { role: "user", content: input.objective, metadata: { executionId } } });
    }

    const context = await buildRuntimeContext({ identity: input.identity, organizationId, agentId: input.agentId, sessionId, channel: input.channel, objective: input.objective, overrideModelId: input.overrideModelId, pageContext: input.pageContext, metadata: input.metadata });
    const reasoning = await generateRuntimeReasoning(context);
    const toolCalls: RuntimeReasonOutput["toolCalls"] = [];

    for (const proposed of reasoning.toolCalls) {
      const definition = this.tools.resolveAllowed(input.identity, proposed.toolKey);
      let approvalRequestId: string | undefined;
      if (definition.approval !== "none" && organizationId && input.agentId) {
        const approval = await createRuntimeApproval({ identity: input.identity, organizationId, executionId, actionKey: definition.key, payload: { agentId: input.agentId, sessionId: sessionId || null, arguments: proposed.arguments, reason: proposed.reason } });
        approvalRequestId = approval.id;
      }
      toolCalls.push({ toolKey: definition.key, arguments: proposed.arguments, reason: proposed.reason, approval: definition.approval, approvalRequestId });
    }

    if (input.agentId && organizationId && sessionId) {
      await appendRuntimeMessage({ identity: input.identity, organizationId, agentId: input.agentId, sessionId, message: { role: "assistant", content: reasoning.reply, metadata: { executionId, intent: reasoning.intent, confidence: reasoning.confidence, model: context.model, proposedTools: toolCalls.map((tool) => ({ toolKey: tool.toolKey, approval: tool.approval, approvalRequestId: tool.approvalRequestId || null })) } } });
      await advanceRuntimeSession({ identity: input.identity, organizationId, agentId: input.agentId, sessionId, stepCount: context.memory.length + 2, lastModelId: context.model.modelId });
    }

    return { executionId, sessionId, reply: reasoning.reply, intent: reasoning.intent, confidence: reasoning.confidence, needsHumanReview: reasoning.needsHumanReview, model: { provider: context.model.provider, modelKey: context.model.modelKey, source: context.model.source }, toolCalls, usage: reasoning.usage };
  }

  async executeTool(input: { identity: LeoIdentity; executionId: string; organizationId?: string; agentId?: string; sessionId?: string; toolKey: string; arguments: Record<string, unknown>; approvalRequestId?: string; superAdminConfirmed?: boolean }): Promise<RuntimeToolExecutionResult> {
    const definition = this.tools.resolveAllowed(input.identity, input.toolKey);
    const organizationId = input.identity.scope === "tenant" ? input.identity.organizationId : input.organizationId;
    if (input.identity.scope === "tenant" && organizationId !== input.identity.organizationId) return { toolKey: definition.key, status: "rejected", error: "Cross-organization execution is forbidden." };

    if (definition.approval !== "none") {
      if (input.identity.scope === "super_admin" && input.superAdminConfirmed === true) {
        // Explicit authenticated confirmation is sufficient for platform-level Super Leo actions.
      } else if (organizationId) {
        const approval = await requireRuntimeApproval({ identity: input.identity, organizationId, approvalRequestId: input.approvalRequestId, executionId: input.executionId, actionKey: definition.key });
        if (!approval.approved) return { toolKey: definition.key, status: "approval_required", error: `Approval status: ${approval.reason}.`, approvalRequestId: input.approvalRequestId };
      } else {
        return { toolKey: definition.key, status: "approval_required", error: "Explicit approval evidence is required." };
      }
    }

    const startedAt = new Date().toISOString();
    try {
      const output = await this.tools.execute({ identity: input.identity, toolKey: definition.key, arguments: input.arguments, organizationId, agentId: input.agentId, executionId: input.executionId });
      const finishedAt = new Date().toISOString();
      await logToolRun({ organizationId, agentId: input.agentId, sessionId: input.sessionId, toolKey: definition.key, args: input.arguments, output, status: "completed", approvalRequired: definition.approval !== "none", startedAt, finishedAt });
      return { toolKey: definition.key, status: "succeeded", output };
    } catch (error) {
      const finishedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Runtime tool execution failed.";
      await logToolRun({ organizationId, agentId: input.agentId, sessionId: input.sessionId, toolKey: definition.key, args: input.arguments, output: { error: message }, status: "failed", approvalRequired: definition.approval !== "none", startedAt, finishedAt });
      return { toolKey: definition.key, status: /forbidden|approval|permission|registered/i.test(message) ? "rejected" : "failed", error: message };
    }
  }
}
