import type { LeoExecutionEnvelope } from "@/lib/leo-execution-envelope";

export type LeoN8nExecutionResult = {
  ok: boolean;
  requestId: string;
  toolKey: string;
  status: string;
  executionId?: string | null;
  result?: Record<string, unknown> | null;
  error?: string | null;
  workflow?: string | null;
};

function executorUrl() {
  return (
    process.env.LEO_N8N_EXECUTOR_WEBHOOK_URL ||
    "https://n8n.srv1720757.hstgr.cloud/webhook/fluxknight-leo-executor-v2"
  ).trim();
}

export async function executeLeoEnvelopeViaN8n(envelope: LeoExecutionEnvelope): Promise<LeoN8nExecutionResult> {
  const secret = (process.env.LEO_N8N_SHARED_SECRET || process.env.RUNTIME_GATEWAY_SECRET || "").trim();
  if (!secret) throw new Error("Leo executor shared secret is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 95000);
  try {
    const response = await fetch(executorUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fluxknight-leo-secret": secret,
      },
      body: JSON.stringify(envelope),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw new Error(String(payload.error || `Leo executor returned HTTP ${response.status}.`));
    }
    return {
      ok: Boolean(payload.ok),
      requestId: String(payload.requestId || envelope.requestId),
      toolKey: String(payload.toolKey || envelope.toolKey),
      status: String(payload.status || (payload.ok ? "completed" : "failed")),
      executionId: payload.executionId ? String(payload.executionId) : null,
      result: payload.result && typeof payload.result === "object" && !Array.isArray(payload.result)
        ? payload.result as Record<string, unknown>
        : null,
      error: payload.error ? String(payload.error) : null,
      workflow: payload.workflow ? String(payload.workflow) : null,
    };
  } catch (error) {
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new Error("Leo n8n executor timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
