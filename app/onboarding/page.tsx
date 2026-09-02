import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { ensureClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import OnboardingForm from "./OnboardingForm";
import "./onboarding.css";

export const metadata = { title: "Set Up Your Workspace" };
export const dynamic = "force-dynamic";

type SearchParams = { tx_ref?: string };
type CheckoutSession = {
  id: string;
  tx_ref: string;
  status: string;
  customer_email: string;
  organization_id: string | null;
};

async function claimPaidCheckout(txRef: string, session: Awaited<ReturnType<typeof getClientSession>>) {
  if (!txRef || !session) return;

  const rows = await supabaseRest<CheckoutSession[]>(
    `checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,tx_ref,status,customer_email,organization_id&limit=1`,
  );
  const checkout = rows[0];
  if (!checkout || checkout.status !== "successful") redirect(`/pricing?payment=pending&tx_ref=${encodeURIComponent(txRef)}`);
  if (checkout.customer_email.toLowerCase() !== session.email.toLowerCase()) {
    redirect(`/pricing?payment=account_mismatch&tx_ref=${encodeURIComponent(txRef)}`);
  }

  if (!checkout.organization_id || checkout.organization_id !== session.organizationId) {
    await supabaseRest(`checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}`, {
      method: "PATCH",
      body: JSON.stringify({ organization_id: session.organizationId }),
    });
  }
}

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const txRef = String(params.tx_ref || "").trim();
  const session = await getClientSession();
  if (!session) {
    const login = new URLSearchParams();
    if (txRef) login.set("tx_ref", txRef);
    login.set("next", "/onboarding");
    redirect(`/account/login?${login.toString()}`);
  }

  if (txRef) await claimPaidCheckout(txRef, session);

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
