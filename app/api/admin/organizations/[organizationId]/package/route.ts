import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { assignOrganizationServicePackage, getOrganizationPackageSnapshot, listServicePackages } from "@/lib/organization-package-service";

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error("Unauthorized.");
  return session;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    await requireAdmin();
    const { organizationId } = await context.params;
    const [snapshot, packages] = await Promise.all([
      getOrganizationPackageSnapshot(organizationId),
      listServicePackages(),
    ]);
    return NextResponse.json({ snapshot, packages });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load organization package.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    await requireAdmin();
    const { organizationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const packageSlug = String(body.packageSlug || "").trim();
    if (!packageSlug) return NextResponse.json({ error: "packageSlug is required." }, { status: 400 });

    const result = await assignOrganizationServicePackage({
      organizationId,
      packageSlug,
      metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
    });
    return NextResponse.json({ ok: true, result, snapshot: await getOrganizationPackageSnapshot(organizationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to assign organization package.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}
