import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const access = await authorizeXposureTenantAccess("workflows.read");
  if (!access.ok) return access.response;
  const { data, error } = await createAdminClient()
    .from("tenant_appointment_reminder_notifications")
    .select("id,appointment_id,reminder_id,title,body,status,created_at,read_at")
    .eq("organization_id", access.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Unable to load appointment reminders. Confirm the lifecycle migration is applied." }, { status: 500 });
  return NextResponse.json({ notifications: data || [] });
}
