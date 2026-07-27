import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { provisionOrganizationN8nProject } from "@/lib/n8n-organization-provisioning";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type ProvisionedResult = {
  ok?: boolean;
  organization_id?: string;
  organization_name?: string;
  organization_slug?: string;
  provisioning?: Record<string, unknown>;
};

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

    const rows = await supabaseServerRequest<ProvisionedResult[]>(
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

    const result = rows[0];
    if (!result?.organization_id || !result.organization_name || !result.organization_slug) {
      throw new Error("Organization provisioning did not return the required organization details.");
    }

    let n8nProvisioning: Record<string, unknown>;
    try {
      n8nProvisioning = await provisionOrganizationN8nProject(
        {
          organization_id: result.organization_id,
          organization_name: result.organization_name,
          organization_slug: result.organization_slug,
          provisioning: result.provisioning,
        },
        { timezone },
      );
    } catch (error) {
      n8nProvisioning = {
        configured: true,
        created: false,
        error: error instanceof Error ? error.message : "n8n project provisioning failed.",
      };
    }

    return NextResponse.json({ ok: true, result, n8n: n8nProvisioning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create and provision organization." },
      { status: 400 },
    );
  }
}
