import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getPublicPlan } from "@/lib/payments/catalog";
import { getRequestBillingRegion, type BillingRegion } from "@/lib/payments/region";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Secure Fluxknight AI system checkout.",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const params = await searchParams;
  const planSlug = typeof params.plan === "string" ? params.plan : "";
  if (!planSlug) notFound();

  const [{ region: detectedRegion }, session, cookieStore] = await Promise.all([
    getRequestBillingRegion(),
    getClientSession(),
    cookies(),
  ]);

  const savedPricingView = cookieStore.get("fluxknight-pricing-view")?.value;
  let region: BillingRegion = detectedRegion;
  if (detectedRegion === "NG" && savedPricingView === "international") {
    region = "INTERNATIONAL";
  }

  const plan = await getPublicPlan(planSlug, region);
  if (!plan || plan.custom) notFound();

  return (
    <main className="quantix-home">
      <section className="brand-section" style={{ paddingTop: "9rem" }}>
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">Secure checkout</span>
            <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 5rem)", lineHeight: 1 }}>Get your AI system started.</h1>
            <p>
              Checkout is using your selected pricing region: {region === "NG" ? "Nigeria (NGN)" : "International (USD)"}. Your subscription is billed monthly. No installation fee.
            </p>
          </div>
          <CheckoutClient
            plan={{
              slug: plan.slug,
              name: plan.name,
              description: plan.description,
              currency: plan.currency,
              recurringFee: plan.recurringFee,
            }}
            customer={session ? { name: session.organizationSlug, email: session.email } : null}
          />
        </div>
      </section>
    </main>
  );
}
