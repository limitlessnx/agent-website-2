import { createClient } from "@supabase/supabase-js";

const ACTIVE_SUPABASE_URL = "https://tacxegmlppngnuvldojy.supabase.co";
const RETIRED_SUPABASE_REFS = new Set(["fwhwsvetndbjaljzghpg"]);

function resolveSupabaseUrl() {
  const configured = String(process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  if (!configured) return ACTIVE_SUPABASE_URL;

  try {
    const ref = new URL(configured).hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1] || "";
    return RETIRED_SUPABASE_REFS.has(ref) ? ACTIVE_SUPABASE_URL : configured;
  } catch {
    return ACTIVE_SUPABASE_URL;
  }
}

export function createAdminClient() {
  const url = resolveSupabaseUrl();
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase admin credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
