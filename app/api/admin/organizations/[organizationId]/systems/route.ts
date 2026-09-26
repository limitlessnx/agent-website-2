import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { listTenantSystems, requestTenantSystem } from "@/lib/tenant-system-management";

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
    return NextResponse.json({ systems: await listTenantSystems(organizationId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load organization systems.";
    return NextResponse.json({ error: message }, { status: message === "Unauthorized." ? 401 : 400 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    await requireAdmin();
    const { organizationId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const systemSlug = String(body.systemSlug || "").trim();
    if (!systemSlug) return NextResponse.json({ error: "systemSlug is required." }, { status: 400 });

    const result = await requestTenantSystem({
      organizationId,
      systemSlug,
      configuration: typeof body.configuration === "object" && body.configuration ? body.configuration : {},
    });
    return NextResponse.json({ ok: true, result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to request organization system.";
    const status = /limit|entitlement|included|package/i.test(message) ? 409 : message === "Unauthorized." ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
