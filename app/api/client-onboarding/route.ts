import { NextRequest, NextResponse } from "next/server";
import { getClientSession } from "@/lib/client-auth";
import {
  completeClientOnboarding,
  ensureClientOnboardingProfile,
  getClientOnboardingProfile,
  saveClientOnboardingProfile,
} from "@/lib/client-workspace-onboarding";

export async function GET() {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const profile = await ensureClientOnboardingProfile({
    organizationId: session.organizationId,
    membershipId: session.membershipId,
    userId: session.userId,
    businessName: session.organizationSlug,
    email: session.email,
  });

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  await ensureClientOnboardingProfile({
    organizationId: session.organizationId,
    membershipId: session.membershipId,
    userId: session.userId,
    businessName: session.organizationSlug,
    email: session.email,
  });

  const profile = await saveClientOnboardingProfile(session.organizationId, session.userId, body);
  return NextResponse.json({ profile });
}

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  if (body.action !== "complete") {
    return NextResponse.json({ error: "Unsupported onboarding action." }, { status: 400 });
  }

  const profile = await getClientOnboardingProfile(session.organizationId);
  if (!profile) return NextResponse.json({ error: "Onboarding profile not found." }, { status: 404 });

  const result = await completeClientOnboarding(session.organizationId, session.userId);
  return NextResponse.json({ ok: true, result });
}
