import type { SupportMessage, SupportScope } from "@/lib/support-agent";
import { buildSupportSystemPrompt } from "@/lib/ai/support-prompt";
import { sanitizeSupportDiagnostics, type SafeSupportDiagnostics } from "@/lib/ai/support-sanitizer";
import { resolvePhase12AgentId, runPhase12StructuredAgent } from "@/lib/ai-runtime/migration";

export const SUPPORT_ACTION_KEYS = [
  "inspect_tenant_workflow_failures",
  "verify_tenant_integrations",
  "request_admin_repair",
  "review_agent_configuration",
  "review_runtime_errors",
  "review_subscription_status",
] as const;

export const SUPPORT_CATEGORIES = [
  "navigation",
  "agent_setup",
  "workflow",
  "integration",
  "runtime",
  "billing",
  "account",
  "general",
] as const;

export const SUPPORT_RISK_LEVELS = ["low", "medium", "high"] as const;

export type SupportActionKey = (typeof SUPPORT_ACTION_KEYS)[number];
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportRiskLevel = (typeof SUPPORT_RISK_LEVELS)[number];

export type SupportAIResponse = {
  reply: string;
  category: SupportCategory;
  confidence: number;
  needsHumanReview: boolean;
  proposedActions: Array<{
    actionKey: SupportActionKey;
    title: string;
    description: string;
    riskLevel: SupportRiskLevel;
  }>;
};

type SupportUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type SupportModelResult =
  | {
      ok: true;
      connected: true;
      provider: "openai";
      model: string;
      response: SupportAIResponse;
      diagnostics: SafeSupportDiagnostics;
      usage?: SupportUsage;
      latencyMs: number;
    }
  | {
      ok: false;
      connected: false;
      provider: "openai" | null;
      model: string | null;
      reason: "not_configured" | "timeout" | "provider_error" | "invalid_response";
      diagnostics: SafeSupportDiagnostics;
      latencyMs: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

export function validateSupportAIResponse(value: unknown): SupportAIResponse | null {
  if (!isRecord(value)) return null;
  const reply = stringValue(value.reply, 6000);
  const category = typeof value.category === "string" && SUPPORT_CATEGORIES.includes(value.category as SupportCategory)
    ? (value.category as SupportCategory)
    : null;
  const confidence = typeof value.confidence === "number" && Number.isFinite(value.confidence)
    ? value.confidence
    : null;
  const needsHumanReview = typeof value.needsHumanReview === "boolean" ? value.needsHumanReview : null;
  const proposedActions = Array.isArray(value.proposedActions) ? value.proposedActions : null;

  if (!reply || !category || confidence === null || confidence < 0 || confidence > 1 || needsHumanReview === null || !proposedActions || proposedActions.length > 3) {
    return null;
  }

  const validatedActions: SupportAIResponse["proposedActions"] = [];
  for (const item of proposedActions) {
    if (!isRecord(item)) return null;
    const actionKey = typeof item.actionKey === "string" && SUPPORT_ACTION_KEYS.includes(item.actionKey as SupportActionKey)
      ? (item.actionKey as SupportActionKey)
      : null;
    const title = stringValue(item.title, 180);
    const description = stringValue(item.description, 900);
    const riskLevel = typeof item.riskLevel === "string" && SUPPORT_RISK_LEVELS.includes(item.riskLevel as SupportRiskLevel)
      ? (item.riskLevel as SupportRiskLevel)
      : null;
    if (!actionKey || !title || !description || !riskLevel) return null;
    validatedActions.push({ actionKey, title, description, riskLevel });
  }

  return { reply, category, confidence, needsHumanReview, proposedActions: validatedActions };
}

function historyForModel(history: SupportMessage[]) {
  return history
    .filter((item) => item.role === "user" || item.role === "assistant")
    .slice(-12)
    .map((item) => ({
      role: item.role === "assistant" ? "assistant" : "user",
      content: String(item.content || "").slice(0, 2500),
    }));
}

const supportResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: { type: "string" },
    category: { type: "string", enum: [...SUPPORT_CATEGORIES] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needsHumanReview: { type: "boolean" },
    proposedActions: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          actionKey: { type: "string", enum: [...SUPPORT_ACTION_KEYS] },
          title: { type: "string" },
          description: { type: "string" },
          riskLevel: { type: "string", enum: [...SUPPORT_RISK_LEVELS] },
        },
        required: ["actionKey", "title", "description", "riskLevel"],
      },
    },
  },
  required: ["reply", "category", "confidence", "needsHumanReview", "proposedActions"],
} as const;

export async function generateSupportAgentReply(input: {
  message: string;
  history: SupportMessage[];
  diagnostics: Record<string, unknown>;
  scope: SupportScope;
  organizationId?: string;
}): Promise<SupportModelResult> {
  const startedAt = Date.now();
  const diagnostics = sanitizeSupportDiagnostics(input.diagnostics, input.scope, input.organizationId);
  if (!process.env.OPENAI_API_KEY?.trim()) {
    return {
      ok: false,
      connected: false,
      provider: null,
      model: null,
      reason: "not_configured",
      diagnostics,
      latencyMs: Date.now() - startedAt,
    };
  }
  if (input.scope !== "tenant" || !input.organizationId) {
    return {
      ok: false,
      connected: false,
      provider: "openai",
      model: null,
      reason: "provider_error",
      diagnostics,
      latencyMs: Date.now() - startedAt,
    };
  }

  try {
    const agentId = await resolvePhase12AgentId({ organizationId: input.organizationId, kind: "leo" });
    const result = await runPhase12StructuredAgent({
      kind: "leo",
      organizationId: input.organizationId,
      agentId,
      channel: "api",
      systemPrompt: buildSupportSystemPrompt({ scope: input.scope, organizationId: input.organizationId, diagnostics }),
      input: {
        message: input.message.slice(0, 8000),
        history: historyForModel(input.history),
        diagnostics,
      },
      outputSchema: supportResponseSchema as unknown as Record<string, unknown>,
      temperature: 0.2,
    });
    const parsed: unknown = result.parsed || (() => {
      try { return JSON.parse(result.outputText); } catch { return null; }
    })();
    const validated = validateSupportAIResponse(parsed);
    if (!validated) {
      return {
        ok: false,
        connected: false,
        provider: "openai",
        model: result.modelKey,
        reason: "invalid_response",
        diagnostics,
        latencyMs: Date.now() - startedAt,
      };
    }
    return {
      ok: true,
      connected: true,
      provider: "openai",
      model: result.modelKey,
      response: validated,
      diagnostics,
      usage: result.usage,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError");
    return {
      ok: false,
      connected: false,
      provider: "openai",
      model: null,
      reason: timedOut ? "timeout" : "provider_error",
      diagnostics,
      latencyMs: Date.now() - startedAt,
    };
  }
}
