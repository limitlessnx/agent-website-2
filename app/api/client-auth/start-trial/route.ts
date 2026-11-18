import { NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertOrganizationOwner, getOrganizationAccessContext } from "@/lib/organization-membership";

export async function POST() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (session.isAdminPreview) return NextResponse.json({ error: "Tenant preview is read-only." }, { status: 403 });
  try {
    assertOrganizationOwner(await getOrganizationAccessContext(session.organizationId, session.userId));
  } catch {
    return NextResponse.json({ error: "Only the organization owner can activate a trial." }, { status: 403 });
  }

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
