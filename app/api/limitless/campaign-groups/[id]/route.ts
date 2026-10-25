import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { deleteRealEstateCampaignGroup, getRealEstateCampaignGroup, saveRealEstateCampaignGroup } from "@/lib/real-estate-campaign-groups";

async function scope() {
  const session = await getAdminSession();
  if (!session) return null;
  const target = await resolveAdminOrganizationScope();
  return { session, organizationId: target.organizationId };
}

function parsePhones(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "").split(/[\s,;\n]+/).map((phone) => phone.trim()).filter(Boolean);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await scope();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    if (!await getRealEstateCampaignGroup(current.organizationId, id)) return NextResponse.json({ error: "Campaign group not found." }, { status: 404 });
    await deleteRealEstateCampaignGroup(current.organizationId, current.session.email, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete campaign group." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = await scope();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const existing = await getRealEstateCampaignGroup(current.organizationId, id);
    if (!existing) return NextResponse.json({ error: "Campaign group not found." }, { status: 404 });
    const body = await request.json();
    const group = await saveRealEstateCampaignGroup({
      organizationId: current.organizationId,
      actorId: current.session.email,
      id,
      name: String(body.name || existing.name).trim(),
      groupType: body.groupType === "smart" ? "smart" : body.groupType === "manual" ? "manual" : existing.groupType,
      description: String(body.description ?? existing.description ?? "").trim(),
      leadIds: Array.isArray(body.leadIds) ? body.leadIds.map(String) : existing.leadIds,
      phones: body.phones === undefined ? [] : parsePhones(body.phones),
      rules: body.rules && typeof body.rules === "object" ? body.rules : existing.rules,
    });
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update campaign group." }, { status: 400 });
  }
}
