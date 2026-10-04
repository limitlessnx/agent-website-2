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

    const body = await request.json().catch(() => ({}));
    const companyName = String(body.company_name || "").trim();
    const industrySlug = String(body.industry_slug || "").trim();
    const companySlug = slugify(String(body.company_slug || companyName));

    if (companyName.length < 2) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    if (!companySlug) {
      return NextResponse.json({ error: "A valid company name is required." }, { status: 400 });
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(industrySlug)) {
      return NextResponse.json({ error: "Choose the industry your organization operates in." }, { status: 400 });
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

    const destination = pending.nextPath && pending.nextPath.startsWith("/") && !pending.nextPath.startsWith("//") ? pending.nextPath : "/onboarding";
    const redirectTo=new URL(destination,"https://fluxknight.local");
    if(pending.txRef&&redirectTo.pathname==="/onboarding") redirectTo.searchParams.set("tx_ref",pending.txRef);

    return NextResponse.json({
      ok: true,
      organization_slug: membership.organizationSlug,
      redirect_to:`${redirectTo.pathname}${redirectTo.search}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish workspace setup.";
    const status = /already|duplicate|exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
