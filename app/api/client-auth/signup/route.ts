import { NextRequest, NextResponse } from "next/server";
import { provisionClientOrganization } from "@/lib/client-onboarding";
import { getPrimaryMembership, setClientSession, signUpClient } from "@/lib/client-auth";

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
    const body = await request.json().catch(() => ({}));
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const companyName = String(body.company_name || "").trim();
    const companySlug = slugify(String(body.company_slug || companyName));
    const templateSlug = String(body.template_slug || "").trim() || undefined;
    const agentFamilyName = String(body.agent_family_name || companyName).trim();

    if (fullName.length < 2) return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    if (companyName.length < 2) return NextResponse.json({ error: "Company name is required." }, { status: 400 });
    if (!companySlug) return NextResponse.json({ error: "A valid company slug is required." }, { status: 400 });

    const auth = await signUpClient(email, password, fullName, {
      companyName,
      companySlug,
      templateSlug,
      agentFamilyName,
    });

    if (!auth.access_token) {
      return NextResponse.json({
        ok: true,
        requires_email_confirmation: true,
        message: "Account created. Check your email, verify your address, then sign in to finish creating your workspace.",
      }, { status: 201 });
    }

    if (!auth.user?.id) {
      throw new Error("The account was authenticated, but the user profile could not be loaded.");
    }

    const provisioned = await provisionClientOrganization({
      userId: auth.user.id,
      organizationName: companyName,
      organizationSlug: companySlug,
      templateSlug,
      agentFamilyName,
    });

    const membership = await getPrimaryMembership(auth.user.id);
    if (!membership) throw new Error("Client membership could not be loaded after provisioning.");

    await setClientSession({
      userId: auth.user.id,
      email: auth.user.email || email,
      organizationId: membership.organizationId,
      organizationSlug: membership.organizationSlug,
      membershipId: membership.membershipId,
      role: membership.role,
      issuedAt: Date.now(),
    });

    return NextResponse.json({
      ok: true,
      requires_email_confirmation: false,
      organization: provisioned,
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    const status = /already|duplicate|exists|registered/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
