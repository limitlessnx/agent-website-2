import { NextRequest, NextResponse } from "next/server";
import {
  getMembershipForOrganization,
  setClientSession,
  setPendingClientSetupSession,
  signUpClient,
} from "@/lib/client-auth";
import { acceptOrganizationInvitation } from "@/lib/organization-membership";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || "there";
}

function safeInternalPath(value: unknown, fallback: string) {
  const path = String(value || "").trim();
  return path.startsWith("/") && !path.startsWith("//") ? path.slice(0, 500) : fallback;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
      ? rawBody as Record<string, unknown>
      : {};
    const fullName = String(body.full_name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const passwordConfirmation = String(body.password_confirmation || "");
    const invitationToken = String(body.invitation_token || "").trim();
    const joiningOrganization = Boolean(invitationToken);
    const ownerNextPath = "/onboarding";
    const invitationNextPath = safeInternalPath(body.post_signup_path, "/portal");
    const nextPath = joiningOrganization ? invitationNextPath : ownerNextPath;
    const txRef = String(body.payment_tx_ref || body.tx_ref || "").trim().slice(0, 200);

    if (fullName.length < 2 || fullName.length > 120) {
      return NextResponse.json({ error: "Full name must be between 2 and 120 characters." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must contain at least 8 characters." }, { status: 400 });
    }
    if (password !== passwordConfirmation) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const auth = await signUpClient(email, password, fullName);
    if (!auth.access_token) {
      if (auth.user?.id) {
        await setPendingClientSetupSession({
          userId: auth.user.id,
          email: auth.user.email || email,
          invitationToken: joiningOrganization ? invitationToken : undefined,
          nextPath,
          txRef: txRef || undefined,
          trialPlan: "",
          issuedAt: Date.now(),
        });
      }
      return NextResponse.json({
        ok: true,
        signed_in: false,
        account_mode: joiningOrganization ? "organization-member" : "organization-owner",
        requires_email_confirmation: true,
        message: "Account created. Verify your email, then sign in to continue.",
      }, { status: 201 });
    }
    if (!auth.user?.id) {
      throw new Error("The account was authenticated, but the user profile could not be loaded.");
    }

    if (joiningOrganization) {
      const accepted = await acceptOrganizationInvitation({
        userId: auth.user.id,
        email: auth.user.email || email,
        token: invitationToken,
      });
      const membership = await getMembershipForOrganization(auth.user.id, accepted.organization_id);
      if (!membership) throw new Error("Organization membership could not be loaded.");
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
        eventKey: `welcome:${auth.user.id}:${membership.organizationId}`,
        event: "fluxknight.user.verified",
        email: auth.user.email || email,
        userId: auth.user.id,
        organizationId: membership.organizationId,
        payload: { first_name: firstName(fullName), company_name: membership.organizationSlug, dashboard_url: fluxknightPortalUrl() },
      });
      return NextResponse.json({
        ok: true,
        signed_in: true,
        account_mode: "organization-member",
        requires_email_confirmation: false,
        redirect_to: invitationNextPath,
      }, { status: 201 });
    }

    await setPendingClientSetupSession({
      userId: auth.user.id,
      email: auth.user.email || email,
      nextPath: ownerNextPath,
      txRef: txRef || undefined,
      trialPlan: "",
      issuedAt: Date.now(),
    });
    return NextResponse.json({
      ok: true,
      signed_in: true,
      account_mode: "organization-owner",
      requires_email_confirmation: false,
      requires_workspace_setup: true,
      redirect_to: "/account/setup",
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create account.";
    const status = /already|duplicate|exists|registered|seat limit/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
