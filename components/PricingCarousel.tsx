"use client";

import type { ComponentType } from "react";
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
    description: "One AI customer-service channel for questions, enquiries, qualification, capture and human handoff.",
    features: [
      "2,500 monthly Flux Credits",
      "Choose 1 channel: Website AI, WhatsApp AI, or Voice Agent",
      "24/7 questions and enquiries",
      "Approved product, service and FAQ responses",
      "Basic customer and lead capture",
      "Up to 2 human handoff recipients",
      "Conversation history",
      "Basic dashboard access",
      "No automated follow-up or reminder sequences",
    ],
  },
  "ai-call-receptionist": {
    icon: Workflow,
    name: "Plus",
    description: "Everything in Basic, with higher credits, up to two channels, automated follow-up, reminders, nurture and missed-lead recovery.",
    features: [
      "5,000 monthly Flux Credits",
      "Everything in Basic",
      "Use up to 2 customer channels",
      "Examples: WhatsApp + Voice, Website + WhatsApp, or Website + Voice",
      "Automated customer follow-up",
      "Product or service-specific follow-up",
      "Appointment, booking, quote, inspection, payment or renewal reminders where relevant",
      "Missed-lead recovery",
      "Scheduled nurture and re-engagement sequences",
    ],
  },
  "ai-front-desk-suite": {
    icon: Network,
    name: "Business",
    description: "A connected customer operations system with higher usage, admin controls, cross-channel workflows, reporting and Leo Admin Assistance.",
    features: [
      "12,000 monthly Flux Credits",
      "Everything in Plus",
      "Multi-channel customer operations",
      "Website, WhatsApp, Voice and Email workflows where applicable",
      "Admin workspace and team access",
      "Cross-channel customer context",
      "CRM and workflow visibility",
      "Reporting and operational oversight",
      "Expanded human escalation controls",
      "Leo Admin Assistance",
    ],
  },
  "custom-ai-operations": {
    icon: Layers3,
    name: "Business+",
    description: "Advanced customer operations with configurable credits, industry databases, deeper workflows, integrations, dashboards and operational data systems.",
    features: [
      "25,000+ configurable monthly Flux Credits",
      "Everything in Business",
      "Industry-specific customer or operations database",
      "Custom client, member or operational records",
      "Advanced workflow automation",
      "Deeper record history and lifecycle visibility",
      "Advanced reporting and segmentation",
      "Custom integrations where required",
      "Custom dashboards where required",
      "Managed deployment and support",
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

  const presentedPlans = plans.map((plan) => ({ ...plan, ...(publicPlanPresentation[plan.slug] || {}) }));

  const goTo = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;

    const nextIndex = Math.min(presentedPlans.length - 1, Math.max(0, index));
    const nextCard = track.children[nextIndex] as HTMLElement | undefined;
    if (!nextCard) return;

    setActive(nextIndex);
    const left = nextCard.offsetLeft - (track.clientWidth - nextCard.clientWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior });

    if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
    programmaticRef.current = window.setTimeout(() => { programmaticRef.current = null; }, behavior === "smooth" ? 450 : 40);
  }, [presentedPlans.length]);

  useEffect(() => () => {
    if (settledRef.current !== null) window.clearTimeout(settledRef.current);
    if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
  }, []);

  const updateActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    const cards = Array.from(track.children) as HTMLElement[];
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;
    cards.forEach((card, index) => {
      const nextDistance = Math.abs(card.offsetLeft + card.clientWidth / 2 - center);
      if (nextDistance < distance) {
        closest = index;
        distance = nextDistance;
      }
    });
    setActive(closest);
  }, []);

  const onScroll = () => {
    if (programmaticRef.current !== null) return;
    if (settledRef.current !== null) window.clearTimeout(settledRef.current);
    settledRef.current = window.setTimeout(updateActive, 70);
  };

  const move = (direction: number) => goTo(active + direction);

  const regionControl = canViewInternational ? (
    <div className={styles.regionSwitch} aria-label="Choose pricing view">
      <button type="button" className={!viewingInternational ? styles.regionSwitchActive : ""} onClick={showNigeria}>Nigeria</button>
      <button type="button" className={viewingInternational ? styles.regionSwitchActive : ""} onClick={showInternational}>International</button>
    </div>
  ) : null;

  const durationControl = showDurationSelector ? (
    <label className={styles.durationField}>
      <span className={styles.durationLabel}>Billing duration</span>
      <span className={styles.durationSelectWrap}>
        <select value={billingTerm} onChange={(event) => setBillingTerm(event.target.value as BillingTerm)} aria-label="Choose billing duration" className={styles.durationSelect}>
          {durationOptions.map((option) => <option key={option.key} value={option.key}>{option.label} · {option.saving}</option>)}
        </select>
        <span aria-hidden="true" className={styles.durationCaret}>⌄</span>
      </span>
    </label>
  ) : null;

  return (
    <div className={`${styles.carousel} ${compact ? styles.compact : ""}`} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    }} aria-roledescription="carousel" aria-label="Fluxknight pricing plans">
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
        {showDurationSelector ? <div className={styles.durationBar}>{durationControl}<small>Monthly keeps the standard renewal. Prepaid terms apply the existing savings directly to each plan.</small></div> : null}
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
        <div className={styles.mobileControlGrid}>
          {regionControl}
          {durationControl}
        </div>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const detected = prices[plan.slug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing;
          const isCustom = detected?.custom ?? plan.custom ?? (plan.slug === "custom-ai-operations");
          const isFrameworkPlan = pricingFrameworkSlugs.has(plan.slug);
          const isBasic = plan.slug === "basic" || detected?.slug === "whatsapp-ai-starter";
          const checkoutSlug = detected?.slug ?? (isFrameworkPlan ? checkoutSlugByFramework[plan.slug] : plan.slug);
          const prepaid = billingTerm !== "monthly" && detected && !detected.custom
            ? calculatePrepaidPrice(detected.installationFee, detected.recurringFee, billingTerm)
            : null;
          const href = isCustom
            ? `/evaluation?plan=${encodeURIComponent(plan.slug === "custom-ai-operations" ? "business-plus" : plan.slug)}`
            : `/checkout?plan=${encodeURIComponent(checkoutSlug)}${showDurationSelector && billingTerm !== "monthly" ? `&term=${encodeURIComponent(billingTerm)}` : ""}`;
          const ctaLabel = plan.cta ?? "Get started";

          return (
            <article className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`} key={plan.slug} aria-label={`${plan.name}${plan.featured ? ", recommended business plan" : ""}`}>
              <div className={styles.cardGlow} aria-hidden="true" />

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
                <div><span>Monthly renewal</span><strong>{ongoingPrice}</strong></div>
                {prepaid && detected ? <div className={styles.termValue}><span>{prepaid.label} prepaid · save {prepaid.discountPercent}%</span><strong>{formatMoney(detected.currency, prepaid.total)}</strong><small>Save {formatMoney(detected.currency, prepaid.discount)} from {formatMoney(detected.currency, prepaid.subtotal)}</small></div> : null}
              </div>

              <h4>What&apos;s included</h4>
              <div className={styles.features}>{plan.features.map((feature) => <span key={feature}><CheckCircle2 size={16} />{feature}</span>)}</div>

              {isBasic ? (
                <div className={styles.ctaStack}>
                  <Link href="/account/signup?trial=basic&next=%2Fportal" className={styles.cta} aria-label="Start Basic free trial">Start Free Trial <ArrowRight size={16} /></Link>
                  <Link href={href} aria-label="Choose paid Basic" className={styles.secondaryCta}>Choose paid Basic <ArrowRight size={14} /></Link>
                </div>
              ) : <Link className={styles.cta} href={href} aria-label={`${ctaLabel} with ${plan.name}`}>{ctaLabel} <ArrowRight size={16} /></Link>}
            </article>
          );
        })}
      </div>

      <div className={styles.dots} role="group" aria-label="Choose a pricing plan">
        {presentedPlans.map((plan, index) => <button type="button" key={plan.slug} aria-current={index === active ? "true" : undefined} aria-label={`Show ${plan.name}`} className={index === active ? styles.dotActive : styles.dot} onClick={() => goTo(index)} />)}
      </div>
    </div>
  );
}
