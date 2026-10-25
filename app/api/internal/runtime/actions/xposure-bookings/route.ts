import { NextRequest, NextResponse } from "next/server";
import { assertRuntimeSecret } from "@/lib/runtime/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const serviceTypes = new Set(["photography", "studio_rental", "wedding", "videography", "custom"]);

/** Creates a pending Xposure booking from an authenticated Maia runtime execution. It never confirms bookings. */
export async function POST(request: NextRequest) {
  try {
    assertRuntimeSecret(request.headers.get("x-runtime-secret"));
    const body = record(await request.json().catch(() => ({})));
    const organizationId = text(body.organization_id, 80);
    const agentId = text(body.agent_id, 80);
    const executionId = text(body.execution_id, 80);
    const idempotencyKey = text(body.idempotency_key, 180);
    const customerName = text(body.customer_name, 180);
    const customerPhone = text(body.customer_phone, 30).replace(/[^+\d]/g, "");
    const serviceType = text(body.service_type, 40);
    const packageName = text(body.package_name, 180) || null;
    const details = record(body.service_details);
    const amountMinor = Number(body.amount_minor);
    const startAt = text(body.requested_start_at, 80);
    const endAt = text(body.requested_end_at, 80);

    if (!organizationId || !agentId || !executionId || !idempotencyKey || !customerName || customerPhone.replace(/\D/g, "").length < 7 || !serviceTypes.has(serviceType)) {
      return NextResponse.json({ error: "Required booking details are missing or invalid." }, { status: 400 });
    }
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || amountMinor > 100_000_000_00) return NextResponse.json({ error: "A valid amount in minor currency units is required." }, { status: 400 });
    if ((startAt && !Number.isFinite(Date.parse(startAt))) || (endAt && !Number.isFinite(Date.parse(endAt))) || (startAt && endAt && Date.parse(endAt) <= Date.parse(startAt))) return NextResponse.json({ error: "Requested date/time interval is invalid." }, { status: 400 });
    if (["wedding", "videography", "custom"].includes(serviceType) && details.staff_approved_quote !== true) return NextResponse.json({ error: "Custom services require staff quote approval before a payable booking can be created." }, { status: 409 });

    const admin = createAdminClient();
    const { data: organization, error: orgError } = await admin.from("organizations").select("id,slug,status").eq("id", organizationId).maybeSingle();
    if (orgError) return NextResponse.json({ error: "Unable to verify tenant." }, { status: 503 });
    if (!organization || organization.slug !== "xposure" || organization.status !== "active") return NextResponse.json({ error: "This runtime action is restricted to the active Xposure tenant." }, { status: 403 });

    const { data: execution, error: executionError } = await admin.from("runtime_executions").select("id,organization_id,agent_id,conversation_id")
      .eq("id", executionId).eq("organization_id", organizationId).eq("agent_id", agentId).maybeSingle();
    if (executionError) return NextResponse.json({ error: "Unable to validate runtime execution." }, { status: 503 });
    if (!execution) return NextResponse.json({ error: "Runtime execution does not match this tenant and agent." }, { status: 403 });

    const row = {
      organization_id: organizationId, customer_name: customerName, customer_phone: customerPhone,
      service_type: serviceType, package_name: packageName, service_details: details,
      requested_start_at: startAt ? new Date(startAt).toISOString() : null,
      requested_end_at: endAt ? new Date(endAt).toISOString() : null,
      amount_minor: amountMinor, currency: "NGN", booking_status: "pending", payment_status: "unpaid",
      follow_up_state: "awaiting_payment", idempotency_key: idempotencyKey, conversation_id: execution.conversation_id || null,
    };
    const { data, error } = await admin.from("xposure_bookings").upsert(row, { onConflict: "organization_id,idempotency_key", ignoreDuplicates: true })
      .select("id,booking_status,payment_status,amount_minor,currency,requested_start_at,requested_end_at").maybeSingle();
    if (error) return NextResponse.json({ error: "Pending booking could not be recorded." }, { status: 503 });
    if (data) return NextResponse.json({ created: true, booking: data }, { status: 201 });
    const { data: existing, error: existingError } = await admin.from("xposure_bookings").select("id,booking_status,payment_status,amount_minor,currency,requested_start_at,requested_end_at")
      .eq("organization_id", organizationId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existingError || !existing) return NextResponse.json({ error: "Idempotent booking result could not be recovered." }, { status: 503 });
    return NextResponse.json({ created: false, booking: existing }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && /runtime secret/i.test(error.message)) return NextResponse.json({ error: "Unauthorized runtime request." }, { status: 401 });
    return NextResponse.json({ error: "Unable to create Xposure booking." }, { status: 500 });
  }
}
