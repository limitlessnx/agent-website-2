import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getPublicPlan } from "@/lib/payments/catalog";
import { getRequestBillingRegion, type BillingRegion } from "@/lib/payments/region";
import { isPrepaidTerm } from "@/lib/payments/terms";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure Fluxknight AI system checkout.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; term?: string; view?: string }> }) {
  const params = await searchParams;
  const planSlug = typeof params.plan === "string" ? params.plan : "";
  const initialTerm = isPrepaidTerm(params.term) ? params.term : "3m";
  if (!planSlug) notFound();

  const [detected, session, cookieStore] = await Promise.all([
    getRequestBillingRegion(),
    getClientSession(),
    cookies(),
  ]);

  const persistedView = cookieStore.get("fluxknight-pricing-view")?.value;
  const requestedInternational = params.view === "international" || persistedView === "international";
  const region: BillingRegion = detected.region === "NG" && requestedInternational
    ? "INTERNATIONAL"
    : detected.region;

  const plan = await getPublicPlan(planSlug, region);
  if (!plan || plan.custom) notFound();

  return (
    <main className="quantix-home">
      <section className="brand-section" style={{ paddingTop: "9rem" }}>
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Secure checkout</span>
            <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1 }}>Get your AI system started.</h1>
            <p>Select 3 months, 6 months or 1 year and pay the discounted prepaid total directly. Your selected pricing region and currency are preserved through payment.</p>
          </div>
          <CheckoutClient
            plan={{
              slug: plan.slug,
              name: plan.name,
              description: plan.description,
              currency: plan.currency,
              installationFee: plan.installationFee,
              recurringFee: plan.recurringFee,
            }}
            billingRegion={region}
            customer={session ? { name: session.organizationSlug, email: session.email } : null}
            initialTerm={initialTerm}
          />
        </div>
      </section>
    </main>
  );
}
