import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

const allowedStatuses = new Set(["submitted", "configuration", "testing", "awaiting_approval", "live", "paused"]);

export async function PATCH(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    const status = String(body.status || "").trim();
    if (!id) return NextResponse.json({ error: "Onboarding record ID is required." }, { status: 400 });
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: "Invalid onboarding status." }, { status: 400 });

    const rows = await supabaseServerRequest<Array<{ id: string; status: string }>>(
      `client_onboarding_profiles?id=eq.${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
    if (!rows[0]) return NextResponse.json({ error: "Onboarding record was not found." }, { status: 404 });
    return NextResponse.json({ ok: true, profile: rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update onboarding status." }, { status: 400 });
  }
}
