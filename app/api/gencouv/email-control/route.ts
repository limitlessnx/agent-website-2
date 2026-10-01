import { NextResponse } from "next/server";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const GENCOUV_ORG_ID = "05737e03-f8f0-4202-8e9b-0a8982a1091c";
const CAMPAIGN_KEY = "gencouv_long_form_copy_trading";

const controlUrl = process.env.GENCOUV_EMAIL_CONTROL_API_URL?.trim() || "";

export async function POST(request: Request) {
  const secret = process.env.GENCOUV_DASHBOARD_SECRET;

  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        error: "missing_dashboard_secret",
        message: "GENCOUV_DASHBOARD_SECRET is not configured.",
      },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const dailyLimit = Number(body.daily_limit);

  if (action === "update_daily_limit" && Number.isFinite(dailyLimit)) {
    await supabaseServerRequest("gencouv_campaign_settings?on_conflict=organization_id,campaign_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({
        organization_id: GENCOUV_ORG_ID,
        campaign_key: CAMPAIGN_KEY,
        daily_send_limit: Math.max(1, Math.min(30, dailyLimit)),
        sending_enabled: false,
        status: "paused",
        updated_at: new Date().toISOString(),
      }),
    }).catch(() => undefined);
  }

  if (!controlUrl) return NextResponse.json({ success: false, error: "email_control_endpoint_not_configured" }, { status: 503 });

  const response = await fetch(controlUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-gencouv-dashboard-secret": secret,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({
    success: false,
    error: "invalid_control_response",
    message: "The Gencouv control endpoint returned an unreadable response.",
  }));

  return NextResponse.json(data, { status: response.status });
}
