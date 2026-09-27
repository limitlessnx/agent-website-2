import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import {
  createOrganizationInvitation,
  listOrganizationInvitations,
  revokeOrganizationInvitation,
} from "@/lib/organization-membership";

function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "Organization invitation request failed.";
  const status = /authentication|membership required/i.test(message) ? 401 : /permission|authorized/i.test(message) ? 403 : /seat limit/i.test(message) ? 409 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const invitations = await listOrganizationInvitations(session.organizationId, session.userId);
    return NextResponse.json({ invitations });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "team-member").trim();
    const expiresInHours = Number(body.expires_in_hours || 72);

    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    if (!["manager", "supervisor", "team-member"].includes(role)) {
      return NextResponse.json({ error: "Invalid organization role." }, { status: 400 });
    }

    const invitation = await createOrganizationInvitation({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      email,
      role: role as "manager" | "supervisor" | "team-member",
      expiresInHours: Number.isFinite(expiresInHours) ? expiresInHours : 72,
    });

    return NextResponse.json({ ok: true, invitation }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getClientSession();
    if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const invitationId = String(body.invitation_id || "").trim();
    if (!invitationId) return NextResponse.json({ error: "invitation_id is required." }, { status: 400 });

    await revokeOrganizationInvitation({
      organizationId: session.organizationId,
      actorUserId: session.userId,
      invitationId,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
