"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import styles from "./IndustryCarousel.module.css";

const industries = [
  {
    id: "hotels",
    title: "Hotels",
    icon: Hotel,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?fit=crop&w=1400&q=86&fm=jpg",
    text: "Turn more guest enquiries into bookings and reduce pressure on your front desk.",
  },
  {
    id: "restaurants",
    title: "Restaurants",
    icon: ShoppingCart,
    image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?fit=crop&w=1400&q=86&fm=jpg",
    text: "Handle reservations and customer questions faster so your team can stay focused on service.",
  },
  {
    id: "clinics",
    title: "Clinics",
    icon: Stethoscope,
    image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?fit=crop&w=1400&q=86&fm=jpg",
    text: "Improve patient experience with faster answers, smoother appointments, and less admin work.",
  },
  {
    id: "sales-companies",
    title: "Sales Companies",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=86&v=2",
    text: "Qualify leads earlier and keep follow-up active until serious prospects are ready to buy.",
  },
  {
    id: "real-estate",
    title: "Real Estate",
    icon: Building2,
    image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?fit=crop&w=1400&q=86&fm=jpg",
    text: "Turn more property enquiries into inspections and serious buyer conversations.",
  },
  {
    id: "gyms",
    title: "Gyms",
    icon: Dumbbell,
    image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?fit=crop&w=1400&q=86&fm=jpg",
    text: "Convert more prospects, reactivate interest, and keep members from quietly dropping off.",
  },
  {
    id: "services",
    title: "Service Businesses",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1400&q=86&v=2",
    text: "Book jobs faster, keep customers updated, and reduce the back-and-forth that slows teams down.",
  },
  {
    id: "auto-shops",
    title: "Auto Shops",
    icon: Truck,
    image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1400&q=86&v=2",
    text: "Move repair enquiries into booked jobs and keep customers informed without constant manual chasing.",
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    icon: ShoppingCart,
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1400&q=86&v=2",
    text: "Recover more purchase intent through better product help, order support, and follow-up.",
  },
  {
    id: "professional-services",
    title: "Professional Services",
    icon: Briefcase,
    image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1400&q=86&v=2",
    text: "Respond faster, book consultations, and keep proposals moving without fragmented follow-up.",
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

  useEffect(() => {
    industries.forEach((industry) => {
      const image = new Image();
      image.decoding = "async";
      image.src = industry.image;
    });
  }, []);

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
          <h2 id="industry-carousel-title">Built for organizations across industries.</h2>
          <p>Different industries. Same outcome: stronger customer experiences, less friction, and better business results.</p>
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
                    backgroundImage: hidden ? undefined : `linear-gradient(180deg, rgba(12,6,28,.12), rgba(8,3,20,.92)), url(${item.image})`,
                    backgroundColor: "#0b0614",
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
