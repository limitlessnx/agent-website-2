import { createClient } from "@supabase/supabase-js";
import { getServerSupabaseConfig } from "@/lib/supabase-server-rest";

export function createAdminClient() {
  const { url, key } = getServerSupabaseConfig();
  if (!url || !key) throw new Error("Supabase admin credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
