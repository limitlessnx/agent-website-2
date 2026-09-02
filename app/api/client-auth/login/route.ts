import { NextRequest, NextResponse } from "next/server";
import { provisionClientOrganization } from "@/lib/client-onboarding";
import {
  getPrimaryMembership,
  setClientSession,
  setPendingClientSetupSession,
  signInClient,
} from "@/lib/client-auth";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function firstName(value: string, email: string) {
  return value.trim().split(/\s+/)[0] || email.split("@")[0] || "there";
}

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

    const metadata = auth.user.user_metadata || {};
    const fullName = String(metadata.full_name || "").trim();
    const companyName = String(metadata.company_name || "").trim();

    let membership = await getPrimaryMembership(auth.user.id);

    if (!membership) {
      const companySlug = slugify(String(metadata.company_slug || companyName));
      const templateSlug = String(metadata.template_slug || "").trim() || undefined;
      const agentFamilyName = String(metadata.agent_family_name || companyName).trim() || undefined;

      if (companyName && companySlug) {
        await provisionClientOrganization({
          userId: auth.user.id,
          organizationName: companyName,
          organizationSlug: companySlug,
          templateSlug,
          agentFamilyName,
        });
        membership = await getPrimaryMembership(auth.user.id);
      }
    }

    if (!membership) {
      await setPendingClientSetupSession({
        userId: auth.user.id,
        email: auth.user.email || email,
        issuedAt: Date.now(),
      });
      return NextResponse.json({
        ok: true,
        requires_workspace_setup: true,
        message: "Your email is verified. Finish setting up your company workspace.",
      });
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

    await sendFluxknightLifecycleEvent({
      eventKey: `welcome:${auth.user.id}`,
      event: "fluxknight.user.verified",
      email: auth.user.email || email,
      userId: auth.user.id,
      organizationId: membership.organizationId,
      payload: {
        first_name: firstName(fullName, auth.user.email || email),
        company_name: companyName || membership.organizationSlug || "your business",
        dashboard_url: fluxknightPortalUrl(),
      },
    });

    return NextResponse.json({
      ok: true,
      requires_workspace_setup: false,
      organization_slug: membership.organizationSlug,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 401 },
    );
  }
}