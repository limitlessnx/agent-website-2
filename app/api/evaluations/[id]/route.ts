import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { updateEvaluationLeadStatus } from "@/lib/evaluation-leads";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const rows = await updateEvaluationLeadStatus(id, String(body.status || ""));
    return NextResponse.json({ lead: rows[0] || null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update evaluation lead." },
      { status: 400 },
    );
  }
}
