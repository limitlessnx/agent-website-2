import { LEO_TOOLS, assertLeoToolAllowed, listLeoToolsForIdentity, resolveLeoTool, type LeoApprovalMode, type LeoIdentity, type LeoToolDefinition } from "@/lib/leo-core";

export type RuntimeExecutionAuthorization = {
  approved: boolean;
  approvalMode: LeoApprovalMode;
  approvalRequestId?: string;
  approvedBy?: string;
  approvedAt?: string;
  source: "runtime-sdk";
};

export type RuntimeToolExecutorContext = {
  identity: LeoIdentity;
  organizationId?: string;
  agentId?: string;
  executionId: string;
  toolKey: string;
  authorization: RuntimeExecutionAuthorization;
};

export type RuntimeToolExecutor = (input: Record<string, unknown>, context: RuntimeToolExecutorContext) => Promise<unknown>;

export class RuntimeToolRegistry {
  private readonly definitions = new Map<string, LeoToolDefinition>();
  private readonly executors = new Map<string, RuntimeToolExecutor>();

  constructor(seed: LeoToolDefinition[] = LEO_TOOLS) {
    for (const definition of seed) this.definitions.set(definition.key, definition);
  }

  registerDefinition(definition: LeoToolDefinition) {
    if (!definition.key?.trim()) throw new Error("Tool definition key is required.");
    if (this.definitions.has(definition.key)) throw new Error(`Tool definition already registered: ${definition.key}.`);
    this.definitions.set(definition.key, definition);
    return this;
  }

  registerExecutor(toolKey: string, executor: RuntimeToolExecutor) {
    const definition = this.definitions.get(toolKey);
    if (!definition) throw new Error(`Cannot register executor for unknown tool ${toolKey}.`);
    if (this.executors.has(toolKey)) throw new Error(`Tool executor already registered: ${toolKey}.`);
    this.executors.set(toolKey, executor);
    return this;
  }

  listAllowed(identity: LeoIdentity) {
    if (identity.scope === "internal_service") {
      if (!identity.organizationId) return [];
      return [...this.definitions.values()].filter((tool) => tool.scopes.includes("tenant"));
    }
    const canonical = new Set(listLeoToolsForIdentity(identity).map((tool) => tool.key));
    return [...this.definitions.values()].filter((tool) => canonical.has(tool.key));
  }

  resolveAllowed(identity: LeoIdentity, toolKey: string) {
    if (identity.scope === "internal_service") {
      if (!identity.organizationId) throw new Error("Internal service tool access requires an exact organization ID.");
      const resolved = resolveLeoTool(toolKey);
      if (!resolved || !resolved.scopes.includes("tenant")) throw new Error(`Runtime tool ${toolKey} is not permitted for an internal tenant service.`);
      const definition = this.definitions.get(resolved.key);
      if (!definition) throw new Error(`Runtime tool is not registered: ${resolved.key}.`);
      return definition;
    }
    const allowed = assertLeoToolAllowed(identity, toolKey);
    const definition = this.definitions.get(allowed.key);
    if (!definition) throw new Error(`Runtime tool is not registered: ${allowed.key}.`);
    return definition;
  }

  hasExecutor(toolKey: string) {
    return this.executors.has(toolKey);
  }

  async execute(input: {
    identity: LeoIdentity;
    toolKey: string;
    arguments: Record<string, unknown>;
    organizationId?: string;
    agentId?: string;
    executionId: string;
    authorization: RuntimeExecutionAuthorization;
  }) {
    const definition = this.resolveAllowed(input.identity, input.toolKey);
    if (input.authorization.source !== "runtime-sdk") throw new Error("Runtime executor authorization source is invalid.");
    if (input.authorization.approvalMode !== definition.approval) throw new Error("Runtime executor approval mode does not match tool policy.");
    if (definition.approval !== "none" && !input.authorization.approved) throw new Error(`Approved runtime authorization is required for ${definition.key}.`);
    const executor = this.executors.get(definition.key);
    if (!executor) throw new Error(`No runtime executor registered for ${definition.key}.`);
    return executor(input.arguments, {
      identity: input.identity,
      organizationId: input.organizationId,
      agentId: input.agentId,
      executionId: input.executionId,
      toolKey: definition.key,
      authorization: input.authorization,
    });
  }
}

export function createRuntimeToolRegistry() {
  return new RuntimeToolRegistry();
}
