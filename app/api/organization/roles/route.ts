import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { listOrganizationRolePresets, setOrganizationRolePermissions } from "@/lib/organization-membership";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Organization role request failed.";
  const status = /authentication|membership required/i.test(message) ? 401 : /permission|authorized/i.test(message) ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const roles = await listOrganizationRolePresets(session.organizationId, session.userId);
    return NextResponse.json({ roles });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const role = String(body.role || "").trim();
    const permissions = Array.isArray(body.permissions) ? body.permissions.map(String) : [];

    if (!["manager", "supervisor", "team-member"].includes(role)) {
      return NextResponse.json({ error: "Only Manager, Supervisor, and Team Member permissions can be customized." }, { status: 400 });
    }

    const result = await setOrganizationRolePermissions({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      role: role as "manager" | "supervisor" | "team-member",
      permissions,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return failure(error);
  }
}
