import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeXposureAppointmentManagement } from "@/lib/xposure-appointment-authorization";

function capacityFrom(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) return null;
  return parsed;
}

export async function GET() {
  const auth = await authorizeXposureAppointmentManagement();
  if (!auth.ok) return auth.response;
  const { data, error } = await createAdminClient()
    .from("appointment_availability_settings")
    .select("availability_configuration")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to load appointment availability settings." }, { status: 500 });
  const config = (data?.availability_configuration || {}) as Record<string, unknown>;
  const capacity = capacityFrom(config.maxConcurrentAppointments) ?? 1;
  return NextResponse.json({ maxConcurrentAppointments: capacity, defaultCapacity: 1, maximumAllowed: 100 });
}

export async function PUT(request: Request) {
  const auth = await authorizeXposureAppointmentManagement();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "A JSON request body is required." }, { status: 400 });
  }
  const capacity = capacityFrom(body.maxConcurrentAppointments);
  if (capacity === null) {
    return NextResponse.json({ error: "maxConcurrentAppointments must be an integer from 1 to 100." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: current, error: readError } = await admin
    .from("appointment_availability_settings")
    .select("availability_configuration")
    .eq("organization_id", auth.organizationId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: "Unable to read current appointment settings." }, { status: 500 });

  const availabilityConfiguration = {
    ...((current?.availability_configuration || {}) as Record<string, unknown>),
    maxConcurrentAppointments: capacity,
  };
  const { error } = await admin
    .from("appointment_availability_settings")
    .upsert({
      organization_id: auth.organizationId,
      availability_configuration: availabilityConfiguration,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
  if (error) return NextResponse.json({ error: "Unable to save appointment capacity settings." }, { status: 500 });
  return NextResponse.json({ saved: true, maxConcurrentAppointments: capacity });
}
