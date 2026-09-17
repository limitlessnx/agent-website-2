"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import type { PricingCarouselPlan } from "@/components/PricingCarousel";
import { calculatePrepaidPrice, type PrepaidTerm } from "@/lib/payments/terms";
import { usePublicPricing } from "@/lib/use-public-pricing";
import styles from "./HomePricingOverview.module.css";

type BillingTerm = "monthly" | PrepaidTerm;

const checkoutSlugByFramework: Record<string, string> = {
  basic: "whatsapp-ai-starter",
  plus: "ai-call-receptionist",
  starter: "ai-call-receptionist",
  business: "ai-front-desk-suite",
  "business-plus": "custom-ai-operations",
};

const terms: Array<{ key: BillingTerm; label: string; saving?: string }> = [
  { key: "monthly", label: "Monthly" },
  { key: "6m", label: "6 Months", saving: "Save 15%" },
  { key: "12m", label: "Yearly", saving: "Save 20%" },
];

function canonicalSlug(slug: string) {
  return checkoutSlugByFramework[slug] ?? slug;
}

function money(currency: "NGN" | "USD", amount: number) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function HomePricingOverview({ plans }: { plans: PricingCarouselPlan[] }) {
  const [term, setTerm] = useState<BillingTerm>("monthly");
  const trackRef = useRef<HTMLDivElement>(null);
  const { prices, currency, canViewInternational, viewingInternational, showInternational, showNigeria } = usePublicPricing();

  const move = (direction: number) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("article");
    const step = (card?.offsetWidth ?? 280) + 16;
    track.scrollBy({ left: step * direction, behavior: "smooth" });
  };

  return (
    <div className={styles.pricing}>
      <div className={styles.controls}>
        <div className={styles.termSwitch} aria-label="Billing duration">
          {terms.map((option) => (
            <button key={option.key} type="button" onClick={() => setTerm(option.key)} className={term === option.key ? styles.termActive : ""} aria-pressed={term === option.key}>
              <span>{option.label}</span>{option.saving ? <small>{option.saving}</small> : null}
            </button>
          ))}
        </div>
        {canViewInternational ? (
          <div className={styles.regionSwitch} aria-label="Pricing region">
            <button type="button" onClick={showNigeria} className={!viewingInternational ? styles.regionActive : ""}>Nigeria</button>
            <button type="button" onClick={showInternational} className={viewingInternational ? styles.regionActive : ""}>International</button>
          </div>
        ) : <span className={styles.currencyNote}>{currency ? `Pricing shown in ${currency}` : ""}</span>}
      </div>

      <div className={styles.carouselWrap}>
        <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={() => move(-1)} aria-label="Previous pricing plans"><ArrowLeft size={18}/></button>
        <div className={styles.track} ref={trackRef} tabIndex={0} aria-label="Fluxknight pricing plans">
          {plans.map((plan) => {
            const canonical = canonicalSlug(plan.slug);
            const detected = prices[plan.slug] ?? prices[canonical];
            const isCustom = plan.custom === true || plan.slug === "custom";
            const implementation = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
            const renewal = detected?.ongoing ?? plan.ongoing;
            const prepaid = term !== "monthly" && detected && !isCustom ? calculatePrepaidPrice(detected.installationFee, detected.recurringFee, term) : null;
            const checkoutSlug = detected?.slug ?? canonical;
            const href = isCustom ? `/evaluation?plan=${encodeURIComponent(plan.slug)}` : `/checkout?plan=${encodeURIComponent(checkoutSlug)}${term !== "monthly" ? `&term=${encodeURIComponent(term)}` : ""}`;
            const isBasic = plan.slug === "basic";

            return (
              <article key={plan.slug} className={`${styles.card} ${plan.featured ? styles.featured : ""}`}>
                <div className={styles.cardTop}>
                  <h3>{plan.name}</h3>
                  {plan.featured ? <span className={styles.popular}>Recommended</span> : isBasic ? <span className={styles.trial}>14-day trial</span> : null}
                </div>
                <div className={styles.price}>
                  <span>Implementation</span>
                  <strong>{implementation}</strong>
                  <small>{isCustom ? "Tailored to your workflow" : `then ${renewal}`}</small>
                </div>
                {prepaid && detected ? <p className={styles.prepaid}>{prepaid.label}: <strong>{money(detected.currency, prepaid.total)}</strong> · save {prepaid.discountPercent}%</p> : <div className={styles.prepaidSpacer}/>} 
                <p className={styles.description}>{plan.description}</p>
                {isBasic ? (
                  <Link href="/account/signup?trial=basic&next=%2Fportal" className={`${styles.cta} ${styles.primaryCta}`}>Start Free Trial</Link>
                ) : (
                  <Link href={href} className={`${styles.cta} ${plan.featured ? styles.primaryCta : ""}`}>{plan.cta ?? "Get Started"}</Link>
                )}
                <div className={styles.features}>
                  {plan.features.slice(0,5).map((feature) => <span key={feature}><CheckCircle2 size={15}/>{feature}</span>)}
                </div>
                {isBasic ? <Link href={href} className={styles.paidLink}>Choose paid Basic</Link> : null}
              </article>
            );
          })}
        </div>
        <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={() => move(1)} aria-label="Next pricing plans"><ArrowRight size={18}/></button>
      </div>
      <div className={styles.swipeHint}>Swipe or use the arrows to compare all five plans.</div>
    </div>
  );
}
