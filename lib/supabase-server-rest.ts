type SupabaseConfig = { url: string; key: string };

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const RETIRED_SUPABASE_REFS = new Set(["fwhwsvetndbjaljzghpg"]);

function normalizeSupabaseUrl(value: string) {
  const url = String(value || "").trim().replace(/\/$/, "");
  if (!url) return ACTIVE_SUPABASE_URL;

  try {
    const hostname = new URL(url).hostname;
    const ref = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] || "";
    if (RETIRED_SUPABASE_REFS.has(ref)) return ACTIVE_SUPABASE_URL;
  } catch {
    return ACTIVE_SUPABASE_URL;
  }

  return url;
}

export function getServerSupabaseConfig(): SupabaseConfig {
  const configuredUrl =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  return { url: normalizeSupabaseUrl(configuredUrl), key };
}

export function isServerSupabaseConfigured() {
  const { url, key } = getServerSupabaseConfig();
  return Boolean(url && key);
}

export async function supabaseRest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = getServerSupabaseConfig();
  if (!url || !key) throw new Error("Supabase server connection is not configured.");

  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Supabase request failed: ${response.status} ${detail}`);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const supabaseServerRequest = supabaseRest;
