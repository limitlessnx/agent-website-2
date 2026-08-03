import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteCampaignGroup } from "@/lib/campaign-groups";

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
