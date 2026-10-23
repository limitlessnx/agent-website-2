import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { getOrganizationAccessContext, assertAnyOrganizationPermission } from "@/lib/organization-membership";
import { createAdminClient } from "@/lib/supabase/admin";

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const access = await getOrganizationAccessContext(session.organizationId, session.userId);
    assertAnyOrganizationPermission(access, ["customers.manage"]);
  } catch {
    return NextResponse.json({ error: "customers.manage permission required." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "A valid enquiry is required." }, { status: 400 });
  }

  const fullName = clean(body.fullName, 160);
  const email = clean(body.email, 254).toLowerCase();
  const phone = clean(body.phone, 40);
  const source = clean(body.source, 100) || "manual";
  const serviceInterest = clean(body.serviceInterest, 180);
  const summary = clean(body.summary, 2000);

  if (!fullName) return NextResponse.json({ error: "Client name is required." }, { status: 400 });
  if (!email && !phone) return NextResponse.json({ error: "Add an email address or phone number so the client can be contacted." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const admin = createAdminClient();
  const [emailMatch, phoneMatch] = await Promise.all([
    email ? admin.from("crm_customers").select("id,full_name,email,phone,profile").eq("organization_id", session.organizationId).eq("email", email).maybeSingle() : Promise.resolve({ data: null, error: null }),
    phone ? admin.from("crm_customers").select("id,full_name,email,phone,profile").eq("organization_id", session.organizationId).eq("phone", phone).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (emailMatch.error || phoneMatch.error) return NextResponse.json({ error: "Unable to check existing client records." }, { status: 500 });
  if (emailMatch.data && phoneMatch.data && emailMatch.data.id !== phoneMatch.data.id) {
    return NextResponse.json({ error: "The email and phone match different client records. Review the possible duplicate before creating this enquiry." }, { status: 409 });
  }

  const existing = emailMatch.data || phoneMatch.data;
  let customerId = existing?.id || "";
  let createdCustomer = false;

  if (!existing) {
    const { data: customer, error } = await admin.from("crm_customers").insert({
      organization_id: session.organizationId,
      full_name: fullName,
      email: email || null,
      phone: phone || null,
      status: "active",
      profile: { preferred_channel: phone ? "whatsapp" : "email", service_interest: serviceInterest || null, notes: "" },
      metadata: { created_from: "xposure_enquiry_form" },
    }).select("id").single();

    if (error || !customer) {
      if (error?.code === "23505") return NextResponse.json({ error: "A client with this email or phone already exists. Refresh the client list and retry against that record." }, { status: 409 });
      return NextResponse.json({ error: "Unable to create the client record." }, { status: 500 });
    }
    customerId = customer.id;
    createdCustomer = true;
  }

  const { data: lead, error: leadError } = await admin.from("crm_leads").insert({
    organization_id: session.organizationId,
    customer_id: customerId,
    source,
    stage: "new",
    currency: "NGN",
    summary: summary || (serviceInterest ? "Interested in " + serviceInterest : "New client enquiry"),
    details: { service_interest: serviceInterest || null, captured_by: "portal" },
  }).select("id,customer_id,stage,source,summary,created_at").single();

  if (leadError || !lead) {
    if (createdCustomer) {
      // Keep the new client record: deleting it could cascade-delete an enquiry created
      // concurrently by another request. Tell the caller to reuse this record on retry.
      return NextResponse.json({
        error: "Unable to save the enquiry. The client record was created, but the enquiry was not saved. Reuse this client record when retrying to avoid duplicates.",
        customerId,
        clientCreated: true,
      }, { status: 500 });
    }
    return NextResponse.json({
      error: "Unable to save the enquiry. The existing client record was not changed.",
      customerId,
      clientCreated: false,
    }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lead, customerId, reusedExistingClient: Boolean(existing) }, { status: 201 });
}
