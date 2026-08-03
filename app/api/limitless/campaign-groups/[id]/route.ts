import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteCampaignGroup, getCampaignGroup, saveCampaignGroup } from "@/lib/campaign-groups";

async function requireAdmin() {
  const session = await getAdminSession();
  return Boolean(session);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await deleteCampaignGroup(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete campaign group." },
      { status: 400 },
    );
  }
}

function parsePhones(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "")
    .split(/[\s,;\n]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await getCampaignGroup(id);
    if (!existing) return NextResponse.json({ error: "Campaign group not found." }, { status: 404 });

    const group = await saveCampaignGroup({
      id,
      name: String(body.name || existing.name).trim(),
      groupType: body.groupType === "smart" ? "smart" : "manual",
      description: String(body.description ?? existing.description ?? "").trim(),
      leadIds: Array.isArray(body.leadIds) ? body.leadIds.map(String) : existing.leadIds,
      phones: body.phones === undefined ? existing.phones : parsePhones(body.phones),
      rules: body.rules && typeof body.rules === "object" ? body.rules : existing.rules,
    });
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update campaign group." },
      { status: 400 },
    );
  }
}
