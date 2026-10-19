import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkWhatsAppReadiness, saveWhatsAppCredentials } from "@/lib/whatsapp-integration";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { organizationId } = await context.params;
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const phoneNumberId = String(body.phoneNumberId || "").trim();
    const accessToken = String(body.accessToken || "").trim();
    const wabaId = String(body.wabaId || "").trim();
    const graphVersion = String(body.graphVersion || "v23.0").trim();

    if (!organizationId) return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    if (!phoneNumberId || !accessToken) {
      return NextResponse.json({ error: "Meta Phone Number ID and access token are required." }, { status: 400 });
    }
    if (!/^v\\d+\\.\\d+$/.test(graphVersion)) {
      return NextResponse.json({ error: "Graph API version must look like v23.0." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: organization, error: organizationError } = await admin
      .from("organizations")
      .select("id,name,slug")
      .eq("id", organizationId)
      .maybeSingle();
    if (organizationError) throw organizationError;
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const { data: integration, error: integrationError } = await admin
      .from("organization_integrations")
      .select("id,provider")
      .eq("organization_id", organizationId)
      .eq("provider", "whatsapp")
      .maybeSingle();
    if (integrationError) throw integrationError;
    if (!integration) {
      return NextResponse.json({ error: "This tenant has no WhatsApp integration record. Create it from tenant setup before configuring credentials." }, { status: 409 });
    }

    await saveWhatsAppCredentials({ organizationId, phoneNumberId, accessToken, wabaId: wabaId || undefined, graphVersion });
    const readiness = await checkWhatsAppReadiness(organizationId);

    return NextResponse.json({
      ok: true,
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      readiness,
      message: readiness.readyForCutover
        ? "Meta accepted the credentials and WhatsApp passed readiness checks."
        : "Credentials were stored securely. Review the readiness checks before treating WhatsApp as connected.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to configure tenant WhatsApp." },
      { status: 400 },
    );
  }
}
