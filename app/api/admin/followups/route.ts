import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { assertFluxCreditsAvailable, assertFluxFeatureAccess, reserveFluxCredits } from "@/lib/flux-credits";
import { createSequence, enrollLeads, updateEnrollment } from "@/lib/followup-control";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    const organizationId = String(body.organization_id || body.organizationId || "").trim();
    if (!organizationId) return NextResponse.json({ error:"Organization is required." }, { status:400 });

    await assertFluxFeatureAccess(organizationId, body.type === "sequence" ? "follow_ups" : "reminders");

    if (body.type === "sequence") {
      const sequence = await createSequence({ ...body, organization_id: organizationId });
      return NextResponse.json({ ok:true, sequence }, { status:201 });
    }
    if (body.type === "enroll") {
      const leads = Array.isArray(body.leads) ? body.leads : [];
      const billableCount = Math.max(1, leads.length);
      await assertFluxCreditsAvailable(organizationId, "whatsapp_follow_up_reminder", billableCount);
      const enrollments = await enrollLeads({ ...body, organization_id: organizationId, leads });
      await reserveFluxCredits({
        organizationId,
        action: "whatsapp_follow_up_reminder",
        quantity: Math.max(1, enrollments.length || billableCount),
        source: "followup-control",
        metadata: { sequence_id: body.sequence_id, leads: enrollments.length || billableCount, admin_email: session.email },
      });
      return NextResponse.json({ ok:true, enrollments }, { status:201 });
    }
    return NextResponse.json({ error:"Unsupported follow-up action." }, { status:400 });
  } catch (error) {
    const status = error instanceof Error && ["FluxFeatureGateError", "FluxCreditLimitError"].includes(error.name) ? 402 : 400;
    return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to save follow-up changes." }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error:"Unauthorized" }, { status:401 });
  try {
    const body = await request.json();
    if (!body.id || !body.action) return NextResponse.json({ error:"Enrollment ID and action are required." }, { status:400 });
    const enrollment = await updateEnrollment(String(body.id), String(body.action), body.value ? String(body.value) : undefined);
    return NextResponse.json({ ok:true, enrollment:enrollment[0] || null });
  } catch (error) {
    return NextResponse.json({ error:error instanceof Error ? error.message : "Unable to update enrollment." }, { status:400 });
  }
}
