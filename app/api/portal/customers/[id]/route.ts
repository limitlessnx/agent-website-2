import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

const customerStatuses = new Set(["active", "inactive", "blocked", "archived"]);
const preferredChannels = new Set(["", "whatsapp", "email", "phone", "sms"]);

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let access;
  try {
    access = await getOrganizationAccessContext(session.organizationId, session.userId);
    assertAnyOrganizationPermission(access, ["customers.manage"]);
  } catch {
    return NextResponse.json({ error: "customers.manage permission required." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid customer update is required." }, { status: 400 });
  }

  const fullName = clean(body.fullName, 160);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const companyName = clean(body.companyName, 180);
  const status = clean(body.status, 20);
  const notes = clean(body.notes, 4000);
  const preferredChannel = clean(body.preferredChannel, 20);
  const timezone = clean(body.timezone, 80);
  const serviceInterest = clean(body.serviceInterest, 180);

  if (!fullName && !companyName) {
    return NextResponse.json({ error: "Enter a client name or company name." }, { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (!customerStatuses.has(status)) {
    return NextResponse.json({ error: "Choose a valid client status." }, { status: 400 });
  }
  if (!preferredChannels.has(preferredChannel)) {
    return NextResponse.json({ error: "Choose a valid preferred contact channel." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing, error: lookupError } = await admin
    .from("crm_customers")
    .select("id,profile")
    .eq("organization_id", session.organizationId)
    .eq("id", id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "Unable to load this client profile." }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Client was not found in this workspace." }, { status: 404 });

  const profile = existing.profile && typeof existing.profile === "object" && !Array.isArray(existing.profile)
    ? existing.profile as Record<string, unknown>
    : {};

  const { data, error } = await admin
    .from("crm_customers")
    .update({
      full_name: fullName || null,
      email: email || null,
      phone: phone || null,
      company_name: companyName || null,
      status,
      profile: {
        ...profile,
        notes,
        preferred_channel: preferredChannel || null,
        timezone: timezone || null,
        service_interest: serviceInterest || null,
      },
    })
    .eq("organization_id", session.organizationId)
    .eq("id", id)
    .select("id,full_name,email,phone,company_name,status,profile,updated_at")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A client with this email or phone already exists in this workspace. Review the possible duplicate before saving." }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to save this client profile." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Client was not found in this workspace." }, { status: 404 });
  return NextResponse.json({ ok: true, customer: data });
}
