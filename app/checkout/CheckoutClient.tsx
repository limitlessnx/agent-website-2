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
  const dueToday = plan.recurringFee;
  const isBasicPlan = plan.slug === "whatsapp-ai-starter";
  const trialHref = "/account/signup?trial=basic&next=%2Fportal";

  async function startCheckout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planSlug: plan.slug,
          billingType: "subscription",
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
    <section className="checkout-layout">
      <article className="brand-card pricing-featured">
        <span className="brand-eyebrow">{plan.currency} · choose billing duration</span>
        <h2>{plan.name}</h2>
        <p>{plan.description}</p>



        <div style={{ display: "grid", gap: 12, margin: "22px 0" }}>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>MONTHLY SUBSCRIPTION</span>
            <strong style={{ display: "block", fontSize: 22, marginTop: 5 }}>{money(plan.recurringFee, plan.currency)}/month</strong>
            <small style={{ display: "block", marginTop: 4, opacity: .65 }}>Your plan renews monthly. No installation fee.</small>
          </div>

          <div style={{ padding: 16, borderRadius: 14, background: "rgba(139,92,246,.09)", border: "1px solid rgba(168,85,247,.24)" }}>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>TOTAL DUE TODAY</span>
            <strong style={{ display: "block", fontSize: 34, marginTop: 5 }}>{money(dueToday, plan.currency)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#d8b4fe", lineHeight: 1.5 }}>
              `You pay ${money(plan.recurringFee, plan.currency)} today, then renew monthly. No setup fee.`
            </small>
          </div>
        </div>

        <div style={{ display: "grid", gap: 11 }}>
          {[
            "Your monthly subscription starts after successful payment",
            "Payment is verified before onboarding is unlocked",
            "Your selected currency and billing term stay attached to the checkout record",
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

        {isBasicPlan ? (
          <div className="checkout-trial-card">
            <span>Want to test it first?</span>
            <strong>Start a 14-day Basic free trial</strong>
            <p>250 Flux Credits · Web AI + WhatsApp AI · no card required.</p>
            <Link href={trialHref} className="button-primary checkout-trial-cta">
              Start Free Trial <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}

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
          {busy ? "Opening secure checkout…" : `Pay ${money(dueToday, plan.currency)}`}
          {!busy ? <ArrowRight size={17} /> : null}
        </button>
        <Link href="/pricing" className="button-secondary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>Back to pricing</Link>
      </article>
    </section>
  );
}