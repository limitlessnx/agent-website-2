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
  ongoing?: string;
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
};

type PlanPresentation = Pick<PricingCarouselPlan, "icon" | "name" | "description" | "features">;

const pricingFrameworkSlugs = new Set(["basic", "plus", "starter", "business", "business-plus"]);

const publicPlanPresentation: Record<string, PlanPresentation> = {
  "whatsapp-ai-starter": {
    icon: MessageSquareText,
    name: "Basic",
    description: "A focused AI front desk for questions, enquiries, qualification, customer capture and human handoff.",
    features: [
      "2,500 monthly Flux Credits",
      "One primary customer route",
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
    description: "Everything in Basic, with follow-up and reminders on one selected customer route: WhatsApp AI or a Voice Call Agent.",
    features: [
      "5,000 monthly Flux Credits",
      "Everything in Basic",
      "Choose one route: WhatsApp AI or Voice Call Agent",
      "Automated follow-up on the selected route",
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
    description: "A connected customer operations system where multiple AI agents and customer routes can work together with email automation, higher usage and admin controls.",
    features: [
      "12,000 monthly Flux Credits",
      "Everything in Plus",
      "Multiple AI agents and routes working together",
      "WhatsApp AI + Voice Call Agent + Web AI as configured",
      "Email automation and email follow-up",
      "Higher monthly usage and AI credits",
      "Admin workspace and team access",
      "Leo Voice",
      "Cross-channel customer context",
      "Workflow visibility and reporting",
      "Human escalation controls",
      "Leo Admin Assistance",
    ],
  },
  "custom-ai-operations": {
    icon: Layers3,
    name: "Custom",
    description: "A tailored AI operating system for organizations that need industry databases, deeper workflows, integrations, dashboards or operational data systems.",
    features: [
      "Configurable Flux Credit allowance",
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
    fit: "Businesses that want one customer route with automated follow-up and reminders",
    outcome: "Choose WhatsApp AI or a Voice Call Agent, then keep customers moving with follow-up, reminders and missed-lead recovery on that route.",
    cta: "Start with Plus",
  },
  "ai-front-desk-suite": {
    fit: "Growing organizations that need several AI agents and channels working together",
    outcome: "Run WhatsApp, voice and web agents together as configured, add email automation, and give staff one connected operational view.",
    cta: "Deploy Business",
  },
  "custom-ai-operations": {
    fit: "Organizations that need databases, deeper integrations or custom operating workflows",
    outcome: "Scope the system around the organization, including customer databases, industry-specific structures and bespoke integrations.",
    cta: "Discuss Custom",
  },
};

export default function PricingCarousel({ plans, compact = false }: PricingCarouselProps) {
  const [active, setActive] = useState(0);
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

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const detected = prices[plan.slug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing ?? "";
          const isCustom = plan.custom || plan.slug === "custom-ai-operations" || plan.slug === "business-plus";
          const isFrameworkPlan = pricingFrameworkSlugs.has(plan.slug);
          const href = isCustom
            ? "/evaluation"
            : isFrameworkPlan
              ? `/pricing?plan=${encodeURIComponent(plan.slug)}#plan-details`
              : `/checkout?plan=${encodeURIComponent(plan.slug)}`;
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
              {!isCustom ? (
                <div className={styles.priceBlock}>
                  <div><span>Implementation</span><strong>{firstPrice}</strong></div>
                  <div><span>Ongoing platform &amp; support</span><strong>{ongoingPrice}</strong></div>
                </div>
              ) : null}
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
