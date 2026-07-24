import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { provisionClientOrganization } from "@/lib/client-onboarding";

export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await provisionClientOrganization({
      userId: String(body.user_id || body.userId || ""),
      organizationName: String(body.organization_name || body.organizationName || ""),
      organizationSlug: body.organization_slug || body.organizationSlug || undefined,
      templateSlug: body.template_slug || body.templateSlug || undefined,
      agentFamilyName: body.agent_family_name || body.agentFamilyName || undefined,
    });

    return NextResponse.json({ ok: true, organization: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to provision client organization.";
    const status = message.includes("already has") ? 409 : message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
