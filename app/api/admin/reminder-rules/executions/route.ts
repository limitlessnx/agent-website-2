import { NextResponse } from "next/server";
import { authorizeXposureTenantAccess } from "@/lib/xposure-tenant-authorization";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const access = await authorizeXposureTenantAccess("workflows.read");
  if (!access.ok) return access.response;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("tenant_reminder_executions")
      .select("id,rule_id,scheduled_for,status,channel,attempt_count,last_error,result,started_at,completed_at,created_at")
      .eq("organization_id", access.organizationId).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const ruleIds = [...new Set((data || []).map((item) => item.rule_id).filter(Boolean))];
    const { data: rules, error: rulesError } = ruleIds.length
      ? await admin.from("tenant_reminder_rules").select("id,name").eq("organization_id", access.organizationId).in("id", ruleIds)
      : { data: [], error: null };
    if (rulesError) throw rulesError;
    const names = new Map((rules || []).map((rule) => [rule.id, rule.name]));
    return NextResponse.json({ executions: (data || []).map((item) => ({ ...item, rule_name: names.get(item.rule_id) || "Archived reminder" })) });
  } catch {
    return NextResponse.json({ error: "Unable to load reminder execution history." }, { status: 500 });
  }
}
