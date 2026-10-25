import { NextRequest, NextResponse } from "next/server";
import { provisionClientWorkspace } from "@/lib/client-onboarding";
import {
  getPendingClientSetupSession,
  getPrimaryMembership,
  setClientSession,
} from "@/lib/client-auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export async function POST(request: NextRequest) {
  try {
    const pending = await getPendingClientSetupSession();
    if (!pending) {
      return NextResponse.json(
        { error: "Your workspace setup session has expired. Sign in again to continue." },
        { status: 401 },
      );
    }
    if (pending.invitationToken) {
      return NextResponse.json(
        { error: "This account is joining by invitation. Ask the organization owner to resend the invitation instead of creating a workspace." },
        { status: 409 },
      );
    }

    const rawBody = await request.json().catch(() => ({}));
    const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? rawBody as Record<string, unknown>
      : {};
    const companyName = String(body.company_name || "").trim();
    const industrySlug = String(body.industry_slug || "service-businesses").trim();
    const companySlug = slugify(String(body.company_slug || companyName));

    if (companyName.length < 2 || companyName.length > 120) {
      return NextResponse.json({ error: "Organization name must be between 2 and 120 characters." }, { status: 400 });
    }
    if (!companySlug) {
      return NextResponse.json({ error: "A valid organization name is required." }, { status: 400 });
    }
    if (industrySlug.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(industrySlug)) {
      return NextResponse.json({ error: "Choose a valid business type." }, { status: 400 });
    }

    await provisionClientWorkspace({
      userId: pending.userId,
      organizationName: companyName,
      organizationSlug: companySlug,
      industrySlug,
      businessEmail: pending.email,
    });

    const membership = await getPrimaryMembership(pending.userId);
    if (!membership) {
      throw new Error("Workspace membership could not be loaded after setup.");
    }

    await setClientSession({
      userId: pending.userId,
      email: pending.email,
      organizationId: membership.organizationId,
      organizationSlug: membership.organizationSlug,
      membershipId: membership.membershipId,
      role: membership.role,
      issuedAt: Date.now(),
    });

    const redirectTo = new URL("/onboarding", "https://fluxknight.local");
    if (pending.txRef) redirectTo.searchParams.set("tx_ref", pending.txRef);

    return NextResponse.json({
      ok: true,
      organization_slug: membership.organizationSlug,
      redirect_to: `${redirectTo.pathname}${redirectTo.search}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish workspace setup.";
    const status = /already|duplicate|exists|membership/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
