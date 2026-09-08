"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Layers3, MessageSquareText, Network, Workflow } from "@/components/admin/ServerIcons";
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

const pricingFrameworkSlugs = new Set(["basic", "plus", "starter", "business", "business-plus"]);
const checkoutSlugByFramework: Record<string, string> = {
  basic: "whatsapp-ai-starter",
  plus: "ai-call-receptionist",
  starter: "ai-call-receptionist",
  business: "ai-front-desk-suite",
  "business-plus": "custom-ai-operations",
};
const durationOptions = [
  { months: 1, label: "1 month" },
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
] as const;

const publicPlanPresentation: Record<string, PlanPresentation> = {
  "whatsapp-ai-starter": {
    icon: MessageSquareText,
    name: "Basic",
    description: "A focused AI front desk for questions, enquiries, qualification, customer capture and human handoff.",
    features: [
      "2,500 monthly Flux Credits",
      "WhatsApp AI or Web AI support",
      "24/7 questions and enquiries",
      "Approved product, service and FAQ responses",
      "Basic customer and lead capture",
      "Conversation history",
      "Human-agent handoff",
      "Leo Chat",
      "Basic dashboard access",
    ],
  },
  "ai-call-receptionist": {
    icon: Workflow,
    name: "Plus",
    description: "Everything in Basic, plus automated follow-up, reminders, nurture and missed-lead recovery.",
    features: [
      "5,000 monthly Flux Credits",
      "Everything in Basic",
      "Automated customer follow-up",
      "Product or service-specific follow-up",
      "Appointment, booking, quote or inspection reminders",
      "Missed-lead recovery",
      "Scheduled nurture sequences",
      "Simple lead status tracking",
    ],
  },
  "ai-front-desk-suite": {
    icon: Network,
    name: "Business",
    description: "A connected customer operations system with higher usage, admin controls, cross-channel workflows, reporting and Leo Admin Assistance.",
    features: [
      "12,000 monthly Flux Credits",
      "Everything in Plus",
      "Higher monthly usage and AI credits",
      "Admin workspace and team access",
      "WhatsApp and email follow-up",
      "Leo Voice",
      "Cross-channel customer context",
      "Workflow visibility and reporting",
      "Human escalation controls",
      "Leo Admin Assistance",
    ],
  },
  "custom-ai-operations": {
    icon: Layers3,
    name: "Business+",
    description: "A custom AI operating system with industry databases, deeper workflows, integrations, dashboards and operational data systems.",
    features: [
      "25,000+ configurable monthly Flux Credits",
      "Everything in Business",
      "Industry-specific customer or operations database",
      "Custom client, member or operational records",
      "Deeper record history and lifecycle visibility",
      "Advanced reporting and segmentation",
      "Custom workflows and integrations",
      "Custom dashboards where required",
      "Managed deployment and support",
    ],
  },
};

