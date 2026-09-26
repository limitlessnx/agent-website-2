import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import { listOrganizationMembers, updateOrganizationMemberAccess } from "@/lib/organization-membership";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Organization member request failed.";
  const status = /authentication|membership required/i.test(message) ? 401 : /permission|authorized/i.test(message) ? 403 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const members = await listOrganizationMembers(session.organizationId, session.userId);
    return NextResponse.json({ members });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const membershipId = String(body.membership_id || "").trim();
    const role = body.role ? String(body.role).trim() : undefined;
    const status = body.status ? String(body.status).trim() : undefined;

    if (!membershipId) return NextResponse.json({ error: "membership_id is required." }, { status: 400 });
    if (role && !["manager", "supervisor", "team-member"].includes(role)) {
      return NextResponse.json({ error: "Invalid organization role." }, { status: 400 });
    }
    if (status && !["active", "suspended", "removed"].includes(status)) {
      return NextResponse.json({ error: "Invalid membership status." }, { status: 400 });
    }
    if (!role && !status) return NextResponse.json({ error: "A role or status change is required." }, { status: 400 });

    const result = await updateOrganizationMemberAccess({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      membershipId,
      role: role as "manager" | "supervisor" | "team-member" | undefined,
      status: status as "active" | "suspended" | "removed" | undefined,
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return failure(error);
  }
}
