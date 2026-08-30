import { createHmac, timingSafeEqual } from "node:crypto";
import type { LeoExecutionRequest } from "@/lib/leo-execution";
import type { LeoRuntimeConfiguration, N8nWorkflowRegistration } from "@/lib/leo-runtime-config";

export type LeoN8nAttempt = {
  attempt: number;
  startedAt: string;
  completedAt: string;
  statusCode?: number;
  ok: boolean;
  error?: string;
};

export type LeoN8nExecutionRecord = {
  executionId: string;
  workflowKey: string;
  organizationId?: string;
  status: "succeeded" | "failed" | "dead_lettered" | "rejected";
  attempts: LeoN8nAttempt[];
  response?: unknown;
  error?: string;
};

export type LeoN8nObserver = {
  record?(record: LeoN8nExecutionRecord): void | Promise<void>;
  deadLetter?(record: LeoN8nExecutionRecord): void | Promise<void>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function signLeoN8nPayload(secret: string, timestamp: string, rawBody: string) {
  return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
}

export function verifyLeoN8nSignature(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  now?: number;
  toleranceMs?: number;
}) {
  const numericTimestamp = Number(input.timestamp);
  if (!Number.isFinite(numericTimestamp)) return false;
  const now = input.now ?? Date.now();
  if (Math.abs(now - numericTimestamp) > (input.toleranceMs ?? 300_000)) return false;
  const expected = signLeoN8nPayload(input.secret, input.timestamp, input.rawBody);
  const supplied = input.signature.replace(/^sha256=/i, "").trim().toLowerCase();
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied, "utf8"), Buffer.from(expected, "utf8"));
}

function assertWorkflowExecutable(workflow: N8nWorkflowRegistration, request: LeoExecutionRequest) {
  if (workflow.consequential !== (request.risk === "consequential")) {
    throw new Error(`Workflow risk registration mismatch for ${workflow.key}.`);
  }
  if (workflow.consequential && (!request.approval?.approved || !request.approval.approvedBy)) {
    throw new Error("Consequential n8n execution requires explicit approval evidence.");
  }
  if (workflow.consequential && !request.idempotencyKey?.trim()) {
    throw new Error("Consequential n8n execution requires an idempotency key.");
  }
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { text: text.slice(0, 4_000) };
  }
}

export class LeoN8nExecutor {
  constructor(
    private readonly config: LeoRuntimeConfiguration,
    private readonly observer: LeoN8nObserver = {},
  ) {}

  async execute(workflowKey: string, request: LeoExecutionRequest): Promise<LeoN8nExecutionRecord> {
    const workflow = this.config.n8n.workflows[workflowKey];
    if (!this.config.n8n.enabled) return this.finish({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "rejected", attempts: [], error: "n8n execution is disabled." });
    if (!workflow) return this.finish({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "rejected", attempts: [], error: `n8n workflow is not registered: ${workflowKey}.` });
    if (!this.config.n8n.signingSecret) return this.finish({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "rejected", attempts: [], error: "n8n signing secret is not configured." });

    try {
      assertWorkflowExecutable(workflow, request);
    } catch (error) {
      return this.finish({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "rejected", attempts: [], error: error instanceof Error ? error.message : "n8n request rejected." });
    }

    const attempts: LeoN8nAttempt[] = [];
    const rawBody = JSON.stringify({
      executionId: request.executionId,
      organizationId: request.organizationId,
      agentRole: request.agentRole,
      action: request.action,
      input: request.input,
      approval: request.approval,
    });

    for (let attempt = 0; attempt <= this.config.execution.maxRetries; attempt += 1) {
      const startedAt = new Date().toISOString();
      const timestamp = String(Date.now());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), workflow.timeoutMs ?? this.config.execution.defaultTimeoutMs);
      try {
        const response = await fetch(workflow.webhookUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-fluxknight-execution-id": request.executionId,
            "x-fluxknight-timestamp": timestamp,
            "x-fluxknight-signature": `sha256=${signLeoN8nPayload(this.config.n8n.signingSecret, timestamp, rawBody)}`,
            ...(request.idempotencyKey ? { "idempotency-key": request.idempotencyKey } : {}),
          },
          body: rawBody,
          signal: controller.signal,
        });
        const completedAt = new Date().toISOString();
        const payload = await parseResponse(response);
        attempts.push({ attempt: attempt + 1, startedAt, completedAt, statusCode: response.status, ok: response.ok });
        if (response.ok) return this.finish({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "succeeded", attempts, response: payload });
        if (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429) {
          return this.deadLetter({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "dead_lettered", attempts, response: payload, error: `n8n rejected execution with HTTP ${response.status}.` });
        }
      } catch (error) {
        attempts.push({ attempt: attempt + 1, startedAt, completedAt: new Date().toISOString(), ok: false, error: error instanceof Error ? error.message : "n8n request failed." });
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < this.config.execution.maxRetries) await sleep(this.config.execution.retryBaseDelayMs * 2 ** attempt);
    }

    return this.deadLetter({ executionId: request.executionId, workflowKey, organizationId: request.organizationId, status: "dead_lettered", attempts, error: "n8n execution exhausted retry policy." });
  }

  private async finish(record: LeoN8nExecutionRecord) {
    await this.observer.record?.(record);
    return record;
  }

  private async deadLetter(record: LeoN8nExecutionRecord) {
    await this.observer.deadLetter?.(record);
    return this.finish(record);
  }
}

export function parseLeoN8nWebhook(input: { rawBody: string; timestamp: string; signature: string; secret: string }) {
  if (!verifyLeoN8nSignature(input)) throw new Error("Invalid or expired n8n webhook signature.");
  let body: unknown;
  try {
    body = JSON.parse(input.rawBody);
  } catch {
    throw new Error("n8n webhook payload must be valid JSON.");
  }
  if (!body || typeof body !== "object") throw new Error("n8n webhook payload must be an object.");
  const event = body as Record<string, unknown>;
  if (!String(event.executionId || "").trim()) throw new Error("n8n webhook executionId is required.");
  if (!String(event.type || "").trim()) throw new Error("n8n webhook type is required.");
  return event;
}
