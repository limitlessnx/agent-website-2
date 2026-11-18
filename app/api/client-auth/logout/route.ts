import { clearAdminSession } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import {
  clearClientSession,
  clearClientOAuthContext,
  clearPendingClientSetupSession,
  clearManagerSession,
} from "@/lib/client-auth";
import { signOutAccount } from "@/lib/supabase/server";

export async function POST() {
  await signOutAccount("global").catch(() => undefined);
  await Promise.all([
    clearClientSession(),
    clearManagerSession(),
    clearAdminSession(),
    clearPendingClientSetupSession(),
    clearClientOAuthContext(),
  ]);
  return NextResponse.json({ ok: true });
}
