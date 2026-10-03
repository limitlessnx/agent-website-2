const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const RETIRED_SUPABASE_REFS = new Set(["fwhwsvetndbjaljzghpg"]);

function projectRefFromUrl(value: string) {
  try {
    return new URL(value).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] || "";
  } catch {
    return "";
  }
}

export function resolveSupabaseUrl(value?: string | null) {
  const configured = String(value || "").trim().replace(/\/$/, "");
  if (!configured) return ACTIVE_SUPABASE_URL;
  const ref = projectRefFromUrl(configured);
  return ref && RETIRED_SUPABASE_REFS.has(ref) ? ACTIVE_SUPABASE_URL : configured;
}

export { ACTIVE_SUPABASE_URL, RETIRED_SUPABASE_REFS };
