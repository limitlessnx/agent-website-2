import { NextRequest, NextResponse } from "next/server";
import { getManagerSession, getMembershipForOrganization, setClientSession } from "@/lib/client-auth";
import { supabaseServerRequest } from "@/lib/supabase-server-rest";

type AccessRequestRow = { id: string; organization_id: string; status: string; created_at: string; organizations?: { name?: string } | Array<{ name?: string }> };

export async function GET() {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: "Manager session required." }, { status: 401 });
  try {
    const rows = await supabaseServerRequest<AccessRequestRow[]>(
      `organization_access_requests?requester_user_id=eq.${encodeURIComponent(session.userId)}&select=id,organization_id,status,created_at,organizations(name)&order=created_at.desc`,
    );
    return NextResponse.json({
      requests: rows.map((row) => ({
        id: row.id,
        organization_id: row.organization_id,
        organization_name: Array.isArray(row.organizations) ? row.organizations[0]?.name || "Organization" : row.organizations?.name || "Organization",
        status: row.status,
        created_at: row.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Unable to load organization access requests." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getManagerSession();
  if (!session) return NextResponse.json({ error: "Manager session required." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "request");

  if (action === "enter") {
    const organizationId = String(body.organization_id || "").trim();
    if (!organizationId) return NextResponse.json({ error: "Organization is required." }, { status: 400 });
    const membership = await getMembershipForOrganization(session.userId, organizationId);
    if (!membership) return NextResponse.json({ error: "Approved organization membership not found." }, { status: 403 });
    await setClientSession({
      userId: session.userId,
      email: session.email,
      organizationId: membership.organizationId,
      organizationSlug: membership.organizationSlug,
      membershipId: membership.membershipId,
      role: membership.role,
      issuedAt: Date.now(),
    });
    return NextResponse.json({ ok: true, redirect_to: "/portal" });
  }

  const code = String(body.access_code || "").trim().toUpperCase();
  if (!/^FLX-[A-Z0-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Enter a valid Organization Access ID, such as FLX-XXXXXXXX." }, { status: 400 });
  }

  try {
    const organizations = await supabaseServerRequest<Array<{ id: string; name: string }>>(
      `organizations?manager_access_code=eq.${encodeURIComponent(code)}&status=eq.active&select=id,name&limit=1`,
    );
    const organization = organizations[0];
    if (!organization) return NextResponse.json({ error: "Organization Access ID is invalid or the organization is inactive." }, { status: 404 });

    const membership = await supabaseServerRequest<Array<{ id: string; status: string }>>(
      `organization_memberships?organization_id=eq.${encodeURIComponent(organization.id)}&user_id=eq.${encodeURIComponent(session.userId)}&status=eq.active&select=id,status&limit=1`,
    );
    if (membership.length) return NextResponse.json({ error: "You already have access to this organization." }, { status: 409 });

    const pending = await supabaseServerRequest<Array<{ id: string }>>(
      `organization_access_requests?organization_id=eq.${encodeURIComponent(organization.id)}&requester_user_id=eq.${encodeURIComponent(session.userId)}&status=eq.pending&select=id&limit=1`,
    );
    if (pending.length) return NextResponse.json({ ok: true, request_id: pending[0].id, status: "pending", message: "Your request is already awaiting approval." });

    const created = await supabaseServerRequest<Array<{ id: string; status: string }>>(
      "organization_access_requests",
      {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ organization_id: organization.id, requester_user_id: session.userId, status: "pending" }),
      },
    );
    return NextResponse.json({ ok: true, request_id: created[0]?.id, organization_id: organization.id, status: "pending" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to request organization access." }, { status: 400 });
  }
}
