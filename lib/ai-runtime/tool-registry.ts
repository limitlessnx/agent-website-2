import { LEO_TOOLS, assertLeoToolAllowed, listLeoToolsForIdentity, type LeoIdentity, type LeoToolDefinition } from "@/lib/leo-core";

export type RuntimeToolExecutor = (input: Record<string, unknown>, context: { identity: LeoIdentity; organizationId?: string; agentId?: string; executionId: string }) => Promise<unknown>;

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
    const canonical = new Set(listLeoToolsForIdentity(identity).map((tool) => tool.key));
    return [...this.definitions.values()].filter((tool) => canonical.has(tool.key));
  }

  resolveAllowed(identity: LeoIdentity, toolKey: string) {
    const allowed = assertLeoToolAllowed(identity, toolKey);
    const definition = this.definitions.get(allowed.key);
    if (!definition) throw new Error(`Runtime tool is not registered: ${allowed.key}.`);
    return definition;
  }

  hasExecutor(toolKey: string) {
    return this.executors.has(toolKey);
  }

  async execute(input: { identity: LeoIdentity; toolKey: string; arguments: Record<string, unknown>; organizationId?: string; agentId?: string; executionId: string }) {
    const definition = this.resolveAllowed(input.identity, input.toolKey);
    const executor = this.executors.get(definition.key);
    if (!executor) throw new Error(`No runtime executor registered for ${definition.key}.`);
    return executor(input.arguments, { identity: input.identity, organizationId: input.organizationId, agentId: input.agentId, executionId: input.executionId });
  }
}

export function createRuntimeToolRegistry() {
  return new RuntimeToolRegistry();
}
