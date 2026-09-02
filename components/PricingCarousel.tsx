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
        <p aria-live="polite">Plan {active + 1} of {plans.length}</p>
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
          return (
            <article className={`${styles.card} ${plan.featured ? styles.featured : ""} ${index === active ? styles.active : ""}`} key={plan.name} aria-label={`${plan.name}${plan.featured ? ", most complete starter" : ""}`}>
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.cardHeader}>
                <span className={styles.icon}><Icon size={22} /></span>
                {plan.featured ? <span className={styles.badge}>Most complete starter</span> : null}
              </div>
              <h3>{plan.name}</h3>
              <p className={styles.description}>{plan.description ?? plan.tag}</p>
              <div className={styles.priceBlock}>
                <div><span>First month · installation + deployment</span><strong>{firstPrice}</strong></div>
                <div><span>Consecutively</span><strong>{plan.ongoing}</strong></div>
              </div>
              <h4>What&apos;s included</h4>
              <div className={styles.features}>{plan.features.map((feature) => <span key={feature}><CheckCircle2 size={16} />{feature}</span>)}</div>
              <Link className={styles.cta} href={href} aria-label={`${plan.cta ?? "Get started"} with ${plan.name}`}>{plan.cta ?? "Get started"} <ArrowRight size={16} /></Link>
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
