import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

const leadStages = new Set(["new", "qualified", "contacted", "nurturing", "appointment", "won", "lost", "disqualified"]);

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const access = await getOrganizationAccessContext(session.organizationId, session.userId);
    assertAnyOrganizationPermission(access, ["customers.manage"]);
  } catch {
    return NextResponse.json({ error: "customers.manage permission required." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const stage = body && typeof body === "object" && !Array.isArray(body) ? String(body.stage || "") : "";
  if (!leadStages.has(stage)) return NextResponse.json({ error: "Choose a valid enquiry stage." }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crm_leads")
    .update({ stage, updated_at: new Date().toISOString() })
    .eq("organization_id", session.organizationId)
    .eq("id", id)
    .select("id,customer_id,stage,source,score,summary,updated_at")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to update enquiry stage." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Enquiry was not found in this workspace." }, { status: 404 });
  return NextResponse.json({ ok: true, lead: data });
}
