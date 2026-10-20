import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getClientSession } from "@/lib/client-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWhatsAppReadiness, saveWhatsAppCredentials } from "@/lib/whatsapp-integration";

async function resolveAuthorizedOrganization(requestedOrganizationId: string) {
  const client = await getClientSession();
  if (client?.organizationId) {
    if (String(client.role || "").toLowerCase() !== "owner") return { error: "Owner access is required.", status: 403 as const };
    // Client sessions are always pinned to their own organization. Ignore any
    // organization ID supplied in the request body to prevent cross-tenant writes.
    return { organizationId: client.organizationId };
  }

  const adminSession = await getAdminSession();
  if (!adminSession) return { error: "Authentication required.", status: 401 as const };
  if (!requestedOrganizationId) {
    return { error: "organizationId is required for super-admin WhatsApp configuration.", status: 400 as const };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .eq("id", requestedOrganizationId)
    .maybeSingle();
  if (error) return { error: "Unable to resolve the requested organization.", status: 500 as const };
  if (!data?.id) return { error: "The requested organization was not found.", status: 404 as const };
  return { organizationId: data.id };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const requestedOrganizationId = String(body.organizationId || body.organization_id || "").trim();
  const auth = await resolveAuthorizedOrganization(requestedOrganizationId);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const phoneNumberId = String(body.phoneNumberId || body.phone_number_id || "").trim();
  const accessToken = String(body.accessToken || body.access_token || "").trim();
  const wabaId = String(body.wabaId || body.waba_id || "").trim();
  const graphVersion = String(body.graphVersion || body.graph_version || "v23.0").trim();

  if (!phoneNumberId || !accessToken) {
    return NextResponse.json({ error: "phoneNumberId and accessToken are required." }, { status: 400 });
  }
  if (!/^v\d+\.\d+$/.test(graphVersion)) {
    return NextResponse.json({ error: "graphVersion must look like v23.0." }, { status: 400 });
  }

  try {
    await saveWhatsAppCredentials({
      organizationId: auth.organizationId,
      phoneNumberId,
      accessToken,
      wabaId: wabaId || undefined,
      graphVersion,
    });
    const readiness = await checkWhatsAppReadiness(auth.organizationId);
    console.info("[whatsapp-configure] credentials saved", {
      organizationId: auth.organizationId,
      phoneNumberIdPresent: Boolean(phoneNumberId),
      wabaIdPresent: Boolean(wabaId),
    });
    return NextResponse.json({
      ok: true,
      organizationId: auth.organizationId,
      readiness,
      webhookUrl: "https://fluxknight.space/api/whatsapp/webhook",
    });
  } catch (error) {
    console.error("[whatsapp-configure] save failed", {
      organizationId: auth.organizationId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to configure WhatsApp." },
      { status: 500 },
    );
  }
}
