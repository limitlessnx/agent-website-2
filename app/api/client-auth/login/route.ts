import { NextRequest, NextResponse } from "next/server";
import { getPrimaryMembership, setClientSession, signInClient } from "@/lib/client-auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const auth = await signInClient(email, password);
    if (!auth.user?.id) throw new Error("Supabase did not return a user record.");

    const membership = await getPrimaryMembership(auth.user.id);
    if (!membership) {
      return NextResponse.json({ error: "This account is not linked to an active organization." }, { status: 403 });
    }

    await setClientSession({
      userId: auth.user.id,
      email: auth.user.email || email,
      organizationId: membership.organizationId,
      organizationSlug: membership.organizationSlug,
      membershipId: membership.membershipId,
      role: membership.role,
      issuedAt: Date.now(),
    });

    return NextResponse.json({ ok: true, organization_slug: membership.organizationSlug });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 401 },
    );
  }
}
