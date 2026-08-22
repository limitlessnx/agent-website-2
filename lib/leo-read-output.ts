const MAX_RESULT_BYTES = 24_000;
const MAX_STRING_LENGTH = 500;
const MAX_ARRAY_ITEMS = 50;
const SECRET_KEYS = new Set(["access_token", "refresh_token", "api_key", "secret", "password", "credential", "credentials", "authorization", "private_key", "client_secret", "webhook_secret"]);
const PII_KEYS = new Set(["ssn", "nin", "bvn", "date_of_birth", "dob", "home_address", "residential_address"]);

type LeoReadResult = Record<string, unknown>;

function sanitizeText(value: string) {
  return value.replace(/https?:\/\/\S+/gi, "[url]").slice(0, MAX_STRING_LENGTH);
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY_ITEMS).map(sanitizeValue);
  if (typeof value === "string") return sanitizeText(value);
  if (!value || typeof value !== "object") return value;
  return sanitizeLeoReadResult(value as Record<string, unknown>);
}

export function sanitizeLeoReadResult(row: Record<string, unknown>): LeoReadResult {
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => !SECRET_KEYS.has(key.toLowerCase()))
      .map(([key, value]) => [key, PII_KEYS.has(key.toLowerCase()) ? "[redacted]" : sanitizeValue(value)]),
  );
}

export function boundLeoReadResult(result: Record<string, unknown>): LeoReadResult {
  const safe = sanitizeLeoReadResult(result);
  if (Buffer.byteLength(JSON.stringify(safe), "utf8") <= MAX_RESULT_BYTES) return safe;

  const bounded: LeoReadResult = {};
  let bytes = 2;
  for (const [key, value] of Object.entries(safe)) {
    const entryBytes = Buffer.byteLength(JSON.stringify({ [key]: value }), "utf8") - 2;
    if (bytes + entryBytes + 1 > MAX_RESULT_BYTES) break;
    bounded[key] = value;
    bytes += entryBytes + 1;
  }
  return {
    tool: typeof safe.tool === "string" ? safe.tool : "leo.read",
    scope: safe.scope,
    truncated: true,
    returnedKeys: Object.keys(bounded),
    data: bounded,
  };
}
