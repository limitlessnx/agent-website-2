import type { LeoIdentity } from "@/lib/leo-core";
import type { LeoRuntimeConfiguration } from "@/lib/leo-runtime-config";

export type LeoExecutionRisk = "read_only" | "consequential";
export type LeoExecutionStatus = "succeeded" | "failed" | "rejected";

export type LeoExecutionRequest<TInput = unknown> = {
  executionId: string;
  organizationId?: string;
  agentRole: string;
  action: string;
  risk: LeoExecutionRisk;
  input: TInput;
  approval?: { approved: boolean; approvedBy?: string; approvedAt?: string };
  idempotencyKey?: string;
};

export type LeoExecutionResult<TOutput = unknown> = {
  executionId: string;
  status: LeoExecutionStatus;
  action: string;
  output?: TOutput;
  error?: string;
  startedAt: string;
  completedAt: string;
};

export type LeoKnowledgeItem = {
  id: string;
  text: string;
  source: string;
  score?: number;
};

export type LeoExecutionContext = {
  identity: LeoIdentity;
  config: LeoRuntimeConfiguration;
  knowledge: LeoKnowledgeItem[];
};

export type LeoExecutionHandler<TInput = unknown, TOutput = unknown> = (
  request: LeoExecutionRequest<TInput>,
  context: LeoExecutionContext,
) => Promise<TOutput>;

export type LeoKnowledgeRetriever = (input: {
  organizationId?: string;
  query: string;
  limit: number;
}) => Promise<LeoKnowledgeItem[]>;

export type LeoExecutionEvent = {
  type: "execution.started" | "execution.succeeded" | "execution.failed" | "execution.rejected";
  executionId: string;
  organizationId?: string;
  action: string;
  at: string;
  detail?: Record<string, unknown>;
};

export type LeoExecutionEventListener = (event: LeoExecutionEvent) => void | Promise<void>;

export class LeoExecutionEventDispatcher {
  private readonly listeners = new Set<LeoExecutionEventListener>();

  subscribe(listener: LeoExecutionEventListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event: LeoExecutionEvent) {
    await Promise.allSettled([...this.listeners].map((listener) => listener(event)));
  }
}

export function assembleLeoExecutionPrompt(input: {
  system: string;
  objective: string;
  role: string;
  organizationId?: string;
  knowledge?: LeoKnowledgeItem[];
}) {
  const evidence = (input.knowledge || []).map((item, index) => `[${index + 1}] ${item.source}: ${item.text}`).join("\n");
  return [
    input.system.trim(),
    `ROLE: ${input.role}`,
    `ORGANIZATION: ${input.organizationId || "public/platform"}`,
    `OBJECTIVE: ${input.objective.trim()}`,
    evidence ? `AUTHORITATIVE CONTEXT:\n${evidence}` : "AUTHORITATIVE CONTEXT: No additional evidence supplied.",
    "BOUNDARY: Missing evidence remains unknown. Do not infer approval, delivery, payment, ownership, or successful execution.",
  ].join("\n\n");
}

function validateExecutionRequest(identity: LeoIdentity, request: LeoExecutionRequest) {
  if (!request.executionId?.trim()) throw new Error("executionId is required.");
  if (!request.action?.trim()) throw new Error("action is required.");
  if (!request.agentRole?.trim()) throw new Error("agentRole is required.");

  if (identity.scope === "tenant") {
    if (!identity.organizationId) throw new Error("Tenant execution requires an exact organization ID.");
    if (request.organizationId !== identity.organizationId) throw new Error("Cross-organization execution is forbidden.");
  }
  if (request.risk === "consequential") {
    if (!request.approval?.approved || !request.approval.approvedBy) throw new Error("Consequential execution requires explicit approval evidence.");
    if (!request.idempotencyKey?.trim()) throw new Error("Consequential execution requires an idempotency key.");
  }
}

export class LeoExecutionGateway {
  private readonly handlers = new Map<string, LeoExecutionHandler>();

  constructor(
    private readonly config: LeoRuntimeConfiguration,
    private readonly events = new LeoExecutionEventDispatcher(),
    private readonly retrieveKnowledge?: LeoKnowledgeRetriever,
  ) {}

  register(action: string, handler: LeoExecutionHandler) {
    const key = action.trim();
    if (!key) throw new Error("Execution action key is required.");
    if (this.handlers.has(key)) throw new Error(`Execution handler already registered: ${key}.`);
    this.handlers.set(key, handler);
  }

  async execute<TOutput = unknown>(identity: LeoIdentity, request: LeoExecutionRequest): Promise<LeoExecutionResult<TOutput>> {
    const startedAt = new Date().toISOString();
    try {
      validateExecutionRequest(identity, request);
      const handler = this.handlers.get(request.action);
      if (!handler) throw new Error(`No execution handler registered for ${request.action}.`);
      await this.events.publish({ type: "execution.started", executionId: request.executionId, organizationId: request.organizationId, action: request.action, at: startedAt });
      const knowledge = this.retrieveKnowledge
        ? await this.retrieveKnowledge({ organizationId: request.organizationId, query: request.action, limit: this.config.knowledge.maxItems })
        : [];
      const output = await handler(request, { identity, config: this.config, knowledge });
      const completedAt = new Date().toISOString();
      await this.events.publish({ type: "execution.succeeded", executionId: request.executionId, organizationId: request.organizationId, action: request.action, at: completedAt });
      return { executionId: request.executionId, status: "succeeded", action: request.action, output: output as TOutput, startedAt, completedAt };
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : "Execution failed.";
      const rejected = /requires|forbidden|registered|approval|idempotency/i.test(message);
      await this.events.publish({ type: rejected ? "execution.rejected" : "execution.failed", executionId: request.executionId || "unknown", organizationId: request.organizationId, action: request.action || "unknown", at: completedAt, detail: { error: message } });
      return { executionId: request.executionId || "unknown", status: rejected ? "rejected" : "failed", action: request.action || "unknown", error: message, startedAt, completedAt };
    }
  }
}
