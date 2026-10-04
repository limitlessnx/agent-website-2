import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("start_fluxknight_basic_free_trial", {
      target_organization_id: session.organizationId,
    });
    if (error) throw error;

    return NextResponse.json({ ok: true, trial: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start the Basic free trial.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
