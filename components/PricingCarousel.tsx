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
  { key: "monthly", label: "Monthly" },
  { key: "3m", label: "3 months", saving: "Save 10%" },
  { key: "6m", label: "6 months", saving: "Save 15%" },
  { key: "12m", label: "1 year", saving: "Save 20%" },
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

const planDecisionCopy: Record<string, { fit: string; outcome: string; cta: string }> = {
  "whatsapp-ai-starter": {
    fit: "Businesses that need one reliable AI customer-service channel without follow-up workflows",
    outcome: "Handle questions and enquiries faster, qualify customers, capture details and hand the right conversations to staff.",
    cta: "Start with Basic",
  },
  "ai-call-receptionist": {
    fit: "Businesses that need up to two channels and customer conversations to continue after the first enquiry",
    outcome: "Add automated follow-up, reminders and missed-lead recovery with higher monthly credits.",
    cta: "Start with Plus",
  },
  "ai-front-desk-suite": {
    fit: "Growing organizations that need a connected multi-channel customer operations layer",
    outcome: "Coordinate conversations, follow-up, reporting, staff visibility and customer context with higher usage capacity.",
    cta: "Deploy Business",
  },
  "custom-ai-operations": {
    fit: "Organizations that need deeper operational data, advanced workflows, integrations and higher configurable usage",
    outcome: "Connect customer conversations to structured business records, dashboards and advanced operational workflows.",
    cta: "Deploy Business+",
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
            <span className={styles.durationLabel}>Billing duration</span>
            <div className={styles.durationOptions} role="group" aria-label="Choose billing duration">
              {durationOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={billingTerm === option.key ? styles.durationActive : styles.durationButton}
                  aria-pressed={billingTerm === option.key}
                  onClick={() => setBillingTerm(option.key)}
                >
                  <span>{option.label}</span>
                  {option.saving ? <small>{option.saving}</small> : <small>Standard</small>}
                </button>
              ))}
            </div>
          </div>
          <small>Monthly keeps standard renewal. Prepay 3, 6 or 12 months to apply the existing duration savings at checkout.</small>
        </div>
      ) : null}

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const detected = prices[plan.slug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing;
          const isCustom = detected?.custom ?? plan.custom ?? (plan.slug === "custom-ai-operations");
          const isFrameworkPlan = pricingFrameworkSlugs.has(plan.slug);
          const checkoutSlug = detected?.slug ?? (isFrameworkPlan ? checkoutSlugByFramework[plan.slug] : plan.slug);
          const prepaid = billingTerm !== "monthly" && detected && !detected.custom
            ? calculatePrepaidPrice(detected.installationFee, detected.recurringFee, billingTerm)
            : null;
          const href = isCustom
            ? `/evaluation?plan=${encodeURIComponent(plan.slug === "custom-ai-operations" ? "business-plus" : plan.slug)}`
            : `/checkout?plan=${encodeURIComponent(checkoutSlug)}${showDurationSelector && billingTerm !== "monthly" ? `&term=${encodeURIComponent(billingTerm)}` : ""}`;
          const decision = planDecisionCopy[plan.slug];
          const ctaLabel = decision?.cta ?? plan.cta ?? "Get started";
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
                <div><span>Implementation</span><strong>{firstPrice}</strong></div>
                <div><span>Monthly renewal</span><strong>{ongoingPrice}</strong></div>
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
