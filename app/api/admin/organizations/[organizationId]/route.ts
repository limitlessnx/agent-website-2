import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { isSameOriginAdminRequest } from "@/lib/admin-request-origin";
import { archiveAdminOrganization, OrganizationArchiveError } from "@/lib/admin-organization-archive";

export async function DELETE(request: Request, context: { params: Promise<{ organizationId: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!isSameOriginAdminRequest(request)) return NextResponse.json({ error: "Same-origin request required." }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Confirmation and reason are required." }, { status: 400 });
  const { organizationId } = await context.params;
  try { return NextResponse.json({ ok: true, ...await archiveAdminOrganization(session, organizationId, body) }); }
  catch (error) { return NextResponse.json({ error: error instanceof OrganizationArchiveError ? error.message : "Archiving could not be confirmed. Refresh before retrying." }, { status: error instanceof OrganizationArchiveError ? error.status : 503 }); }
}
