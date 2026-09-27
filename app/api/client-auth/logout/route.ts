import { NextResponse } from "next/server";
import { clearClientSession, clearClientOAuthContext, clearPendingClientSetupSession } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase=await createClient();
  await supabase.auth.signOut().catch(()=>undefined);
  await Promise.all([
    clearClientSession(),
    clearPendingClientSetupSession(),
    clearClientOAuthContext(),
  ]);
  return NextResponse.json({ ok: true });
}
