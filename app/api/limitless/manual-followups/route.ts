import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { resolveAdminOrganizationScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFluxFeatureAccess } from "@/lib/flux-credits";
import { computeSequenceStepDueAt, resolveFollowUpPolicy } from "@/lib/follow-up-policy";
import { LIMITLESS_FOLLOWUP_STAGES, LIMITLESS_REALTY_ORGANIZATION_ID } from "@/lib/limitless-followup-contract";

export const dynamic = "force-dynamic";

async function context() {
  const session = await getAdminSession();
  if (!session) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const scope = await resolveAdminOrganizationScope();
  if (scope.organizationId !== LIMITLESS_REALTY_ORGANIZATION_ID || scope.slug !== "limitless-realty" || scope.status !== "active")
    return { response: NextResponse.json({ error: "Switch to the active Limitless Realty workspace before activating a follow-up." }, { status: 403 }) };
  return { organizationId: scope.organizationId, actor: `admin:${session.email}`, admin: createAdminClient() };
}

export async function GET() {
  const access = await context();
  if (access.response) return access.response;
  const { data, error } = await access.admin.from("properties").select("id,title").eq("organization_id", access.organizationId).order("title");
  if (error) return NextResponse.json({ error: "Unable to load properties. Please retry." }, { status: 503 });
  return NextResponse.json({ properties: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const access = await context();
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  const leadId = typeof body?.lead_id === "string" ? body.lead_id.trim() : "";
  const propertyId = typeof body?.property_id === "string" ? body.property_id.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(leadId) || !uuid.test(propertyId) || !reason || reason.length > 2000 || notes.length > 4000 || body?.consent_confirmed !== true)
    return NextResponse.json({ error: "Select a lead and property, enter a reason and confirm the customer's WhatsApp follow-up permission." }, { status: 400 });
  try { await assertFluxFeatureAccess(access.organizationId, "follow_ups"); }
  catch { return NextResponse.json({ error: "Follow-ups are not enabled for this workspace's plan." }, { status: 409 }); }
  const property = await access.admin.from("properties").select("id,title").eq("organization_id", access.organizationId).eq("id", propertyId).maybeSingle();
  if (property.error) return NextResponse.json({ error: "Unable to verify the selected property." }, { status: 503 });
  if (!property.data) return NextResponse.json({ error: "Property was not found in Limitless Realty." }, { status: 404 });
  const propertyTitle = property.data.title;
  try {
    const policy = await resolveFollowUpPolicy(access.organizationId, "limitless-realty");
    const now = new Date();
    const anchor = new Date(now.getTime() + 86_400_000).toISOString();
    const steps = LIMITLESS_FOLLOWUP_STAGES.map((day, index) => {
      const due = index === 0 ? now.toISOString() : computeSequenceStepDueAt(policy, anchor, index + 1);
      if (!due) throw new Error("The follow-up schedule is incomplete.");
      return { sequence_step_key: `day-${day}`, stage: index + 1, scheduled_at: due, due_at: due,
        message_sent: `Checking in about ${propertyTitle}. Would you like updated availability or help arranging a viewing?` };
    });
    const { data, error } = await access.admin.rpc("activate_limitless_manual_followup", {
      p_organization_id: access.organizationId, p_lead_id: leadId, p_property_id: propertyId,
      p_reason: reason, p_notes: notes, p_actor: access.actor, p_consent_confirmed: true, p_steps: steps,
    });
    if (error?.code === "PGRST202" || error?.code === "42883") return NextResponse.json({ error: "Manual activation is not available yet. The reviewed database update must be released first." }, { status: 503 });
    if (error) return NextResponse.json({ error: error.code === "P0001" ? error.message : "Unable to activate follow-up. No activation was confirmed." }, { status: 409 });
    if (!data || data.status !== "active" || !data.sequence_id) return NextResponse.json({ error: "Activation could not be confirmed. Check Follow-up Control before trying again." }, { status: 503 });
    return NextResponse.json({ ...data, delivery_status: "not_sent", message: data.created
      ? "Follow-up activated. The first step is queued now for the follow-up runner; delivery is not yet confirmed."
      : "This follow-up is already active. No duplicate sequence was created." }, { status: data.created ? 201 : 200 });
  } catch { return NextResponse.json({ error: "Unable to prepare or confirm activation. Check Follow-up Control before trying again." }, { status: 503 }); }
}
