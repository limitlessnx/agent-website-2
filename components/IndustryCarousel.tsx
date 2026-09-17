"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import { industries as industryCatalog } from "@/lib/industryCatalog";
import styles from "./IndustryCarousel.module.css";

const industryMeta = [
  { id: "real-estate", icon: Building2, image: "https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Real Estate", text: "Capture leads, qualify buyers, book inspections and keep follow-up moving automatically." },
  { id: "hotels", icon: Hotel, image: "/industry-product-hospitality.svg", eyebrow: "Guest operations", text: "Answer guest questions, capture booking intent, coordinate reservations and hand over high-value conversations without front-desk bottlenecks." },
  { id: "restaurants", icon: ShoppingCart, image: "/industry-product-restaurants.svg", eyebrow: "Reservations & service", text: "Handle reservations, menu questions, order enquiries and follow-up while your team stays focused on service." },
  { id: "clinics", icon: Stethoscope, image: "/industry-product-health.svg", eyebrow: "Patient administration", text: "Reduce repetitive front-desk work with appointment support, reminders, administrative answers and structured human handoff." },
  { id: "sales-companies", icon: Briefcase, image: "/industry-product-sales.svg", eyebrow: "Lead conversion", text: "Qualify demand, keep follow-up active and preserve conversation context until a serious prospect is ready for your sales team." },
  { id: "gyms", icon: Dumbbell, image: "/industry-product-gyms.svg", eyebrow: "Membership growth", text: "Capture trial interest, answer membership questions, reactivate prospects and support renewals without manual chasing." },
  { id: "service-businesses", icon: Briefcase, image: "/industry-product-services.svg", eyebrow: "Booking operations", text: "Move enquiries into booked jobs, collect the right details and keep customers updated while the team stays on delivery." },
  { id: "auto-shops", icon: Truck, image: "/industry-product-auto.svg", eyebrow: "Repair workflow", text: "Turn repair enquiries into booked jobs, collect vehicle context and keep customers updated without constant back-and-forth." },
  { id: "ecommerce", icon: ShoppingCart, image: "/industry-product-commerce.svg", eyebrow: "Commerce support", text: "Help customers choose products, answer order questions and recover purchase intent with structured follow-up." },
  { id: "professional-services", icon: Briefcase, image: "/industry-product-professional.svg", eyebrow: "Client acquisition", text: "Respond faster, qualify opportunities, book consultations and keep proposals moving through a connected client journey." },
] as const;

const AUTOPLAY_MS = 5200;
const INTERACTION_PAUSE_MS = 9000;

export default function IndustryCarousel() {
  const industries = useMemo(() => {
    const names = new Map(industryCatalog.map((industry) => [industry.slug, industry.name]));
    return industryMeta.map((industry) => ({ ...industry, title: names.get(industry.id) ?? industry.id }));
  }, []);

  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedUntil = useRef(0);
  const visibleRef = useRef(false);
  const shouldScrollRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.3; }, { threshold: [0, 0.3, 0.6] });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchLike = window.matchMedia("(max-width: 760px), (pointer: coarse)");
    if (reduceMotion.matches || touchLike.matches) return;
    const timer = window.setInterval(() => {
      if (!visibleRef.current || document.hidden || Date.now() < pausedUntil.current) return;
      shouldScrollRef.current = true;
      setActive((current) => (current + 1) % industries.length);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [industries.length]);

  useEffect(() => {
    if (!shouldScrollRef.current) return;
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[active] as HTMLElement | undefined;
    if (!card) return;
    const targetLeft = card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, targetLeft), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    shouldScrollRef.current = false;
  }, [active]);

  useEffect(() => () => { if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current); }, []);

  const pauseInteraction = () => { pausedUntil.current = Date.now() + INTERACTION_PAUSE_MS; };
  const choose = (index: number) => {
    pauseInteraction();
    shouldScrollRef.current = true;
    setActive((index + industries.length) % industries.length);
  };

  const syncActiveFromScroll = () => {
    pauseInteraction();
    shouldScrollRef.current = false;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const trackCenter = track.scrollLeft + track.clientWidth / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((child, index) => {
        const card = child as HTMLElement;
        const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - trackCenter);
        if (distance < closestDistance) { closestDistance = distance; closestIndex = index; }
      });
      setActive(closestIndex);
    }, 90);
  };

  return (
    <section ref={sectionRef} className={styles.section} id="industries" aria-labelledby="industry-carousel-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Industries</span>
            <h2 id="industry-carousel-title">Built for real businesses.</h2>
            <p>Tailored AI automation for the industries that move the world.</p>
          </div>
          <div className={styles.controls} aria-label="Industry carousel controls">
            <button type="button" onClick={() => choose(active - 1)} aria-label="Previous industry"><ArrowLeft size={18} /></button>
            <span>{String(active + 1).padStart(2, "0")} / {String(industries.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => choose(active + 1)} aria-label="Next industry"><ArrowRight size={18} /></button>
          </div>
        </div>

        <div className={styles.viewport} onMouseEnter={pauseInteraction}>
          <div className={styles.track} ref={trackRef} onScroll={syncActiveFromScroll} onPointerDown={pauseInteraction} onTouchStart={pauseInteraction} onWheel={pauseInteraction}>
            {industries.map(({ id, title, icon: Icon, image, eyebrow, text }, index) => {
              const isActive = index === active;
              return (
                <article key={id} className={`${styles.card} ${isActive ? styles.active : ""}`} tabIndex={0} onFocus={() => choose(index)} aria-current={isActive ? "true" : undefined}>
                  <img className={styles.cardImage} src={image} alt="" aria-hidden="true" loading={index < 3 ? "eager" : "lazy"} decoding="async" />
                  <div className={styles.cardShade} aria-hidden="true" />
                  <div className={styles.cardTopline}>
                    <span className={styles.cardIcon}><Icon size={20} /></span>
                    <span className={styles.counter}>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className={styles.cardContent}>
                    <span className={styles.cardEyebrow}>{eyebrow}</span>
                    <h3>{title}</h3>
                    <p>{text}</p>
                    <Link href={`/industries/${id}`} className={styles.link} onFocus={pauseInteraction}>
                      Explore {title} <ArrowRight size={15} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className={styles.mobileNav} aria-label="Industry carousel navigation">
          <button type="button" onClick={() => choose(active - 1)} aria-label="Previous industry"><ArrowLeft size={19} /></button>
          <div className={styles.dots} aria-label="Industry slides">
            {industries.map((item, index) => <button key={item.id} type="button" className={index === active ? styles.dotActive : styles.dot} onClick={() => choose(index)} aria-label={`Show ${item.title}`} aria-pressed={index === active} />)}
          </div>
          <button type="button" onClick={() => choose(active + 1)} aria-label="Next industry"><ArrowRight size={19} /></button>
        </div>

        <Link href="/industries" className={styles.allIndustries}>See All Industries <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}
