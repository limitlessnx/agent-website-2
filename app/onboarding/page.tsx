import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { ensureClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import OnboardingForm from "./OnboardingForm";
import "./onboarding.css";

export const metadata = { title: "Set Up Your Workspace | Fluxknight" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getClientSession();
  if (!session) redirect("/account/login");

  const profile = await ensureClientOnboardingProfile({
    organizationId: session.organizationId,
    membershipId: session.membershipId,
    userId: session.userId,
    businessName: session.organizationSlug,
    email: session.email,
  });

  if (profile.status !== "in_progress") redirect("/portal");

  return (
    <main className="onboarding-page">
      <OnboardingForm initialProfile={profile} />
    </main>
  );
}
