"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
import type { PricingCarouselPlan } from "@/components/PricingCarousel";
import { usePublicPricing } from "@/lib/use-public-pricing";
import styles from "./HomePricingOverview.module.css";


const checkoutSlugByFramework: Record<string, string> = {
  basic: "whatsapp-ai-starter",
  plus: "ai-call-receptionist",
  starter: "ai-call-receptionist",
  business: "ai-front-desk-suite",
  "business-plus": "custom-ai-operations",
};


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

export default function HomePricingOverview({ plans }: { plans: Array<Omit<PricingCarouselPlan, "icon">> }) {
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
        <span className={styles.currencyNote}>Simple monthly subscriptions · no setup fees</span>
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
            const monthlyPrice = detected?.ongoing ?? plan.ongoing;
            const checkoutSlug = detected?.slug ?? canonical;
            const href = isCustom ? `/evaluation?plan=${encodeURIComponent(plan.slug)}` : `/checkout?plan=${encodeURIComponent(checkoutSlug)}`;
            const isBasic = plan.slug === "basic";

            return (
              <article key={plan.slug} className={`${styles.card} ${plan.featured ? styles.featured : ""}`}>
                <div className={styles.cardTop}>
                  <h3>{plan.name}</h3>
                  {plan.featured ? <span className={styles.popular}>Recommended</span> : isBasic ? <span className={styles.trial}>14-day trial</span> : null}
                </div>
                <div className={styles.price}>
                  <span>{isCustom ? "Monthly pricing" : "Monthly subscription"}</span>
                  <strong>{monthlyPrice}</strong>
                  <small>{isCustom ? "Tailored to your workflow" : "No installation fee"}</small>
                </div>
 
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
