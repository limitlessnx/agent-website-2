import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { getRealEstateCampaignGroups, saveRealEstateCampaignGroup } from "@/lib/real-estate-campaign-groups";

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

export async function GET() {
  const current = await scope();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const groups = await getRealEstateCampaignGroups(current.organizationId);
    return NextResponse.json({ groups }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load campaign groups." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const current = await scope();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const group = await saveRealEstateCampaignGroup({
      organizationId: current.organizationId,
      actorId: current.session.email,
      id: String(body.id || "").trim() || undefined,
      name: String(body.name || "").trim(),
      groupType: body.groupType === "smart" ? "smart" : "manual",
      description: String(body.description || "").trim(),
      leadIds: Array.isArray(body.leadIds) ? body.leadIds.map(String) : [],
      phones: parsePhones(body.phones),
      rules: body.rules && typeof body.rules === "object" ? body.rules : undefined,
    });
    return NextResponse.json({ group });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save campaign group." }, { status: 400 });
  }
}
