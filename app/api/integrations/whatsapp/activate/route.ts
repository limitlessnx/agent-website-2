import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkMaiaLiveCutoverReadiness } from "@/lib/maia-cutover-readiness";
import { getWhatsAppIntegration } from "@/lib/whatsapp-integration";

async function resolveAuthorizedOrganization() {
  const client = await getClientSession();
  if (client?.organizationId) {
    if (String(client.role || "").toLowerCase() !== "owner") {
      return { error: "Owner access is required.", status: 403 as const };
    }
    return { organizationId: client.organizationId };
  }

  const adminSession = await getAdminSession();
  if (!adminSession) return { error: "Authentication required.", status: 401 as const };

  const admin = createAdminClient();
  const { data } = await admin.from("organizations").select("id").eq("slug", "limitless-realty").maybeSingle();
  if (!data?.id) return { error: "Limitless Realty organization was not found.", status: 404 as const };
  return { organizationId: data.id };
}

export async function POST() {
  const auth = await resolveAuthorizedOrganization();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const readiness = await checkMaiaLiveCutoverReadiness(auth.organizationId);
    if (!readiness.readyForLiveTraffic) {
      return NextResponse.json(
        {
          error: "WhatsApp cannot be activated until all live-traffic readiness checks pass.",
          readiness,
        },
        { status: 409 },
      );
    }

    const integration = await getWhatsAppIntegration(auth.organizationId);
    if (!integration?.id) {
      return NextResponse.json({ error: "WhatsApp credentials must be saved before activation." }, { status: 409 });
    }

    const admin = createAdminClient();
    const configuration = (integration.configuration || {}) as Record<string, unknown>;
    const { error } = await admin.from("organization_integrations").update({
      status: "connected",
      configuration: {
        ...configuration,
        runtime_route: "trigger_dev",
        maia_active: true,
        activated_at: new Date().toISOString(),
      },
      health: {
        ...(integration.health || {}),
        state: "healthy",
        ready_for_cutover: true,
        maia_active: true,
      },
      last_connected_at: new Date().toISOString(),
      last_checked_at: new Date().toISOString(),
    }).eq("id", integration.id);

    if (error) throw error;

    const refreshed = await checkMaiaLiveCutoverReadiness(auth.organizationId);
    return NextResponse.json({
      ok: true,
      active: true,
      organizationId: auth.organizationId,
      readiness: refreshed,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to activate WhatsApp." },
      { status: 500 },
    );
  }
}
