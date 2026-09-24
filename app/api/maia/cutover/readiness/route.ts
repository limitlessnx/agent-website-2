import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkMaiaLiveCutoverReadiness } from "@/lib/maia-cutover-readiness";

async function resolveOrganizationId() {
  const client = await getClientSession();
  if (client?.organizationId) return client.organizationId;

  const adminSession = await getAdminSession();
  if (!adminSession) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", "limitless-realty")
    .maybeSingle();

  return data?.id || null;
}

export async function GET() {
  const organizationId = await resolveOrganizationId();
  if (!organizationId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const readiness = await checkMaiaLiveCutoverReadiness(organizationId);
    return NextResponse.json({
      ...readiness,
      webhookUrl: "https://fluxknight.space/api/whatsapp/webhook",
      cutoverMode: readiness.readyForLiveTraffic ? "ready" : "blocked",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to evaluate Maia live-cutover readiness.",
      },
      { status: 500 },
    );
  }
}
