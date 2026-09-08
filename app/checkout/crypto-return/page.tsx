import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CryptoPaymentStatus from "./CryptoPaymentStatus";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crypto payment status | Fluxknight",
  robots: { index: false, follow: false },
};

export default async function CryptoReturnPage({ searchParams }: { searchParams: Promise<{ tx_ref?: string }> }) {
  const params = await searchParams;
  const txRef = typeof params.tx_ref === "string" ? params.tx_ref : "";
  if (!txRef) notFound();

  return (
    <main className="quantix-home">
      <section className="brand-section" style={{ paddingTop: "9rem", minHeight: "75vh" }}>
        <div className="brand-shell">
          <div className="brand-heading" style={{ maxWidth: 780, margin: "0 auto", textAlign: "center" }}>
            <span className="brand-eyebrow">Secure crypto checkout</span>
            <h1 style={{ fontSize: "clamp(2.5rem, 6vw, 4.7rem)", lineHeight: 1 }}>Payment status.</h1>
            <p>Fluxknight waits for NOWPayments to verify the blockchain payment before onboarding is unlocked.</p>
          </div>
          <CryptoPaymentStatus txRef={txRef} />
        </div>
      </section>
    </main>
  );
}
