import { NextResponse } from "next/server";
import { signOutAccount } from "@/lib/supabase/server";
import {
  clearClientSession,
  clearPendingClientSetupSession,
} from "@/lib/client-auth";
import { clearAdminSession } from "@/lib/admin-auth";

export async function POST() {
  await clearAdminSession();
  await signOutAccount().catch(() => undefined);
  await clearClientSession();
  await clearPendingClientSetupSession();
  return NextResponse.json({ ok: true });
}
