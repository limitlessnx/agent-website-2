import type { LeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK, type RuntimeReasonOutput } from "@/lib/ai-runtime/sdk";
import { routeRuntimeModel } from "@/lib/ai-runtime/model-router";
import { generateRuntimeStructuredOutput, type RuntimeStructuredOutput } from "@/lib/ai-runtime/provider";
import type { RuntimeChannel } from "@/lib/ai-runtime/types";

export const PHASE12_AGENT_KINDS = [
  "leo",
  "maia",
  "sales",
  "support",
  "voice",
  "specialist",
] as const;

export type Phase12AgentKind = (typeof PHASE12_AGENT_KINDS)[number];

export type Phase12AgentDescriptor = {
  kind: Phase12AgentKind;
  agentId: string;
  organizationId: string;
  channel: RuntimeChannel;
  externalConversationId?: string;
};

export function internalRuntimeIdentity(organizationId: string, channel: RuntimeChannel = "api"): LeoIdentity {
  const normalized = String(organizationId || "").trim();
  if (!normalized) throw new Error("Internal runtime identity requires an organization ID.");
  return {
    scope: "internal_service",
    role: "service",
    organizationId: normalized,
    channel,
    globalScope: false,
  };
}

export function assertPhase12AgentBoundary(input: Phase12AgentDescriptor) {
  if (!PHASE12_AGENT_KINDS.includes(input.kind)) throw new Error("Unsupported Phase 12 agent kind.");
  if (!input.organizationId?.trim() || !input.agentId?.trim()) throw new Error("Phase 12 agents require exact organization and agent IDs.");
  return {
    ...input,
    organizationId: input.organizationId.trim(),
    agentId: input.agentId.trim(),
  };
}

export async function runPhase12Agent(input: Phase12AgentDescriptor & {
  objective: string;
  sessionId?: string;
  pageContext?: unknown;
  metadata?: Record<string, unknown>;
  identity?: LeoIdentity;
  sdk?: AgentRuntimeSDK;
}): Promise<RuntimeReasonOutput> {
  const descriptor = assertPhase12AgentBoundary(input);
  const identity = input.identity || internalRuntimeIdentity(descriptor.organizationId, descriptor.channel);
  if (identity.scope === "tenant" && identity.organizationId !== descriptor.organizationId) {
    throw new Error("Cross-organization Phase 12 agent execution is forbidden.");
  }
  if (identity.scope === "internal_service" && identity.organizationId !== descriptor.organizationId) {
    throw new Error("Internal service identity must remain pinned to the exact organization.");
  }
  const sdk = input.sdk || new AgentRuntimeSDK();
  return sdk.reason({
    identity,
    objective: String(input.objective || "").trim(),
    organizationId: descriptor.organizationId,
    agentId: descriptor.agentId,
    sessionId: input.sessionId,
    externalConversationId: descriptor.externalConversationId,
    channel: descriptor.channel,
    pageContext: input.pageContext,
    metadata: {
      ...(input.metadata || {}),
      phase: 12,
      migratedAgentKind: descriptor.kind,
    },
  });
}

export async function runPhase12StructuredAgent(input: Phase12AgentDescriptor & {
  systemPrompt: string;
  input: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  temperature?: number;
  identity?: LeoIdentity;
}): Promise<RuntimeStructuredOutput & { modelSource: string }> {
  const descriptor = assertPhase12AgentBoundary(input);
  const identity = input.identity || internalRuntimeIdentity(descriptor.organizationId, descriptor.channel);
  if (identity.organizationId !== descriptor.organizationId) throw new Error("Cross-organization structured runtime execution is forbidden.");
  const model = await routeRuntimeModel({ identity, organizationId: descriptor.organizationId, agentId: descriptor.agentId });
  const result = await generateRuntimeStructuredOutput({
    model,
    systemPrompt: input.systemPrompt,
    input: input.input,
    outputSchema: input.outputSchema,
    temperature: input.temperature,
  });
  return { ...result, modelSource: model.source };
}
