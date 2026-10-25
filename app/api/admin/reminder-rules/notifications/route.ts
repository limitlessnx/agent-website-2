import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const access = await authorizeXposureTenantAccess("workflows.read");
  if (!access.ok) return access.response;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_reminder_notifications").select("id,rule_id,execution_id,title,body,status,created_at,read_at").eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    return NextResponse.json({ notifications: data || [] });
  } catch { return NextResponse.json({ error: "Unable to load tenant reminder notifications." }, { status: 500 }); }
}
