import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { supabaseRest } from "@/lib/supabase-server-rest";
import { flutterwaveRequest } from "@/lib/payments/flutterwave";
import { activatePaidTrialSubscription } from "@/lib/payments/activate-paid-trial";
import { ensureClientOnboardingProfile } from "@/lib/client-workspace-onboarding";
import OnboardingForm from "./OnboardingForm";
import "./onboarding.css";

export const metadata: Metadata = {
  title: "Set Up Your Workspace",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = { tx_ref?: string };
type CheckoutSession = {
  id: string;
  tx_ref: string;
  status: string;
  customer_email: string;
  organization_id: string | null;
  billing_type: string;
  billing_region: "NG" | "INTERNATIONAL";
  plan_slug: string;
  currency: string;
  amount: number;
  provider_transaction_id: string | null;
};

async function claimPaidCheckout(txRef: string, session: Awaited<ReturnType<typeof getClientSession>>) {
  if (!txRef || !session) return;

  const rows = await supabaseRest<CheckoutSession[]>(
    `checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&select=id,tx_ref,status,customer_email,organization_id,billing_type,billing_region,plan_slug,currency,amount,provider_transaction_id&limit=1`,
  );
  const checkout = rows[0];
  if (!checkout || checkout.status !== "successful") redirect(`/pricing?payment=pending&tx_ref=${encodeURIComponent(txRef)}`);
  if (checkout.customer_email.toLowerCase() !== session.email.toLowerCase()) {
    redirect(`/pricing?payment=account_mismatch&tx_ref=${encodeURIComponent(txRef)}`);
  }

  if (checkout.organization_id && checkout.organization_id !== session.organizationId) {
    redirect(`/pricing?payment=account_mismatch&tx_ref=${encodeURIComponent(txRef)}`);
  }

  if (!checkout.organization_id) {
    const claimed = await supabaseRest<Array<{ organization_id: string }>>(
      `checkout_sessions?tx_ref=eq.${encodeURIComponent(txRef)}&organization_id=is.null&select=organization_id`,
      {
        method: "PATCH",
        body: JSON.stringify({ organization_id: session.organizationId }),
      },
    );
    if (claimed.length !== 1 || claimed[0].organization_id !== session.organizationId) {
      redirect(`/pricing?payment=account_mismatch&tx_ref=${encodeURIComponent(txRef)}`);
    }
  }

  if (checkout.billing_type === "subscription") {
    if (!checkout.provider_transaction_id || !checkout.plan_slug || !checkout.billing_region) {
      redirect(`/pricing?payment=pending&tx_ref=${encodeURIComponent(txRef)}`);
    }
    const verification = await flutterwaveRequest<{
      status: string;
      data?: {
        id: number;
        tx_ref: string;
        status: string;
        amount: number;
        currency: string;
        flw_ref?: string;
        customer?: { id?: number | string; email?: string };
      };
    }>(`/transactions/${encodeURIComponent(checkout.provider_transaction_id)}/verify`);
    const payment = verification.data;
    if (
      !payment ||
      payment.status !== "successful" ||
      payment.tx_ref !== checkout.tx_ref ||
      payment.currency !== checkout.currency ||
      Number(payment.amount) < Number(checkout.amount) ||
      String(payment.customer?.email || "").trim().toLowerCase() !== session.email.trim().toLowerCase()
    ) {
      redirect(`/pricing?payment=verification_failed&tx_ref=${encodeURIComponent(txRef)}`);
    }
    await activatePaidTrialSubscription(
      {
        id: checkout.id,
        tx_ref: checkout.tx_ref,
        plan_slug: checkout.plan_slug,
        billing_region: checkout.billing_region,
        organization_id: session.organizationId,
      },
      payment,
    );
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

  // Workspace creation is complete; onboarding continues inside the industry dashboard.
  // Keep this route as a compatibility entry point for paid checkout verification.
  redirect("/portal");

  return (
    <main className="onboarding-page">
      <OnboardingForm initialProfile={profile} />
    </main>
  );
}
