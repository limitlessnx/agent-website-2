"use client";

import type { ComponentType } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "@/components/admin/ServerIcons";
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

const planDecisionCopy: Record<string, { fit: string; outcome: string; cta: string }> = {
  "whatsapp-ai-starter": {
    fit: "Businesses getting most enquiries through WhatsApp",
    outcome: "Answer, qualify and follow up without adding another full-time responder.",
    cta: "Start with WhatsApp AI",
  },
  "ai-call-receptionist": {
    fit: "Businesses missing calls or spending too much staff time on routine enquiries",
    outcome: "Keep inbound calls moving while your team handles the conversations that need people.",
    cta: "Add an AI receptionist",
  },
  "ai-front-desk-suite": {
    fit: "Growing teams handling customers across WhatsApp, calls and email",
    outcome: "Create one connected front desk instead of managing each channel separately.",
    cta: "Deploy the front desk suite",
  },
  "custom-ai-operations": {
    fit: "Organizations with multiple departments, branches or custom operating workflows",
    outcome: "Build automation around the organization instead of forcing the organization into a fixed package.",
    cta: "Plan a custom system",
  },
};

export default function PricingCarousel({ plans, compact = false }: PricingCarouselProps) {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const settledRef = useRef<number | null>(null);
  const programmaticRef = useRef<number | null>(null);

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
    const next = Math.min(plans.length - 1, Math.max(0, active + direction));
    goTo(next);
  };

  return (
    <div className={`${styles.carousel} ${compact ? styles.compact : ""}`} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    }} aria-roledescription="carousel" aria-label="Fluxknight pricing plans">
      <div className={styles.topControls}>
        <div className={styles.controlCopy}>
          <p aria-live="polite">Plan {active + 1} of {plans.length}</p>
          <span>Swipe or use the arrows to compare</span>
        </div>
        <div>
          <button type="button" onClick={() => move(-1)} disabled={active === 0} aria-label="Previous pricing plan"><ArrowLeft size={18} /></button>
          <button type="button" onClick={() => move(1)} disabled={active === plans.length - 1} aria-label="Next pricing plan"><ArrowRight size={18} /></button>
        </div>
      </div>

      <div className={styles.track} ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="Scrollable pricing plans">
        {plans.map((plan, index) => {
          const Icon = plan.icon;
          const firstPrice = plan.firstMonth ?? plan.first ?? "Custom";
          const isCustom = plan.custom || plan.slug === "custom-ai-operations";
          const href = isCustom ? "/evaluation" : `/checkout?plan=${encodeURIComponent(plan.slug)}`;
          const decision = planDecisionCopy[plan.slug];
          const ctaLabel = decision?.cta ?? plan.cta ?? "Get started";
          return (
            <article className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`} key={plan.name} aria-label={`${plan.name}${plan.featured ? ", most complete starter" : ""}`}>
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardHeader}>
                <span className={styles.icon}><Icon size={22} /></span>
                {plan.featured ? <span className={styles.badge}>Most complete starter</span> : null}
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
                <div><span>Then</span><strong>{plan.ongoing}</strong></div>
              </div>
              <h4>What&apos;s included</h4>
              <div className={styles.features}>{plan.features.map((feature) => <span key={feature}><CheckCircle2 size={16} />{feature}</span>)}</div>
              <Link className={styles.cta} href={href} aria-label={`${ctaLabel} with ${plan.name}`}>{ctaLabel} <ArrowRight size={16} /></Link>
            </article>
          );
        })}
      </div>

      <div className={styles.dots} role="tablist" aria-label="Choose a pricing plan">
        {plans.map((plan, index) => <button type="button" key={plan.name} role="tab" aria-selected={index === active} aria-label={`Show ${plan.name}`} className={index === active ? styles.dotActive : styles.dot} onClick={() => goTo(index)} />)}
      </div>
    </div>
  );
}
