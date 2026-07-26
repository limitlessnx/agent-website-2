import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const organizationId = String(body.organizationId || "").trim();
    const templateSlug = String(body.templateSlug || "").trim();

    if (!organizationId) return NextResponse.json({ error: "Organization ID is required." }, { status: 400 });
    if (!templateSlug) return NextResponse.json({ error: "Organization template is required." }, { status: 400 });

    const result = await supabaseServerRequest<Record<string, unknown>>(
      "rpc/provision_organization_template",
      {
        method: "POST",
        body: JSON.stringify({
          p_organization_id: organizationId,
          p_template_slug: templateSlug,
          p_actor_user_id: session.userId || null,
        }),
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to provision organization template." },
      { status: 400 },
    );
  }
}
