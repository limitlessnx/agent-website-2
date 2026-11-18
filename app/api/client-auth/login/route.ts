import { clearAdminSession } from "@/lib/admin-auth";
import { establishAccountSession, isVerifiedPlatformAdmin } from "@/lib/platform-admin-access";
import { adminAuthDestination, isAdminPath } from "@/lib/auth-navigation";
import { NextRequest, NextResponse } from "next/server";
import { provisionClientOrganization } from "@/lib/client-onboarding";
import {
  clientAccountExists,
  clearClientSession,
  clearManagerSession,
  clearPendingClientSetupSession,
  getMembershipForOrganization,
  getPendingClientSetupSession,
  getPrimaryMembership,
  getClientAccountMode,
  setClientSession,
  setManagerSession,
  setPendingClientSetupSession,
  signInClient,
} from "@/lib/client-auth";
import { acceptOrganizationInvitation } from "@/lib/organization-membership";
import { fluxknightPortalUrl, sendFluxknightLifecycleEvent } from "@/lib/resend-events";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
}

function firstName(value: string, email: string) {
  return value.trim().split(/\s+/)[0] || email.split("@")[0] || "there";
}

export async function POST(request: NextRequest) {
  const rawBody = await request.json().catch(() => ({}));
  const body = rawBody && typeof rawBody === "object" && !Array.isArray(rawBody)
    ? rawBody as Record<string, unknown>
    : {};
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");

  try {
    if (!email || !password) return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    const auth = await signInClient(email, password);
    if (!auth.user?.id) throw new Error("Supabase did not return a user record.");

    const metadata = auth.user.user_metadata || {};
    const fullName = String(metadata.full_name || "").trim();
    const companyName = String(metadata.company_name || "").trim();
    const pending = await getPendingClientSetupSession();
    const matchingPending = pending?.userId === auth.user.id ? pending : null;
    const invitationToken = String(body.invitation_token || matchingPending?.invitationToken || "").trim();
    const txRef = String(body.payment_tx_ref || matchingPending?.txRef || "").trim().slice(0, 200);

    // Use the verified Auth identity, never a role/email supplied in the request.
    const platformAdmin = await isVerifiedPlatformAdmin(auth.user);
    await establishAccountSession(auth);
    await clearAdminSession();
    await clearClientSession();
    await clearManagerSession();
    if (platformAdmin && !invitationToken) {
      await clearPendingClientSetupSession();
      return NextResponse.json({ ok: true, redirect_to: adminAuthDestination(String(body.post_signup_path || "")) });
    }
    if (isAdminPath(String(body.post_signup_path || "")) && !platformAdmin) {
      return NextResponse.json({ error: "This account does not have super-admin access." }, { status: 403 });
    }
    const accountMode = await getClientAccountMode(auth.user.id);
    if (accountMode === "manager" && !invitationToken) {
      await setManagerSession({ userId: auth.user.id, email: auth.user.email || email, issuedAt: Date.now() });
      return NextResponse.json({ ok: true, redirect_to: "/manage-organizations" });
    }
    // Resolve an explicit invitation before any primary-membership fallback.
    let membership;
    if (invitationToken) {
      const accepted = await acceptOrganizationInvitation({
        userId: auth.user.id,
        email: auth.user.email || email,
        token: invitationToken,
      });
      membership = await getMembershipForOrganization(auth.user.id, accepted.organization_id);
      if (!membership) throw new Error("Invitation was accepted, but active organization membership could not be loaded.");
    } else {
      membership = await getPrimaryMembership(auth.user.id);
    }

    if (!membership && !invitationToken) {
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

    if (!membership && invitationToken) {
      await setPendingClientSetupSession({
        userId: auth.user.id,
        email: auth.user.email || email,
        invitationToken,
        nextPath: matchingPending?.nextPath || "/portal",
        txRef: txRef || undefined,
        trialPlan: matchingPending?.trialPlan || "",
        issuedAt: Date.now(),
      });
      return NextResponse.json({
        code: "invitation_not_accepted",
        error: "Your invitation could not be activated. Ask the organization owner to issue a new invitation.",
      }, { status: 409 });
    }

    if (!membership) {
      const needsOwnerSetup = accountMode === "organization" || Boolean(companyName);
      await setPendingClientSetupSession({
        userId: auth.user.id,
        email: auth.user.email || email,
        nextPath: needsOwnerSetup ? "/onboarding" : "/account/choose-mode",
        txRef: txRef || undefined,
        trialPlan: matchingPending?.trialPlan || "",
        issuedAt: Date.now(),
      });
      return NextResponse.json({
        ok: true,
        requires_workspace_setup: needsOwnerSetup,
        requires_account_choice: !needsOwnerSetup,
        redirect_to: needsOwnerSetup ? "/account/setup" : "/account/choose-mode",
        message: needsOwnerSetup ? "Your email is verified. Finish setting up your company workspace." : "Choose Organization owner or Manager to continue.",
      });
    }

    if (accountMode === "manager") {
      await setManagerSession({ userId: auth.user.id, email: auth.user.email || email, issuedAt: Date.now() });
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
      eventKey: `welcome:${auth.user.id}:${membership.organizationId}`,
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
    return NextResponse.json({ ok: true, requires_workspace_setup: false, organization_slug: membership.organizationSlug });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    if (message === "Invalid login credentials.") {
      const exists = await clientAccountExists(email);
      if (exists === false) return NextResponse.json({ code: "account_not_found", error: "No Fluxknight account exists for this email." }, { status: 401 });
      if (exists === true) return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
