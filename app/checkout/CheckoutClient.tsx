"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "@/components/admin/ServerIcons";

type Plan = {
  slug: string;
  name: string;
  description: string;
  currency: "NGN" | "USD";
  installationFee: number;
  recurringFee: number;
};

type Props = {
  plan: Plan;
  customer: { name: string; email: string } | null;
};

function money(value: number, currency: "NGN" | "USD") {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CheckoutClient({ plan, customer }: Props) {
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          billingType: "setup",
          customer: { name, email, phone },
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error || "Unable to start checkout.");
      window.location.assign(result.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to start checkout.");
      setBusy(false);
    }
  }

  return (
    <section className="brand-grid" style={{ marginTop: "3rem", gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, .85fr)" }}>
      <article className="brand-card pricing-featured">
        <span className="brand-eyebrow">{plan.currency} · payment required before onboarding</span>
        <h2>{plan.name}</h2>
        <p>{plan.description}</p>
        <div style={{ display: "grid", gap: 16, margin: "28px 0" }}>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>FIRST MONTH · INSTALLATION + SERVICE</span>
            <strong style={{ display: "block", fontSize: 34, marginTop: 5 }}>{money(plan.installationFee, plan.currency)}</strong>
          </div>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>FROM MONTH 2 · CONSECUTIVE</span>
            <strong style={{ display: "block", fontSize: 23, marginTop: 5 }}>{money(plan.recurringFee, plan.currency)}/month</strong>
          </div>
        </div>
        <div style={{ display: "grid", gap: 11 }}>
          {[
            "Payment is verified before onboarding is unlocked",
            "Your selected currency stays locked",
            "Your organization is attached to the payment when logged in",
            "After successful payment you continue directly to onboarding",
          ].map((item) => (
            <span key={item} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
              <CheckCircle2 size={17} />{item}
            </span>
          ))}
        </div>
      </article>

      <article className="brand-card">
        <span className="brand-eyebrow"><ShieldCheck size={15} /> Checkout details</span>
        {!customer ? <p style={{ marginTop: 10 }}>Enter your details. You can create or finish your client account during the payment-to-onboarding handoff.</p> : <p style={{ marginTop: 10 }}>Your existing client account is detected. Payment will be attached to your organization.</p>}

        <label style={{ display: "grid", gap: 7, marginTop: 20 }}>
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name or organization" autoComplete="name" />
        </label>
        <label style={{ display: "grid", gap: 7, marginTop: 14 }}>
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" type="email" autoComplete="email" />
        </label>
        <label style={{ display: "grid", gap: 7, marginTop: 14 }}>
          <span>Phone <small style={{ opacity: .55 }}>(optional)</small></span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+234..." type="tel" autoComplete="tel" />
        </label>

        {error ? <p role="alert" style={{ marginTop: 16, color: "#ff8c8c" }}>{error}</p> : null}

        <button className="button-primary" type="button" disabled={busy || !name.trim() || !email.trim()} onClick={startCheckout} style={{ marginTop: 22, width: "100%", justifyContent: "center" }}>
          {busy ? "Opening secure checkout…" : `Pay ${money(plan.installationFee, plan.currency)}`}
          {!busy ? <ArrowRight size={17} /> : null}
        </button>
        <Link href="/pricing" className="button-secondary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>Back to pricing</Link>
      </article>
    </section>
  );
}
