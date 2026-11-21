import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { requireAdminSystemScope } from "@/lib/admin-organization-scope";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const key = "gencouv_long_form_copy_trading";
const headers = { "Cache-Control": "private, no-store" };
async function orgId() {
  if (!(await getAdminSession())) return null;
  try {
    const scope = await requireAdminSystemScope("gencouv");
    return scope.status === "unavailable" ? null : scope.organizationId;
  } catch { return null; }
}
export async function GET() {
  const org = await orgId();
  if (!org) return NextResponse.json({ error: "Gencouv admin workspace required." }, { status: 403, headers });
  const db = createAdminClient();
  const { data, error } = await db.from("gencouv_campaign_settings").select("sending_enabled,daily_send_limit,status").eq("organization_id", org).eq("campaign_key", key).maybeSingle();
  if (error) return NextResponse.json({ error: "Campaign settings unavailable." }, { status: 503, headers });
  return NextResponse.json({ enabled: data?.sending_enabled === true, daily_limit: data?.daily_send_limit || 10 }, { headers });
}
export async function POST(request: NextRequest) {
  const org = await orgId();
  if (!org) return NextResponse.json({ error: "Gencouv admin workspace required." }, { status: 403, headers });
  if (request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403, headers });
  const input = await request.json().catch(() => null);
  if (!input || typeof input.enabled !== "boolean" || input.confirmed !== true) return NextResponse.json({ error: "Explicit campaign state and confirmation required." }, { status: 400, headers });
  const db = createAdminClient();
  const { data: current, error: readError } = await db.from("gencouv_campaign_settings").select("daily_send_limit").eq("organization_id", org).eq("campaign_key", key).maybeSingle();
  if (readError) return NextResponse.json({ error: "Campaign settings unavailable." }, { status: 503, headers });
  const { error } = await db.from("gencouv_campaign_settings").upsert({
    organization_id: org, campaign_key: key, sending_enabled: input.enabled,
    status: input.enabled ? "active" : "paused", daily_send_limit: current?.daily_send_limit || 10,
    updated_at: new Date().toISOString()
  }, { onConflict: "organization_id,campaign_key" });
  if (error) return NextResponse.json({ error: "Could not save campaign state." }, { status: 503, headers });
  return NextResponse.json({ enabled: input.enabled, note: input.enabled ? "Automated outbound campaigns enabled in Gencouv settings. Delivery depends on the connected automation worker." : "Automated outbound campaigns paused. Manual one-time emails remain available." }, { headers });
}
