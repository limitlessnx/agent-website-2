import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { deleteProgressiveLead, updateProgressiveLead } from "@/lib/lead-profile-service";

async function requireAdmin() {
  const session = await getAdminSession();
  return Boolean(session);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const lead = await updateProgressiveLead(id, {
      name: String(body.name || "").trim(),
      phone: String(body.phone || "").trim(),
      email: String(body.email || "").trim() || undefined,
      status: String(body.status || "new"),
      score: String(body.score || "").trim() || undefined,
      budget: String(body.budget || "").trim() || undefined,
      location_preference: String(body.location_preference || "").trim() || undefined,
      property_type: String(body.property_type || "").trim() || undefined,
      property_interest: String(body.property_interest || "").trim() || undefined,
      purpose: String(body.purpose || "").trim() || undefined,
      notes: String(body.notes || "").trim() || undefined,
      campaign_eligible: body.campaign_eligible !== false,
      source: "admin_dashboard_update",
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update lead." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await deleteProgressiveLead(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete lead." },
      { status: 400 },
    );
  }
}
