"use client";

import type { ComponentType, MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Layers3, MessageSquareText, Network, Workflow } from "@/components/admin/ServerIcons";
import { calculatePrepaidPrice, type PrepaidTerm } from "@/lib/payments/terms";
import { usePublicPricing } from "@/lib/use-public-pricing";
import styles from "@/components/PricingCarousel.module.css";

export type PricingCarouselPlan = {
  icon: ComponentType<{ size?: number }>;
  slug: string;
  name: string;
  firstMonth?: string;
  first?: string;
  ongoing: string;
  description?: string;
  tag?: string;
  features: string[];
  cta?: string;
  featured?: boolean;
  custom?: boolean;
};

type PricingCarouselProps = {
  plans: PricingCarouselPlan[];
  compact?: boolean;
  showDurationSelector?: boolean;
};

type PlanPresentation = Pick<PricingCarouselPlan, "icon" | "name" | "description" | "features">;
type BillingTerm = "monthly" | PrepaidTerm;

const pricingFrameworkSlugs = new Set(["basic", "plus", "starter", "business", "business-plus"]);
const checkoutSlugByFramework: Record<string, string> = {
  basic: "whatsapp-ai-starter",
  plus: "ai-call-receptionist",
  starter: "ai-call-receptionist",
  business: "ai-front-desk-suite",
  "business-plus": "custom-ai-operations",
};

const durationOptions: Array<{ key: BillingTerm; label: string; saving?: string }> = [
  { key: "monthly", label: "Monthly", saving: "Standard" },
  { key: "6m", label: "6 months", saving: "Save 15%" },
  { key: "12m", label: "Yearly", saving: "Save 20%" },
];

const publicPlanPresentation: Record<string, PlanPresentation> = {
  "whatsapp-ai-starter": {
    icon: MessageSquareText,
    name: "Basic",
    description: "One AI channel for enquiries, support, qualification, capture and human handoff.",
    features: [
      "2,500 monthly Flux Credits",
      "1 channel: Website, WhatsApp or Voice",
      "24/7 enquiries and support",
      "Approved product, service and FAQ answers",
      "Lead capture + basic qualification",
      "Up to 2 human handoff recipients",
      "Conversation history + dashboard",
      "No automated follow-up or reminders",
    ],
  },
  "ai-call-receptionist": {
    icon: Workflow,
    name: "Plus",
    description: "Two channels with automated follow-up, reminders, nurture and missed-lead recovery.",
    features: [
      "5,000 monthly Flux Credits",
      "Everything in Basic",
      "Up to 2 customer channels",
      "Automated follow-up + reminders",
      "Product or service follow-up",
      "Missed-lead recovery",
      "Nurture + re-engagement sequences",
      "Human handoff across both channels",
    ],
  },
  "ai-front-desk-suite": {
    icon: Network,
    name: "Business",
    description: "Connected multi-channel customer operations with team controls, CRM visibility, reporting and Leo assistance.",
    features: [
      "12,000 monthly Flux Credits",
      "Everything in Plus",
      "Website, WhatsApp, Voice + Email workflows",
      "Admin workspace + team access",
      "Cross-channel customer context",
      "CRM + workflow visibility",
      "Reporting + escalation controls",
      "Leo Admin Assistance",
    ],
  },
  "custom-ai-operations": {
    icon: Layers3,
    name: "Business+",
    description: "Advanced operations with structured data, deeper workflows, integrations and dashboards.",
    features: [
      "25,000+ configurable Flux Credits",
      "Everything in Business",
      "Industry or operations database",
      "Custom records + lifecycle history",
      "Advanced workflow automation",
      "Advanced reporting + segmentation",
      "Custom integrations + dashboards",
      "Managed deployment + support",
    ],
  },
};

