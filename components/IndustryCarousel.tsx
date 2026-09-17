"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import { industries as industryCatalog } from "@/lib/industryCatalog";
import styles from "./IndustryCarousel.module.css";

const industryMeta = [
  { id: "real-estate", icon: Building2, image: "https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Real Estate", text: "Capture leads, qualify buyers, book inspections and keep follow-up moving automatically." },
  { id: "hotels", icon: Hotel, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Guest operations", text: "Answer guest questions, capture booking intent, coordinate reservations and hand over high-value conversations without front-desk bottlenecks." },
  { id: "restaurants", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Reservations & service", text: "Handle reservations, menu questions, order enquiries and follow-up while your team stays focused on service." },
  { id: "clinics", icon: Stethoscope, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Patient administration", text: "Reduce repetitive front-desk work with appointment support, reminders, administrative answers and structured human handoff." },
  { id: "sales-companies", icon: Briefcase, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Lead conversion", text: "Qualify demand, keep follow-up active and preserve conversation context until a serious prospect is ready for your sales team." },
  { id: "gyms", icon: Dumbbell, image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Membership growth", text: "Capture trial interest, answer membership questions, reactivate prospects and support renewals without manual chasing." },
  { id: "service-businesses", icon: Briefcase, image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Booking operations", text: "Move enquiries into booked jobs, collect the right details and keep customers updated while the team stays on delivery." },
  { id: "auto-shops", icon: Truck, image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Repair workflow", text: "Turn repair enquiries into booked jobs, collect vehicle context and keep customers updated without constant back-and-forth." },
  { id: "ecommerce", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Commerce support", text: "Help customers choose products, answer order questions and recover purchase intent with structured follow-up." },
  { id: "professional-services", icon: Briefcase, image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&fm=jpg&q=82&w=1400", eyebrow: "Client acquisition", text: "Respond faster, qualify opportunities, book consultations and keep proposals moving through a connected client journey." },
] as const;

const AUTOPLAY_MS = 3000;
const INTERACTION_PAUSE_MS = 3600;
const CLONES = 2;

export default function IndustryCarousel() {
  const industries = useMemo(() => {
    const names = new Map(industryCatalog.map((industry) => [industry.slug, industry.name]));
    return industryMeta.map((industry) => ({ ...industry, title: names.get(industry.id) ?? industry.id }));
  }, []);
  const loopItems = useMemo(() => [...industries.slice(-CLONES), ...industries, ...industries.slice(0, CLONES)], [industries]);

  const [active, setActive] = useState(0);
  const sectionRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedUntil = useRef(0);
  const visibleRef = useRef(false);
  const scrollTimerRef = useRef<number | null>(null);
  const initializedRef = useRef(false);

  const centerRendered = (renderedIndex: number, behavior: ScrollBehavior = "smooth") => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[renderedIndex] as HTMLElement | undefined;
    if (!card) return;
    track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.offsetWidth) / 2, behavior });
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting && entry.intersectionRatio >= 0.3; }, { threshold: [0, 0.3, 0.6] });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    requestAnimationFrame(() => centerRendered(CLONES, "auto"));
  }, []);

  const goTo = (logicalIndex: number) => {
    pausedUntil.current = Date.now() + INTERACTION_PAUSE_MS;
    const normalized = (logicalIndex + industries.length) % industries.length;
    setActive(normalized);
    const currentRendered = CLONES + active;
    let targetRendered = CLONES + normalized;
    if (active === industries.length - 1 && normalized === 0) targetRendered = currentRendered + 1;
    if (active === 0 && normalized === industries.length - 1) targetRendered = currentRendered - 1;
    centerRendered(targetRendered);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => {
      if (!visibleRef.current || document.hidden || Date.now() < pausedUntil.current) return;
      goTo(active + 1);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [active, industries.length]);

  useEffect(() => () => { if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current); }, []);

  const syncActiveFromScroll = () => {
    pausedUntil.current = Date.now() + INTERACTION_PAUSE_MS;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const center = track.scrollLeft + track.clientWidth / 2;
      let closest = CLONES;
      let distance = Number.POSITIVE_INFINITY;
      Array.from(track.children).forEach((child, index) => {
        const card = child as HTMLElement;
        const nextDistance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (nextDistance < distance) { distance = nextDistance; closest = index; }
      });
      const logical = (closest - CLONES + industries.length) % industries.length;
      setActive(logical);
      if (closest < CLONES) requestAnimationFrame(() => centerRendered(closest + industries.length, "auto"));
      else if (closest >= CLONES + industries.length) requestAnimationFrame(() => centerRendered(closest - industries.length, "auto"));
    }, 70);
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
            <button className="flux-carousel-arrow" type="button" onClick={() => goTo(active - 1)} aria-label="Previous industry"><ArrowLeft size={18} /></button>
            <span>{String(active + 1).padStart(2, "0")} / {String(industries.length).padStart(2, "0")}</span>
            <button className="flux-carousel-arrow" type="button" onClick={() => goTo(active + 1)} aria-label="Next industry"><ArrowRight size={18} /></button>
          </div>
        </div>

        <div className={styles.viewport}>
          <div className={styles.track} ref={trackRef} onScroll={syncActiveFromScroll} onPointerDown={() => { pausedUntil.current = Date.now() + INTERACTION_PAUSE_MS; }} onTouchStart={() => { pausedUntil.current = Date.now() + INTERACTION_PAUSE_MS; }}>
            {loopItems.map(({ id, title, icon: Icon, image, eyebrow, text }, renderedIndex) => {
              const logicalIndex = (renderedIndex - CLONES + industries.length) % industries.length;
              const isActive = logicalIndex === active;
              return (
                <article key={`${id}-${renderedIndex}`} className={`${styles.card} ${isActive ? styles.active : ""}`} tabIndex={renderedIndex >= CLONES && renderedIndex < CLONES + industries.length ? 0 : -1} aria-current={isActive ? "true" : undefined}>
                  <img className={styles.cardImage} src={image} alt="" aria-hidden="true" loading={Math.abs(renderedIndex - CLONES) < 3 ? "eager" : "lazy"} decoding="async" />
                  <div className={styles.cardShade} aria-hidden="true" />
                  <div className={styles.cardTopline}><span className={styles.cardIcon}><Icon size={20} /></span><span className={styles.counter}>{String(logicalIndex + 1).padStart(2, "0")}</span></div>
                  <div className={styles.cardContent}>
                    <span className={styles.cardEyebrow}>{eyebrow}</span><h3>{title}</h3><p>{text}</p>
                    <Link href={`/industries/${id}`} className={styles.link}>Explore {title} <ArrowRight size={15} /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className={styles.mobileNav} aria-label="Industry carousel navigation">
          <button className="flux-carousel-arrow" type="button" onClick={() => goTo(active - 1)} aria-label="Previous industry"><ArrowLeft size={19} /></button>
          <div className={`${styles.dots} flux-carousel-segments`}>
            {industries.map((item, index) => <button key={item.id} type="button" className={`${index === active ? styles.dotActive : styles.dot} flux-carousel-segment ${index === active ? "is-active" : ""}`} onClick={() => goTo(index)} aria-label={`Show ${item.title}`} aria-pressed={index === active} />)}
          </div>
          <button className="flux-carousel-arrow" type="button" onClick={() => goTo(active + 1)} aria-label="Next industry"><ArrowRight size={19} /></button>
        </div>
        <Link href="/industries" className={`${styles.allIndustries} flux-metal-cta`}>See All Industries <ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}
