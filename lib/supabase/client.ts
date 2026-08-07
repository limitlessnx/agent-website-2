"use client";

import { createBrowserClient } from "@supabase/ssr";

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

export function createClient() {
  return createBrowserClient(
    resolveSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
