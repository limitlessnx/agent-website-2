export type LeoRuntimeEnvironment = "development" | "preview" | "production" | "test";

export type N8nWorkflowRegistration = {
  key: string;
  webhookUrl: string;
  consequential: boolean;
  timeoutMs?: number;
};

export type LeoRuntimeConfiguration = {
  environment: LeoRuntimeEnvironment;
  execution: {
    defaultTimeoutMs: number;
    maxRetries: number;
    retryBaseDelayMs: number;
  };
  n8n: {
    enabled: boolean;
    signingSecret?: string;
    workflows: Record<string, N8nWorkflowRegistration>;
  };
  knowledge: {
    maxItems: number;
  };
};

export type LeoRuntimeReadiness = {
  ready: boolean;
  blockers: string[];
  warnings: string[];
};

type RuntimeEnv = Record<string, string | undefined>;

const numberFromEnv = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
};

function normalizeEnvironment(value: string | undefined): LeoRuntimeEnvironment {
  if (value === "production" || value === "preview" || value === "test") return value;
  return "development";
}

function parseWorkflowRegistry(raw: string | undefined): Record<string, N8nWorkflowRegistration> {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("FLUXKNIGHT_N8N_WORKFLOWS must be valid JSON.");
  }
  if (!Array.isArray(parsed)) throw new Error("FLUXKNIGHT_N8N_WORKFLOWS must be a JSON array.");

  const registrations: Record<string, N8nWorkflowRegistration> = {};
  for (const item of parsed) {
    if (!item || typeof item !== "object") throw new Error("Every n8n workflow registration must be an object.");
    const candidate = item as Record<string, unknown>;
    const key = String(candidate.key || "").trim();
    const webhookUrl = String(candidate.webhookUrl || "").trim();
    if (!/^[a-z0-9][a-z0-9._-]{1,79}$/i.test(key)) throw new Error(`Invalid n8n workflow key: ${key || "<empty>"}.`);
    let url: URL;
    try {
      url = new URL(webhookUrl);
    } catch {
      throw new Error(`Invalid webhook URL for n8n workflow ${key}.`);
    }
    if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error(`n8n workflow ${key} must use HTTPS.`);
    if (registrations[key]) throw new Error(`Duplicate n8n workflow key: ${key}.`);
    registrations[key] = {
      key,
      webhookUrl: url.toString(),
      consequential: candidate.consequential === true,
      timeoutMs: typeof candidate.timeoutMs === "number" ? Math.min(60_000, Math.max(1_000, Math.trunc(candidate.timeoutMs))) : undefined,
    };
  }
  return registrations;
}

export function loadLeoRuntimeConfiguration(env: RuntimeEnv = process.env): LeoRuntimeConfiguration {
  const environment = normalizeEnvironment(env.VERCEL_ENV || env.NODE_ENV);
  const signingSecret = env.FLUXKNIGHT_N8N_SIGNING_SECRET?.trim() || undefined;
  const workflows = parseWorkflowRegistry(env.FLUXKNIGHT_N8N_WORKFLOWS);
  const enabled = env.FLUXKNIGHT_N8N_ENABLED === "true" || Object.keys(workflows).length > 0;

  return {
    environment,
    execution: {
      defaultTimeoutMs: numberFromEnv(env.FLUXKNIGHT_EXECUTION_TIMEOUT_MS, 15_000, 1_000, 60_000),
      maxRetries: numberFromEnv(env.FLUXKNIGHT_EXECUTION_MAX_RETRIES, 2, 0, 5),
      retryBaseDelayMs: numberFromEnv(env.FLUXKNIGHT_EXECUTION_RETRY_BASE_MS, 400, 50, 10_000),
    },
    n8n: { enabled, signingSecret, workflows },
    knowledge: { maxItems: numberFromEnv(env.FLUXKNIGHT_KNOWLEDGE_MAX_ITEMS, 8, 1, 25) },
  };
}

export function auditLeoRuntimeConfiguration(config: LeoRuntimeConfiguration): LeoRuntimeReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (config.n8n.enabled && !config.n8n.signingSecret) blockers.push("n8n is enabled but FLUXKNIGHT_N8N_SIGNING_SECRET is missing.");
  if (config.n8n.enabled && Object.keys(config.n8n.workflows).length === 0) warnings.push("n8n is enabled with no registered workflows.");
  if (!config.n8n.enabled) warnings.push("n8n execution is disabled.");
  return { ready: blockers.length === 0, blockers, warnings };
}

export function getSafeLeoRuntimeConfiguration(config: LeoRuntimeConfiguration) {
  return {
    environment: config.environment,
    execution: config.execution,
    knowledge: config.knowledge,
    n8n: {
      enabled: config.n8n.enabled,
      signingConfigured: Boolean(config.n8n.signingSecret),
      workflows: Object.values(config.n8n.workflows).map(({ key, consequential, timeoutMs }) => ({ key, consequential, timeoutMs })),
    },
  };
}