function formatMoney(currency: "NGN" | "USD", amount: number) {
  return new Intl.NumberFormat(currency === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function canonicalPricingSlug(slug: string) {
  return pricingFrameworkSlugs.has(slug) ? checkoutSlugByFramework[slug] : slug;
}

function visibleCardsForWidth(width: number) {
  if (width > 980) return 3;
  if (width > 640) return 2;
  return 1;
}

export default function PricingCarousel({ plans, compact = false, showDurationSelector = false }: PricingCarouselProps) {
  const [active, setActive] = useState(0);
  const [billingTerm, setBillingTerm] = useState<BillingTerm>("monthly");
  const trackRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<number | null>(null);
  const programmaticRef = useRef<number | null>(null);
  const {
    prices,
    currency,
    canViewInternational,
    viewingInternational,
    showInternational,
    showNigeria,
  } = usePublicPricing();

  const presentedPlans = plans.map((plan) => {
    const presentation = publicPlanPresentation[canonicalPricingSlug(plan.slug)];
    return { ...plan, ...(presentation || {}) };
  });

  const goTo = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;

    const nextIndex = Math.min(presentedPlans.length - 1, Math.max(0, index));
    const cards = Array.from(track.children) as HTMLElement[];
    const nextCard = cards[nextIndex];
    if (!nextCard) return;

    setActive(nextIndex);

    const visibleCount = visibleCardsForWidth(track.clientWidth);
    let targetLeft = 0;

    if (visibleCount === 1) {
      targetLeft = nextCard.offsetLeft - (track.clientWidth - nextCard.clientWidth) / 2;
    } else {
      const maxStartIndex = Math.max(0, cards.length - visibleCount);
      const startIndex = Math.min(maxStartIndex, Math.max(0, nextIndex - 1));
      targetLeft = cards[startIndex]?.offsetLeft ?? 0;
    }

    const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    track.scrollTo({ left: Math.min(maxLeft, Math.max(0, targetLeft)), behavior });

    if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
    programmaticRef.current = window.setTimeout(() => {
      programmaticRef.current = null;
    }, behavior === "smooth" ? 420 : 40);
  }, [presentedPlans.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (track) {
      track.scrollTo({ left: 0, behavior: "auto" });
      setActive(0);
    }

    const resetToStart = () => {
      const currentTrack = trackRef.current;
      if (!currentTrack) return;
      const visibleCount = visibleCardsForWidth(currentTrack.clientWidth);
      if (visibleCount > 1 && currentTrack.scrollLeft < 2) {
        currentTrack.scrollLeft = 0;
      }
    };

    window.addEventListener("resize", resetToStart);
    return () => {
      window.removeEventListener("resize", resetToStart);
      if (settledRef.current !== null) window.clearTimeout(settledRef.current);
      if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
    };
  }, []);

  const updateActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    const cards = Array.from(track.children) as HTMLElement[];
    if (!cards.length) return;

    const visibleCount = visibleCardsForWidth(track.clientWidth);
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;

    if (visibleCount === 1) {
      const center = track.scrollLeft + track.clientWidth / 2;
      cards.forEach((card, index) => {
        const nextDistance = Math.abs(card.offsetLeft + card.clientWidth / 2 - center);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
    } else {
      const leftEdge = track.scrollLeft;
      cards.forEach((card, index) => {
        const nextDistance = Math.abs(card.offsetLeft - leftEdge);
        if (nextDistance < distance) {
          closest = index;
          distance = nextDistance;
        }
      });
    }

    setActive(closest);
  }, []);

  const onScroll = () => {
    if (programmaticRef.current !== null) return;
    if (settledRef.current !== null) window.clearTimeout(settledRef.current);
    settledRef.current = window.setTimeout(updateActive, 80);
  };

  const move = (direction: number) => goTo(active + direction);

  const updateMousePos = (event: ReactMouseEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--mouse-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--mouse-y", `${event.clientY - rect.top}px`);
  };

  const regionControl = canViewInternational ? (
    <div className={styles.regionSwitch} aria-label="Choose pricing view">
      <button type="button" className={!viewingInternational ? styles.regionSwitchActive : ""} onClick={showNigeria}>Nigeria</button>
      <button type="button" className={viewingInternational ? styles.regionSwitchActive : ""} onClick={showInternational}>International</button>
    </div>
  ) : null;

  const durationControl = showDurationSelector ? (
    <div className={styles.durationField} aria-label="Billing duration">
      <span className={styles.durationLabel}>Billing duration</span>
      <div className={styles.durationSwitch}>
        {durationOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={billingTerm === option.key ? styles.durationActive : ""}
            onClick={() => setBillingTerm(option.key)}
            aria-pressed={billingTerm === option.key}
          >
            <span>{option.label}</span>
            <small>{option.saving}</small>
          </button>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <div
      className={`${styles.carousel} ${compact ? styles.compact : ""}`}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
        if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
      }}
      aria-roledescription="carousel"
      aria-label="Fluxknight pricing plans"
    >
      <div className={styles.structuralLines} aria-hidden="true"><span /><span /><span /><span /></div>

      <div className={styles.desktopControls}>
        <div className={styles.topControls}>
          <div className={styles.controlCopy}>
            <p aria-live="polite">Plan {active + 1} of {presentedPlans.length}</p>
            <span>{currency ? `Pricing shown in ${currency} · ` : ""}Swipe or use the arrows to compare</span>
            {regionControl}
          </div>
          <div className={styles.arrowControls}>
            <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous pricing plan"><ArrowLeft size={18} /></button>
            <button type="button" onClick={() => move(1)} disabled={active === presentedPlans.length - 1} aria-label="Next pricing plan"><ArrowRight size={18} /></button>
          </div>
        </div>
        {showDurationSelector ? <div className={styles.durationBar}>{durationControl}</div> : null}
      </div>

      <div className={styles.mobileToolbar}>
        <div className={styles.mobileControlTopline}>
          <div>
            <span className={styles.mobilePlanCount}>Plan {active + 1} of {presentedPlans.length}</span>
            <small>{currency ? `Pricing shown in ${currency}` : "Swipe to compare"}</small>
          </div>
          <div className={styles.arrowControls}>
            <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous pricing plan"><ArrowLeft size={15} /></button>
            <button type="button" onClick={() => move(1)} disabled={active === presentedPlans.length - 1} aria-label="Next pricing plan"><ArrowRight size={15} /></button>
          </div>
        </div>
        <div className={styles.mobileControlGrid}>{regionControl}{durationControl}</div>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const canonicalSlug = canonicalPricingSlug(plan.slug);
          const detected = prices[plan.slug] ?? prices[canonicalSlug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing;
          const isExplicitCustom = plan.custom === true || plan.slug === "custom";
          const isCustom = isExplicitCustom || (plan.slug !== "business-plus" && plan.custom === undefined && detected?.custom === true);
          const isBasic = plan.slug === "basic" || canonicalSlug === "whatsapp-ai-starter";
          const checkoutSlug = detected?.slug ?? canonicalSlug;
          const prepaid = billingTerm !== "monthly" && detected && !isCustom
            ? calculatePrepaidPrice(detected.installationFee, detected.recurringFee, billingTerm)
            : null;
          const href = isCustom
            ? `/evaluation?plan=${encodeURIComponent(plan.slug)}`
            : `/checkout?plan=${encodeURIComponent(checkoutSlug)}${showDurationSelector && billingTerm !== "monthly" ? `&term=${encodeURIComponent(billingTerm)}` : ""}`;
          const ctaLabel = plan.cta ?? "Get started";

          return (
            <article
              className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`}
              key={plan.slug}
              aria-label={`${plan.name}${plan.featured ? ", recommended business plan" : ""}`}
              onMouseMove={updateMousePos}
            >
              <div className={styles.flashlight} aria-hidden="true" />
              <i className={`${styles.corner} ${styles.cornerTL}`} aria-hidden="true" />
              <i className={`${styles.corner} ${styles.cornerTR}`} aria-hidden="true" />
              <i className={`${styles.corner} ${styles.cornerBL}`} aria-hidden="true" />
              <i className={`${styles.corner} ${styles.cornerBR}`} aria-hidden="true" />

              <div className={styles.cardHeader}>
                <span className={styles.icon}><Icon size={22} /></span>
                {isBasic ? <span className={styles.badge}>14-day free trial</span> : plan.featured ? <span className={styles.badge}>Recommended</span> : <span className={styles.badgeSpacer} aria-hidden="true" />}
              </div>

              <h3>{plan.name}</h3>
              <p className={styles.description}>{plan.description ?? plan.tag}</p>

              <div className={`${styles.planNote} ${isBasic ? styles.planNoteVisible : ""}`} aria-hidden={!isBasic}>
                {isBasic ? <><span>Try Basic before paying</span><strong>14 days · 250 Flux Credits</strong><small>Web AI + WhatsApp AI · no card required</small></> : <span>&nbsp;</span>}
              </div>

              <div className={styles.priceBlock}>
                <div><span>Implementation</span><strong>{firstPrice}</strong></div>
                <div><span>{billingTerm === "monthly" ? "Monthly renewal" : "Standard renewal"}</span><strong>{ongoingPrice}</strong></div>
                {prepaid && detected ? (
                  <div className={styles.termValue}>
                    <span>{prepaid.label} prepaid · save {prepaid.discountPercent}%</span>
                    <strong>{formatMoney(detected.currency, prepaid.total)}</strong>
                    <small>Save {formatMoney(detected.currency, prepaid.discount)} from {formatMoney(detected.currency, prepaid.subtotal)}</small>
                  </div>
                ) : null}
              </div>

              <h4>What&apos;s included</h4>
              <div className={styles.features}>{plan.features.map((feature) => <span key={feature}><CheckCircle2 size={16} />{feature}</span>)}</div>

              {isBasic ? (
                <div className={styles.ctaStack}>
                  <Link href="/account/signup?trial=basic&next=%2Fportal" className={styles.cta} aria-label="Start Basic free trial"><b />Start Free Trial <ArrowRight size={16} /></Link>
                  <Link href={href} aria-label="Choose paid Basic" className={styles.secondaryCta}>Choose paid Basic <ArrowRight size={14} /></Link>
                </div>
              ) : (
                <Link className={styles.cta} href={href} aria-label={`${ctaLabel} with ${plan.name}`}><b />{ctaLabel} <ArrowRight size={16} /></Link>
              )}
            </article>
          );
        })}
      </div>

      <div className={styles.dots} role="group" aria-label="Choose a pricing plan">
        {presentedPlans.map((plan, index) => (
          <button
            type="button"
            key={plan.slug}
            aria-current={index === active ? "true" : undefined}
            aria-label={`Show ${plan.name}`}
            className={index === active ? styles.dotActive : styles.dot}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
