import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const templateSlug = String(body.templateSlug || "").trim();
    const industry = String(body.industry || "").trim();
    const businessEmail = String(body.businessEmail || "").trim();
    const country = String(body.country || "Nigeria").trim();
    const timezone = String(body.timezone || "Africa/Lagos").trim();

    if (!name) return NextResponse.json({ error: "Organization name is required." }, { status: 400 });
    if (!templateSlug) return NextResponse.json({ error: "Organization template is required." }, { status: 400 });
    if (businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(businessEmail)) {
      return NextResponse.json({ error: "Enter a valid business email." }, { status: 400 });
    }

    const result = await supabaseServerRequest<Record<string, unknown>>(
      "rpc/create_and_provision_organization",
      {
        method: "POST",
        body: JSON.stringify({
          p_name: name,
          p_template_slug: templateSlug,
          p_industry: industry || null,
          p_business_email: businessEmail || null,
          p_country: country || "Nigeria",
          p_timezone: timezone || "Africa/Lagos",
          p_actor_user_id: null,
        }),
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create and provision organization." },
      { status: 400 },
    );
  }
}
