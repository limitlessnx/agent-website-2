import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listActiveAgentOfferings,
  listOrganizationAgentSelections,
  saveOrganizationAgentSelections,
} from "@/lib/agent-catalog";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
  return session;
}

async function ensureOrganization(organizationId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id,name,status")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Organization not found.");
  return data;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const organizationId = request.nextUrl.searchParams.get("organizationId")?.trim();
    if (!organizationId) {
      return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    }

    const [organization, catalog, selections] = await Promise.all([
      ensureOrganization(organizationId),
      listActiveAgentOfferings(),
      listOrganizationAgentSelections(organizationId),
    ]);

    return NextResponse.json({ organization, catalog, selections });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load agent allocations.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const organizationId = String(body.organizationId || "").trim();
    const rawAgentKeys = Array.isArray(body.agentKeys) ? body.agentKeys : [];
    const agentKeys = rawAgentKeys.map((value) => String(value).trim()).filter(Boolean);
    if (!organizationId) {
      return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    }

    await ensureOrganization(organizationId);
    const result = await saveOrganizationAgentSelections({
      organizationId,
      agentKeys,
      allocationSource: "admin",
    });

    const admin = createAdminClient();
    const { data: provisioning, error: provisioningError } = await admin.rpc(
      "provision_selected_agent_allocations",
      {
        p_organization_id: organizationId,
        p_actor_user_id: null,
      },
    );
    if (provisioningError) throw provisioningError;

    return NextResponse.json({
      ok: true,
      ...result,
      selections: await listOrganizationAgentSelections(organizationId),
      provisioning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save agent allocations.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}
