import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { provisionOrganizationN8nProject } from "@/lib/n8n-organization-provisioning";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const { organizationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const rows = await supabaseServerRequest<Array<{
      id: string;
      name: string;
      slug: string;
      settings?: Record<string, unknown> | null;
    }>>(
      `organizations?select=id,name,slug,settings&id=eq.${encodeURIComponent(organizationId)}&limit=1`,
    );
    const organization = rows[0];
    if (!organization) return NextResponse.json({ error: "Organization not found." }, { status: 404 });

    const projects = await supabaseServerRequest<Array<{ id: string }>>(
      `projects?select=id&organization_id=eq.${encodeURIComponent(organizationId)}&order=created_at.asc&limit=1`,
    );
    if (!projects[0]) return NextResponse.json({ error: "Organization project not found." }, { status: 404 });

    const result = await provisionOrganizationN8nProject(
      {
        organization_id: organization.id,
        organization_name: organization.name,
        organization_slug: organization.slug,
        provisioning: { project_id: projects[0].id },
      },
      {
        timezone: String(organization.settings?.timezone || "Africa/Lagos"),
        force: Boolean(body.force),
      },
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to synchronize organization with n8n." },
      { status: 400 },
    );
  }
}
