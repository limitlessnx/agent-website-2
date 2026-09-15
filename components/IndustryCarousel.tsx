"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import styles from "./IndustryCarousel.module.css";

const industries = [
  { id: "hotels", title: "Hotels", icon: Hotel, image: "/industry-product-hospitality.svg", eyebrow: "Guest operations", text: "Answer guest questions, capture booking intent, coordinate reservations and hand over high-value conversations without front-desk bottlenecks." },
  { id: "restaurants", title: "Restaurants", icon: ShoppingCart, image: "/industry-product-restaurants.svg", eyebrow: "Reservations & service", text: "Handle reservations, menu questions, order enquiries and follow-up while your team stays focused on service." },
  { id: "clinics", title: "Clinics", icon: Stethoscope, image: "/industry-product-health.svg", eyebrow: "Patient administration", text: "Reduce repetitive front-desk work with appointment support, reminders, administrative answers and structured human handoff." },
  { id: "sales-companies", title: "Sales Companies", icon: Briefcase, image: "/industry-product-sales.svg", eyebrow: "Lead conversion", text: "Qualify demand, keep follow-up active and preserve conversation context until a serious prospect is ready for your sales team." },
  { id: "real-estate", title: "Real Estate", icon: Building2, image: "/industry-product-real-estate.svg", eyebrow: "Property enquiries", text: "Turn property interest into qualified conversations, inspection bookings and persistent follow-up across the buyer journey." },
  { id: "gyms", title: "Gyms", icon: Dumbbell, image: "/industry-product-gyms.svg", eyebrow: "Membership growth", text: "Capture trial interest, answer membership questions, reactivate prospects and support renewals without manual chasing." },
  { id: "service-businesses", title: "Service Businesses", icon: Briefcase, image: "/industry-product-services.svg", eyebrow: "Booking operations", text: "Move enquiries into booked jobs, collect the right details and keep customers updated while the team stays on delivery." },
  { id: "auto-shops", title: "Auto Shops", icon: Truck, image: "/industry-product-auto.svg", eyebrow: "Repair workflow", text: "Turn repair enquiries into booked jobs, collect vehicle context and keep customers updated without constant back-and-forth." },
  { id: "ecommerce", title: "E-commerce", icon: ShoppingCart, image: "/industry-product-commerce.svg", eyebrow: "Commerce support", text: "Help customers choose products, answer order questions and recover purchase intent with structured follow-up." },
  { id: "professional-services", title: "Professional Services", icon: Briefcase, image: "/industry-product-professional.svg", eyebrow: "Client acquisition", text: "Respond faster, qualify opportunities, book consultations and keep proposals moving through a connected client journey." },
];

const AUTOPLAY_MS = 5200;

export default function IndustryCarousel() {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pausedUntil = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 760px)").matches) return;

    const timer = window.setInterval(() => {
      if (document.hidden || Date.now() < pausedUntil.current) return;
      setActive((current) => (current + 1) % industries.length);
    }, AUTOPLAY_MS);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.children[active] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const choose = (index: number) => {
    pausedUntil.current = Date.now() + 9000;
    setActive((index + industries.length) % industries.length);
  };

  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-carousel-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>
            <span className={styles.eyebrow}>Organizations</span>
            <h2 id="industry-carousel-title">Built for organizations across industries.</h2>
            <p>See how Fluxknight adapts the same AI operating layer to ten different customer journeys, teams and day-to-day realities.</p>
          </div>

          <div className={styles.controls} aria-label="Industry carousel controls">
            <button type="button" onClick={() => choose(active - 1)} aria-label="Previous industry"><ArrowLeft size={18} /></button>
            <span>{String(active + 1).padStart(2, "0")} / {String(industries.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => choose(active + 1)} aria-label="Next industry"><ArrowRight size={18} /></button>
          </div>
        </div>

        <div
          className={styles.viewport}
          onMouseEnter={() => { pausedUntil.current = Date.now() + 9000; }}
        >
          <div className={styles.track} ref={trackRef}>
            {industries.map(({ id, title, icon: Icon, image, eyebrow, text }, index) => {
              const isActive = index === active;
              return (
                <article
                  key={id}
                  className={`${styles.card} ${isActive ? styles.active : ""}`}
                  tabIndex={0}
                  onMouseEnter={() => choose(index)}
                  onFocus={() => choose(index)}
                >
                  <img className={styles.cardImage} src={image} alt="" aria-hidden="true" />
                  <div className={styles.cardShade} aria-hidden="true" />

                  <div className={styles.cardTopline}>
                    <span className={styles.cardIcon}><Icon size={18} /></span>
                    <span className={styles.counter}>{String(index + 1).padStart(2, "0")}</span>
                  </div>

                  <div className={styles.cardLabel}>
                    <span>{eyebrow}</span>
                    <h3>{title}</h3>
                  </div>

                  <div className={styles.reveal}>
                    <div className={styles.revealPanel}>
                      <p>{text}</p>
                      <Link href={`/industries/${id}`} className={styles.link}>
                        Explore {title} <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className={styles.dots} role="tablist" aria-label="Industry slides">
          {industries.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === active ? styles.dotActive : styles.dot}
              onClick={() => choose(index)}
              aria-label={`Show ${item.title}`}
              aria-selected={index === active}
              role="tab"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
