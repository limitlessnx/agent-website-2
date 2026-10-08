import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { getFluxknightPlatformOrganizationId } from "@/lib/canonical-customer";
import { getEvaluationLeadDetail, updateEvaluationLeadStatus } from "@/lib/evaluation-leads";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const organizationId = await getFluxknightPlatformOrganizationId();
    const detail = await getEvaluationLeadDetail(id, organizationId);
    if (!detail) return NextResponse.json({ error: "Evaluation lead not found." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load evaluation lead." },
      { status: 400 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const organizationId = await getFluxknightPlatformOrganizationId();
    const rows = await updateEvaluationLeadStatus(id, String(body.status || ""), organizationId);
    if (!rows.length) return NextResponse.json({ error: "Evaluation lead not found." }, { status: 404 });
    return NextResponse.json({ lead: rows[0] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update evaluation lead." },
      { status: 400 },
    );
  }
}
