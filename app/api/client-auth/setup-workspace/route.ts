import { NextRequest, NextResponse } from "next/server";
import { provisionClientOrganization } from "@/lib/client-onboarding";
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
    const companySlug = slugify(String(body.company_slug || companyName));
    const agentFamilyName = String(body.agent_family_name || companyName).trim();

    if (companyName.length < 2) {
      return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    }
    if (!companySlug) {
      return NextResponse.json({ error: "A valid company name is required." }, { status: 400 });
    }

    await provisionClientOrganization({
      userId: pending.userId,
      organizationName: companyName,
      organizationSlug: companySlug,
      agentFamilyName,
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

    return NextResponse.json({
      ok: true,
      organization_slug: membership.organizationSlug,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to finish workspace setup.";
    const status = /already|duplicate|exists/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
