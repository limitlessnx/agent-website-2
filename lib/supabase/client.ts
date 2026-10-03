"use client";

import { createBrowserClient } from "@supabase/ssr";
import { resolveSupabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient(
    resolveSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
