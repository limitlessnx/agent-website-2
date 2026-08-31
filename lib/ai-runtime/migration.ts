import type { LeoIdentity } from "@/lib/leo-core";
import { AgentRuntimeSDK, type RuntimeReasonOutput } from "@/lib/ai-runtime/sdk";
import { routeRuntimeModel } from "@/lib/ai-runtime/model-router";
import { generateRuntimeStructuredOutput, type RuntimeStructuredOutput } from "@/lib/ai-runtime/provider";
import type { RuntimeChannel } from "@/lib/ai-runtime/types";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

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

type AgentLookupRow = { id: string; name: string; status: string };

const KIND_HINTS: Record<Phase12AgentKind, string[]> = {
  leo: ["leo"],
  maia: ["maia"],
  sales: ["sales", "qualification"],
  support: ["support", "customer"],
  voice: ["voice", "reception"],
  specialist: [],
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

export async function resolvePhase12AgentId(input: {
  organizationId: string;
  kind: Phase12AgentKind;
  preferredAgentId?: string;
}) {
  const organizationId = String(input.organizationId || "").trim();
  if (!organizationId) throw new Error("Phase 12 agent resolution requires an organization ID.");
  if (input.preferredAgentId?.trim()) {
    const rows = await supabaseServerRequest<AgentLookupRow[]>(
      `agents?select=id,name,status&id=eq.${encodeURIComponent(input.preferredAgentId.trim())}&organization_id=eq.${encodeURIComponent(organizationId)}&limit=1`,
    ).catch(() => []);
    if (rows[0] && rows[0].status !== "deleted") return rows[0].id;
    throw new Error("Requested Phase 12 agent does not belong to this organization.");
  }

  const rows = await supabaseServerRequest<AgentLookupRow[]>(
    `agents?select=id,name,status&organization_id=eq.${encodeURIComponent(organizationId)}&status=neq.deleted&order=created_at.asc&limit=100`,
  ).catch(() => []);
  const hints = KIND_HINTS[input.kind];
  const matched = hints.length
    ? rows.find((row) => hints.some((hint) => String(row.name || "").toLowerCase().includes(hint)))
    : rows[0];
  if (!matched) throw new Error(`No active ${input.kind} agent is configured in this organization.`);
  return matched.id;
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
