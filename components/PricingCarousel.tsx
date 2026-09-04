"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BellRing, CheckCircle2, Layers3, MessageSquareText, Network } from "@/components/admin/ServerIcons";
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
};

type PlanPresentation = Pick<PricingCarouselPlan, "icon" | "name" | "description" | "features">;

const publicPlanPresentation: Record<string, PlanPresentation> = {
  "whatsapp-ai-starter": {
    icon: MessageSquareText,
    name: "Basic",
    description: "One AI customer-support channel for conversations, questions, enquiries and human handoff. Choose WhatsApp AI or Web AI support.",
    features: [
      "WhatsApp AI or Web AI support",
      "24/7 questions and enquiries",
      "Approved product, service and FAQ responses",
      "Basic customer and lead capture",
      "Conversation history",
      "Human-agent handoff",
      "Basic dashboard access",
    ],
  },
  "ai-call-receptionist": {
    icon: BellRing,
    name: "Starter Business",
    description: "Everything in Basic, plus automated follow-up and reminders around the products or services customers enquire about.",
    features: [
      "Everything in Basic",
      "Automated customer follow-up",
      "Product or service-specific follow-up",
      "Reminder automation",
      "Follow-up timing rules",
      "Lead and customer status tracking",
      "Increased usage credits",
      "Human handoff with context",
    ],
  },
  "ai-front-desk-suite": {
    icon: Network,
    name: "Business+",
    description: "A connected customer automation system with higher limits across WhatsApp, web, email, CRM, scheduling, reminders and follow-up.",
    features: [
      "Everything in Starter Business",
      "Higher usage credits",
      "WhatsApp, Web and Email automation",
      "Automated email follow-up",
      "Multi-channel follow-up",
      "Lead qualification",
      "CRM and pipeline automation",
      "Scheduling and booking workflows",
      "Shared dashboard and admin visibility",
      "Supported integrations",
    ],
  },
  "custom-ai-operations": {
    icon: Layers3,
    name: "Custom",
    description: "A custom AI operating system built around multiple agents, departments, databases, memberships, workflows and integrations.",
    features: [
      "Everything in Business+",
      "Multiple AI agents",
      "Multiple teams, departments or branches",
      "Custom databases",
      "Membership systems",
      "Customer or member portals",
      "Advanced workflow automation",
      "Custom CRM and operating workflows",
      "Custom integrations",
      "Role-based staff access",
      "Workflow monitoring",
      "Managed deployment and support",
    ],
  },
};

const planDecisionCopy: Record<string, { fit: string; outcome: string; cta: string }> = {
  "whatsapp-ai-starter": {
    fit: "Businesses that need reliable AI responses on WhatsApp or the web",
    outcome: "Handle questions and enquiries faster, then hand the right conversations to staff. Follow-up and reminders are not included at this level.",
    cta: "Start with Basic",
  },
  "ai-call-receptionist": {
    fit: "Businesses that need customer conversations to continue after the first enquiry",
    outcome: "Add automatic follow-up and reminders so interested customers are less likely to disappear between conversations.",
    cta: "Start with Starter Business",
  },
  "ai-front-desk-suite": {
    fit: "Growing businesses that need one connected customer automation system",
    outcome: "Connect conversations, follow-up, email, qualification, CRM and scheduling with higher usage capacity.",
    cta: "Deploy Business+",
  },
  "custom-ai-operations": {
    fit: "Organizations with multiple teams, databases, membership models or custom operating workflows",
    outcome: "Build automation around the organization instead of forcing the organization into a fixed package.",
    cta: "Plan a custom system",
  },
};

export default function PricingCarousel({ plans, compact = false }: PricingCarouselProps) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<number | null>(null);
  const programmaticRef = useRef<number | null>(null);
  const { prices, currency } = usePublicPricing();

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
        </div>
        <div>
          <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous pricing plan"><ArrowLeft size={18} /></button>
          <button type="button" onClick={() => move(1)} disabled={active === presentedPlans.length - 1} aria-label="Next pricing plan"><ArrowRight size={18} /></button>
        </div>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {presentedPlans.map((plan, index) => {
          const Icon = plan.icon;
          const detected = prices[plan.slug];
          const firstPrice = detected?.first ?? plan.firstMonth ?? plan.first ?? "Custom";
          const ongoingPrice = detected?.ongoing ?? plan.ongoing;
          const isCustom = plan.custom || plan.slug === "custom-ai-operations";
          const href = isCustom ? "/evaluation" : `/checkout?plan=${encodeURIComponent(plan.slug)}`;
          const decision = planDecisionCopy[plan.slug];
          const ctaLabel = decision?.cta ?? plan.cta ?? "Get started";
          return (
            <article className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`} key={plan.slug} aria-label={`${plan.name}${plan.featured ? ", most complete ready-made plan" : ""}`}>
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardHeader}>
                <span className={styles.icon}><Icon size={22} /></span>
                {plan.featured ? <span className={styles.badge}>Most complete ready-made plan</span> : null}
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
                <div><span>First month · installation + deployment</span><strong>{firstPrice}</strong></div>
                <div><span>Then</span><strong>{ongoingPrice}</strong></div>
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
