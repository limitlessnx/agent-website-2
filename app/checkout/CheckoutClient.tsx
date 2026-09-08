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

type BillingRegion = "NG" | "INTERNATIONAL";
type PaymentMethod = "card" | "crypto";

type Props = {
  plan: Plan;
  billingRegion: BillingRegion;
  customer: { name: string; email: string } | null;
  initialTerm?: PrepaidTerm;
};

function money(value: number, currency: "NGN" | "USD") {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CheckoutClient({ plan, billingRegion, customer, initialTerm = "3m" }: Props) {
  const [name, setName] = useState(customer?.name || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [phone, setPhone] = useState("");
  const [term, setTerm] = useState<PrepaidTerm>(initialTerm);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const price = calculatePrepaidPrice(plan.installationFee, plan.recurringFee, term);
  const prepaidRenewals = plan.recurringFee * price.months;
  const cryptoAvailable = billingRegion === "INTERNATIONAL" && plan.currency === "USD";

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
          billingRegion,
          paymentMethod: cryptoAvailable ? paymentMethod : "card",
          term,
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
        <span className="brand-eyebrow">{plan.currency} · prepaid plan</span>
        <h2>{plan.name}</h2>
        <p>{plan.description}</p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8, margin: "24px 0 18px" }}>
          {(Object.keys(PREPAID_TERMS) as PrepaidTerm[]).map((key) => {
            const option = PREPAID_TERMS[key];
            const selected = term === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={selected}
                onClick={() => setTerm(key)}
                style={{
                  padding: "14px 10px",
                  borderRadius: 12,
                  border: selected ? "1px solid rgba(192,132,252,.8)" : "1px solid rgba(168,85,247,.22)",
                  background: selected ? "rgba(126,34,206,.24)" : "rgba(255,255,255,.025)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                <strong style={{ display: "block" }}>{option.label}</strong>
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
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>{price.label.toUpperCase()} PREPAID RENEWALS</span>
            <strong style={{ display: "block", fontSize: 20, marginTop: 5 }}>{money(prepaidRenewals, plan.currency)}</strong>
          </div>
          <div>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>DURATION DISCOUNT</span>
            <strong style={{ display: "block", fontSize: 20, marginTop: 5, color: "#d8b4fe" }}>−{money(price.discount, plan.currency)}</strong>
            <small style={{ display: "block", marginTop: 4, opacity: .65 }}>{price.discountPercent}% off the implementation + prepaid renewal subtotal</small>
          </div>
          <div style={{ padding: 16, borderRadius: 14, background: "rgba(139,92,246,.09)", border: "1px solid rgba(168,85,247,.24)" }}>
            <span style={{ fontSize: 11, opacity: .65, letterSpacing: ".08em" }}>TOTAL DUE TODAY</span>
            <strong style={{ display: "block", fontSize: 34, marginTop: 5 }}>{money(price.total, plan.currency)}</strong>
            <small style={{ display: "block", marginTop: 5, color: "#d8b4fe" }}>
              {money(plan.installationFee, plan.currency)} implementation + {money(prepaidRenewals, plan.currency)} renewals − {money(price.discount, plan.currency)} discount
            </small>
          </div>
        </div>

        <div style={{ display: "grid", gap: 11 }}>
          {[
            "Your selected term is paid in one secure checkout",
            "Payment is verified before onboarding is unlocked",
            "Your selected currency stays locked",
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

        {cryptoAvailable ? (
          <div style={{ marginTop: 20 }}>
            <span style={{ display: "block", marginBottom: 8 }}>Payment method</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
              <button
                type="button"
                aria-pressed={paymentMethod === "card"}
                onClick={() => setPaymentMethod("card")}
                style={{ padding: 14, borderRadius: 12, border: paymentMethod === "card" ? "1px solid rgba(192,132,252,.8)" : "1px solid rgba(168,85,247,.22)", background: paymentMethod === "card" ? "rgba(126,34,206,.24)" : "rgba(255,255,255,.025)", color: "inherit", cursor: "pointer", textAlign: "left" }}
              >
                <strong style={{ display: "block" }}>Card / bank</strong>
                <small style={{ opacity: .65 }}>Secure fiat checkout</small>
              </button>
              <button
                type="button"
                aria-pressed={paymentMethod === "crypto"}
                onClick={() => setPaymentMethod("crypto")}
                style={{ padding: 14, borderRadius: 12, border: paymentMethod === "crypto" ? "1px solid rgba(192,132,252,.8)" : "1px solid rgba(168,85,247,.22)", background: paymentMethod === "crypto" ? "rgba(126,34,206,.24)" : "rgba(255,255,255,.025)", color: "inherit", cursor: "pointer", textAlign: "left" }}
              >
                <strong style={{ display: "block" }}>Crypto</strong>
                <small style={{ opacity: .65 }}>Pay securely via NOWPayments</small>
              </button>
            </div>
          </div>
        ) : null}

        {error ? <p role="alert" style={{ marginTop: 16, color: "#ff8c8c" }}>{error}</p> : null}

        <button className="button-primary" type="button" disabled={busy || !name.trim() || !email.trim()} onClick={startCheckout} style={{ marginTop: 22, width: "100%", justifyContent: "center" }}>
          {busy ? "Opening secure checkout…" : paymentMethod === "crypto" && cryptoAvailable ? `Pay ${money(price.total, plan.currency)} with crypto` : `Pay ${money(price.total, plan.currency)}`}
          {!busy ? <ArrowRight size={17} /> : null}
        </button>
        <Link href="/pricing" className="button-secondary" style={{ marginTop: 10, width: "100%", justifyContent: "center" }}>Back to pricing</Link>
      </article>
    </section>
  );
}
