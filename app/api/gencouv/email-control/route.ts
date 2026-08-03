import { NextResponse } from "next/server";

const controlUrl =
  process.env.GENCOUV_EMAIL_CONTROL_API_URL ||
  "https://n8n.srv1720757.hstgr.cloud/webhook/gencouv-email-control";

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
    error: "invalid_n8n_response",
    message: "The Gencouv control workflow returned an unreadable response.",
  }));

  return NextResponse.json(data, { status: response.status });
}
