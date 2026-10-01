export type LeoRuntimeEnvironment = "development" | "preview" | "production" | "test";

export type LeoRuntimeConfiguration = {
  environment: LeoRuntimeEnvironment;
  execution: { defaultTimeoutMs: number; maxRetries: number; retryBaseDelayMs: number };
  knowledge: { maxItems: number };
};

export type LeoRuntimeReadiness = { ready: boolean; blockers: string[]; warnings: string[] };

type RuntimeEnv = Record<string, string | undefined>;

const numberFromEnv = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.trunc(parsed))) : fallback;
};

function normalizeEnvironment(value: string | undefined): LeoRuntimeEnvironment {
  if (value === "production" || value === "preview" || value === "test") return value;
  return "development";
}

export function loadLeoRuntimeConfiguration(env: RuntimeEnv = process.env): LeoRuntimeConfiguration {
  return {
    environment: normalizeEnvironment(env.VERCEL_ENV || env.NODE_ENV),
    execution: {
      defaultTimeoutMs: numberFromEnv(env.FLUXKNIGHT_EXECUTION_TIMEOUT_MS, 15_000, 1_000, 60_000),
      maxRetries: numberFromEnv(env.FLUXKNIGHT_EXECUTION_MAX_RETRIES, 2, 0, 5),
      retryBaseDelayMs: numberFromEnv(env.FLUXKNIGHT_EXECUTION_RETRY_BASE_MS, 400, 50, 10_000),
    },
    knowledge: { maxItems: numberFromEnv(env.FLUXKNIGHT_KNOWLEDGE_MAX_ITEMS, 8, 1, 25) },
  };
}

export function auditLeoRuntimeConfiguration(config: LeoRuntimeConfiguration): LeoRuntimeReadiness {
  return { ready: true, blockers: [], warnings: [] };
}

export function getSafeLeoRuntimeConfiguration(config: LeoRuntimeConfiguration) {
  return { environment: config.environment, execution: config.execution, knowledge: config.knowledge };
}
