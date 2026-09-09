"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "@/components/admin/ServerIcons";
import { calculatePrepaidPrice, PREPAID_TERMS, type PrepaidTerm } from "@/lib/payments/terms";

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
  initialTerm: PrepaidTerm | null;
  customer: { name: string; email: string } | null;
};

type BillingTerm = "monthly" | PrepaidTerm;

function money(value: number, currency: "NGN" | "USD") {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CheckoutClient({ plan, initialTerm, customer }: Props) {
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState("");
  const [term, setTerm] = useState<BillingTerm>(initialTerm || "monthly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const prepaid = term === "monthly" ? null : calculatePrepaidPrice(plan.installationFee, plan.recurringFee, term);
  const prepaidRenewals = prepaid ? plan.recurringFee * prepaid.months : 0;
  const dueToday = prepaid?.total ?? plan.installationFee;
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
          billingType: "setup",
          term: term === "monthly" ? null : term,
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

        <div className="checkout-term-switch">
          <button
            type="button"
            className="checkout-term-option"
            aria-pressed={term === "monthly"}
            onClick={() => setTerm("monthly")}
            style={{ borderRadius: 12, border: term === "monthly" ? "1px solid rgba(192,132,252,.8)" : "1px solid rgba(168,85,247,.22)", background: term === "monthly" ? "rgba(126,34,206,.24)" : "rgba(255,255,255,.025)", color: "inherit", cursor: "pointer" }}
          >
            <strong>Monthly</strong>
            <small style={{ color: "#d8b4fe" }}>Standard</small>
          </button>
          {(Object.keys(PREPAID_TERMS) as PrepaidTerm[]).map((key) => {
            const option = PREPAID_TERMS[key];
            const selected = term === key;
            return (
              <button
                key={key}
                type="button"
                className="checkout-term-option"
                aria-pressed={selected}
                onClick={() => setTerm(key)}
                style={{ borderRadius: 12, border: selected ? "1px solid rgba(192,132,252,.8)" : "1px solid rgba(168,85,247,.22)", background: selected ? "rgba(126,34,206,.24)" : "rgba(255,255,255,.025)", color: "inherit", cursor: "pointer" }}
              >
                <strong>{option.label}</strong>
                <small style={{ color: "#d8b4fe" }}>Save {option.discountPercent}%</small>
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 12, margin: "22px 0" }}>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>IMPLEMENTATION COST</span>
            <strong style={{ display: "block", fontSize: 22, marginTop: 5 }}>{money(plan.installationFee, plan.currency)}</strong>
            <small style={{ display: "block", marginTop: 4, opacity: .65 }}>One-time system setup, configuration and deployment</small>
          </div>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>MONTHLY RENEWAL</span>
            <strong style={{ display: "block", fontSize: 20, marginTop: 5 }}>{money(plan.recurringFee, plan.currency)}/month</strong>
            <small style={{ display: "block", marginTop: 4, opacity: .65 }}>Platform, support and included plan usage</small>
          </div>

          {prepaid ? (
            <>
              <div>
                <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>{prepaid.label.toUpperCase()} PREPAID RENEWALS</span>
                <strong style={{ display: "block", fontSize: 20, marginTop: 5 }}>{money(prepaidRenewals, plan.currency)}</strong>
              </div>
              <div>
                <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>DURATION DISCOUNT</span>
                <strong style={{ display: "block", fontSize: 20, marginTop: 5, color: "#d8b4fe" }}>−{money(prepaid.discount, plan.currency)}</strong>
                <small style={{ display: "block", marginTop: 4, opacity: .65 }}>{prepaid.discountPercent}% off the implementation + prepaid renewal subtotal</small>
              </div>
            </>
          ) : null}

          <div style={{ padding: 16, borderRadius: 14, background: "rgba(139,92,246,.09)", border: "1px solid rgba(168,85,247,.24)" }}>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>TOTAL DUE TODAY</span>
            <strong style={{ display: "block", fontSize: 34, marginTop: 5 }}>{money(dueToday, plan.currency)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#d8b4fe", lineHeight: 1.5 }}>
              {prepaid
                ? `${money(plan.installationFee, plan.currency)} implementation + ${money(prepaidRenewals, plan.currency)} renewals − ${money(prepaid.discount, plan.currency)} discount`
                : `Implementation is paid today. Renewal continues at ${money(plan.recurringFee, plan.currency)}/month.`}
            </small>
          </div>
        </div>

        <div style={{ display: "grid", gap: 11 }}>
          {[
            prepaid ? "Your selected prepaid term is paid in one secure checkout" : "Monthly billing keeps the standard renewal price",
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
        {isBasicPlan ? (
          <Link href={trialHref} className="button-secondary checkout-trial-cta">
            Start Free Trial <ArrowRight size={16} />
          </Link>
        ) : null}
        <Link href="/pricing" className="button-secondary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>Back to pricing</Link>
      </article>
    </section>
  );
}
