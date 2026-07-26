import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const onboardingId = String(body.onboardingId || "").trim();
    if (!onboardingId) {
      return NextResponse.json({ error: "Onboarding record is required." }, { status: 400 });
    }

    const result = await supabaseServerRequest("rpc/prepare_onboarding_delivery", {
      method: "POST",
      body: JSON.stringify({ p_onboarding_id: onboardingId, p_actor_email: session.email || null }),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to prepare client delivery." },
      { status: 400 },
    );
  }
}
