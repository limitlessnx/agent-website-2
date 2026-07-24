type SupabaseConfig = { url: string; key: string };

export function getServerSupabaseConfig(): SupabaseConfig {
  const url =
    process.env.LIMITLESS_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "";
  const key =
    process.env.LIMITLESS_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "";

  return { url: url.replace(/\/$/, ""), key };
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
