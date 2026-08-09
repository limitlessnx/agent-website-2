"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "lucide-react";
import styles from "./IndustryCarousel.module.css";

const industries = [
  {
    id: "hotels",
    title: "Hotels",
    icon: Hotel,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=85",
    text: "Booking assistance, guest questions, reservations, upsells, and front-desk escalation without making guests wait.",
  },
  {
    id: "restaurants",
    title: "Restaurants",
    icon: ShoppingCart,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=85",
    text: "Reservations, catering enquiries, menu support, repeat-customer campaigns, and faster customer response.",
  },
  {
    id: "clinics",
    title: "Clinics",
    icon: Stethoscope,
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=85",
    text: "Patient intake, appointment booking, reminders, rescheduling, and staff escalation around the clock.",
  },
  {
    id: "sales-companies",
    title: "Sales Companies",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85",
    text: "Lead generation, qualification, disciplined follow-up, scoring, routing, and alerts when buyers are ready.",
  },
  {
    id: "real-estate",
    title: "Real Estate",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=85",
    text: "Property enquiries, buyer qualification, listing recommendations, inspections, follow-up, and payment journeys.",
  },
  {
    id: "gyms",
    title: "Gyms",
    icon: Dumbbell,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1400&q=85",
    text: "Membership enquiries, trial bookings, lead reactivation, renewals, class promotion, and member engagement.",
  },
  {
    id: "services",
    title: "Service Businesses",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=85",
    text: "Service-request intake, quote qualification, consultations, reminders, customer updates, and review requests.",
  },
  {
    id: "auto-shops",
    title: "Auto Shops",
    icon: Truck,
    image: "https://images.unsplash.com/photo-1486006920555-c77dcf18193c?auto=format&fit=crop&w=1400&q=85",
    text: "Repair bookings, vehicle intake, quote follow-up, maintenance reminders, and customer status updates.",
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    icon: ShoppingCart,
    image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=85",
    text: "Product assistance, abandoned-cart recovery, order support, recommendations, upsells, and win-back campaigns.",
  },
  {
    id: "professional-services",
    title: "Professional Services",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1400&q=85",
    text: "Prospect qualification, discovery calls, proposal follow-up, onboarding, reminders, and client experience automation.",
  },
];

function relativeIndex(index: number, active: number, length: number) {
  let diff = index - active;
  if (diff > length / 2) diff -= length;
  if (diff < -length / 2) diff += length;
  return diff;
}

export default function IndustryCarousel() {
  const [active, setActive] = useState(0);
  const touchStart = useRef<number | null>(null);
  const length = industries.length;
  const activeIndustry = industries[active];

  const visible = useMemo(
    () => industries.map((item, index) => ({ item, index, offset: relativeIndex(index, active, length) })),
    [active, length],
  );

  const go = (direction: number) => {
    setActive((current) => (current + direction + length) % length);
  };

  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-carousel-title">
      <div className={styles.glow} />
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Industries</span>
          <h2 id="industry-carousel-title">Automation shaped around how your market actually works.</h2>
          <p>Explore industry-specific AI systems built around the customer journey, sales process, operations, and follow-up rhythm of each business.</p>
        </div>

        <div
          className={styles.carousel}
          onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
          onTouchEnd={(event) => {
            if (touchStart.current === null) return;
            const end = event.changedTouches[0]?.clientX ?? touchStart.current;
            const delta = end - touchStart.current;
            touchStart.current = null;
            if (Math.abs(delta) > 45) go(delta < 0 ? 1 : -1);
          }}
        >
          <button className={`${styles.navButton} ${styles.prev}`} onClick={() => go(-1)} aria-label="Previous industry">
            <ArrowLeft size={20} />
          </button>

          <div className={styles.stage}>
            {visible.map(({ item, index, offset }) => {
              const Icon = item.icon;
              const hidden = Math.abs(offset) > 2;
              return (
                <article
                  key={item.id}
                  className={`${styles.card} ${offset === 0 ? styles.active : ""}`}
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(12,6,28,.12), rgba(8,3,20,.92)), url(${item.image})`,
                    transform: `translateX(${offset * 56}%) scale(${offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.88 : 0.76}) rotateY(${offset * -6}deg)`,
                    opacity: hidden ? 0 : offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.74 : 0.36,
                    zIndex: 20 - Math.abs(offset),
                    pointerEvents: hidden ? "none" : "auto",
                  }}
                  onClick={() => offset !== 0 && setActive(index)}
                  aria-hidden={hidden}
                >
                  <div className={styles.cardContent}>
                    <span className={styles.icon}><Icon size={22} /></span>
                    <span className={styles.counter}>{String(index + 1).padStart(2, "0")} / {String(length).padStart(2, "0")}</span>
                    <div className={styles.copy}>
                      <h3>{item.title}</h3>
                      <p>{item.text}</p>
                      {offset === 0 && (
                        <Link href={`/industries#${item.id}`} className={styles.link}>
                          Explore {item.title} <ArrowRight size={16} />
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <button className={`${styles.navButton} ${styles.next}`} onClick={() => go(1)} aria-label="Next industry">
            <ArrowRight size={20} />
          </button>
        </div>

        <div className={styles.footerControls}>
          <div className={styles.dots} role="tablist" aria-label="Industry slides">
            {industries.map((item, index) => (
              <button
                key={item.id}
                className={index === active ? styles.dotActive : styles.dot}
                onClick={() => setActive(index)}
                aria-label={`Show ${item.title}`}
                aria-selected={index === active}
                role="tab"
              />
            ))}
          </div>
          <Link href={`/industries#${activeIndustry.id}`} className={styles.mobileLink}>
            View {activeIndustry.title} <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </section>
  );
}
