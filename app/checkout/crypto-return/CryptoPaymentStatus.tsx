"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PaymentStatus = {
  status?: string;
  currency?: string;
  amount?: number;
};

export default function CryptoPaymentStatus({ txRef }: { txRef: string }) {
  const [status, setStatus] = useState("pending");
  const [details, setDetails] = useState<PaymentStatus | null>(null);

  useEffect(() => {
    if (!txRef) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const response = await fetch(`/api/payments/status?tx_ref=${encodeURIComponent(txRef)}`, { cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || stopped) return;
        setDetails(payload);
        const next = String(payload.status || "pending").toLowerCase();
        setStatus(next);
        if (!["successful", "failed", "refunded", "expired"].includes(next)) {
          timer = setTimeout(check, 4000);
        }
      } catch {
        if (!stopped) timer = setTimeout(check, 5000);
      }
    };

    void check();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [txRef]);

  const successful = status === "successful";
  const failed = ["failed", "refunded", "expired"].includes(status);

  return (
    <article className="brand-card" style={{ maxWidth: 720, margin: "2rem auto 0" }}>
      <span className="brand-eyebrow">NOWPayments</span>
      <h2 style={{ marginTop: 12 }}>{successful ? "Crypto payment confirmed" : failed ? "Crypto payment was not completed" : "Confirming your crypto payment"}</h2>
      <p style={{ marginTop: 12 }}>
        {successful
          ? "Your payment has been verified. You can continue to your Fluxknight account and onboarding."
          : failed
            ? "The payment is no longer pending. Return to pricing to start a new checkout if needed."
            : "Blockchain confirmations can take a little time. This page checks the payment automatically, so there is no need to submit another payment."}
      </p>
      {details?.amount ? <p style={{ marginTop: 12, opacity: .72 }}>Order total: {details.currency} {details.amount}</p> : null}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
        {successful ? <Link className="button-primary" href={`/account/login?tx_ref=${encodeURIComponent(txRef)}&next=%2Fonboarding`}>Continue to onboarding</Link> : null}
        {failed ? <Link className="button-primary" href="/pricing">Return to pricing</Link> : null}
        {!successful && !failed ? <Link className="button-secondary" href="/pricing">Back to pricing</Link> : null}
      </div>
    </article>
  );
}
