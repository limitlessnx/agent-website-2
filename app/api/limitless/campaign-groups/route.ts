import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getCampaignGroups, saveCampaignGroup } from "@/lib/campaign-groups";

async function requireAdmin() {
  const session = await getAdminSession();
  return Boolean(session);
}

function parsePhones(value: unknown) {
  if (Array.isArray(value)) return value.map(String);
  return String(value || "")
    .split(/[\s,;\n]+/)
    .map((phone) => phone.trim())
    .filter(Boolean);
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const groups = await getCampaignGroups(100);
  return NextResponse.json({ groups });
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const group = await saveCampaignGroup({
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save campaign group." },
      { status: 400 },
    );
  }
}