const planDecisionCopy: Record<string, { fit: string; outcome: string; cta: string }> = {
  "whatsapp-ai-starter": {
    fit: "Businesses that need a reliable AI front desk without follow-up workflows",
    outcome: "Handle questions and enquiries faster, qualify customers, capture details and hand the right conversations to staff.",
    cta: "Start with Basic",
  },
  "ai-call-receptionist": {
    fit: "Businesses that need customer conversations to continue after the first enquiry",
    outcome: "Add automatic follow-up, reminders and missed-lead recovery so interested customers are less likely to disappear.",
    cta: "Start with Plus",
  },
  "ai-front-desk-suite": {
    fit: "Growing organizations that need a connected customer operations layer",
    outcome: "Coordinate conversations, follow-up, email, voice, reporting and staff visibility with higher usage capacity.",
    cta: "Deploy Business",
  },
  "custom-ai-operations": {
    fit: "Organizations that need databases, deeper integrations or custom operating workflows",
    outcome: "Build the system around the organization, including customer databases and industry-specific operational structures.",
    cta: "Plan Business+",
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
  const [durationMonths, setDurationMonths] = useState(1);
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

  const presentedPlans = plans.map((plan) => ({
    ...plan,
    ...(publicPlanPresentation[plan.slug] || {}),
  }));

  const goTo = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    const card = track?.children[index] as HTMLElement | undefined;
    if (!track || !card) return;

    setActive(index);
    window.requestAnimationFrame(() => {
      if (behavior === "smooth") {
        card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        return;
      }
      track.scrollLeft = 0;
    });

    if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
    programmaticRef.current = window.setTimeout(() => {
      programmaticRef.current = null;
    }, behavior === "smooth" ? 700 : 40);
  }, []);

  useEffect(() => () => {
    if (settledRef.current !== null) window.clearTimeout(settledRef.current);
    if (programmaticRef.current !== null) window.clearTimeout(programmaticRef.current);
  }, []);

  const updateActive = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    const cards = Array.from(track.children) as HTMLElement[];
    let closest = 0;
    let distance = Number.POSITIVE_INFINITY;

    cards.forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.clientWidth / 2;
      const nextDistance = Math.abs(cardCenter - center);
      if (nextDistance < distance) {
        closest = index;
        distance = nextDistance;
      }
    });
    setActive(closest);
  };

  const onScroll = () => {
    if (programmaticRef.current !== null) return;
    if (settledRef.current !== null) window.clearTimeout(settledRef.current);
    settledRef.current = window.setTimeout(updateActive, 80);
  };

  const move = (direction: number) => {
    const next = Math.min(presentedPlans.length - 1, Math.max(0, active + direction));
    goTo(next);
  };

  return (
    <div className={`${styles.carousel} ${compact ? styles.compact : ""}`} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    }} aria-roledescription="carousel" aria-label="Fluxknight pricing plans">
      <div className={styles.topControls}>
        <div className={styles.controlCopy}>
          <p aria-live="polite">Plan {active + 1} of {presentedPlans.length}</p>
          <span>{currency ? `Pricing shown in ${currency} · ` : ""}Swipe or use the arrows to compare</span>
          {canViewInternational ? (
            <div className={styles.regionSwitch} aria-label="Choose pricing view">
              <button type="button" className={!viewingInternational ? styles.regionSwitchActive : ""} onClick={showNigeria}>Nigeria</button>
              <button type="button" className={viewingInternational ? styles.regionSwitchActive : ""} onClick={showInternational}>International</button>
            </div>
          ) : null}
        </div>
        <div className={styles.arrowControls}>
          <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous pricing plan"><ArrowLeft size={18} /></button>
          <button type="button" onClick={() => move(1)} disabled={active === presentedPlans.length - 1} aria-label="Next pricing plan"><ArrowRight size={18} /></button>
        </div>
      </div>

      {showDurationSelector ? (
        <div className={styles.durationBar}>
          <div>
            <span className={styles.durationLabel}>Choose duration</span>
            <div className={styles.durationOptions} role="group" aria-label="Choose plan duration">
              {durationOptions.map((option) => (
                <button
                  key={option.months}
                  type="button"
                  className={durationMonths === option.months ? styles.durationActive : styles.durationButton}
                  aria-pressed={durationMonths === option.months}
                  onClick={() => setDurationMonths(option.months)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <small>Current rates are used for the selected term. First-month setup is paid at checkout, then platform billing continues monthly.</small>
        </div>
      ) : null}

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const detected = prices[plan.slug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing;
          const isCustom = plan.custom || plan.slug === "custom-ai-operations" || plan.slug === "business-plus";
          const isFrameworkPlan = pricingFrameworkSlugs.has(plan.slug);
          const checkoutSlug = isFrameworkPlan ? checkoutSlugByFramework[plan.slug] : plan.slug;
          const href = isCustom
            ? `/evaluation?plan=${encodeURIComponent(plan.slug === "custom-ai-operations" ? "business-plus" : plan.slug)}`
            : `/checkout?plan=${encodeURIComponent(checkoutSlug)}${showDurationSelector ? `&term=${durationMonths}` : ""}`;
          const decision = planDecisionCopy[plan.slug];
          const ctaLabel = decision?.cta ?? plan.cta ?? "Get started";
          const termValue = showDurationSelector && detected && !detected.custom
            ? detected.installationFee + Math.max(0, durationMonths - 1) * detected.recurringFee
            : null;
          return (
            <article className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`} key={plan.slug} aria-label={`${plan.name}${plan.featured ? ", recommended business plan" : ""}`}>
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardHeader}>
                <span className={styles.icon}><Icon size={22} /></span>
                {plan.featured ? <span className={styles.badge}>Recommended</span> : null}
              </div>
              <h3>{plan.name}</h3>
              <p className={styles.description}>{plan.description ?? plan.tag}</p>
              {decision ? (
                <div className={styles.decisionBlock}>
                  <span>Best for</span>
                  <strong>{decision.fit}</strong>
                  <p>{decision.outcome}</p>
                </div>
              ) : null}
              <div className={styles.priceBlock}>
                <div><span>First month · setup + service</span><strong>{firstPrice}</strong></div>
                <div><span>From month 2</span><strong>{ongoingPrice}</strong></div>
                {termValue !== null && detected ? (
                  <div className={styles.termValue}>
                    <span>{durationMonths}-month term value at current rate</span>
                    <strong>{formatMoney(detected.currency, termValue)}</strong>
                  </div>
                ) : null}
              </div>
              <h4>What&apos;s included</h4>
              <div className={styles.features}>{plan.features.map((feature) => <span key={feature}><CheckCircle2 size={16} />{feature}</span>)}</div>
              <Link className={styles.cta} href={href} aria-label={`${ctaLabel} with ${plan.name}`}>{ctaLabel} <ArrowRight size={16} /></Link>
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
