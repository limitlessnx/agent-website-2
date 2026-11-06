"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Hotel, UtensilsCrossed, Dumbbell, Stethoscope, BriefcaseBusiness } from "lucide-react";
import { industries } from "@/lib/industryCatalog";
import styles from "./IndustryExplorer.module.css";

const featured = [
  { slug: "real-estate", Icon: Building2 },
  { slug: "hotels", Icon: Hotel },
  { slug: "restaurants", Icon: UtensilsCrossed },
  { slug: "gyms", Icon: Dumbbell },
  { slug: "clinics", Icon: Stethoscope },
  { slug: "service-businesses", Icon: BriefcaseBusiness },
] as const;

// Reuse the exact images already shown on the existing Industries directory.
const industryImages: Record<string, string> = {
  "real-estate": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82",
  "hotels": "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82",
  "restaurants": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82",
  "gyms": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=82",
  "clinics": "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=82",
  "service-businesses": "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=82"
};

export default function IndustryExplorer() {
  const [active, setActive] = useState<string>("real-estate");
  const industry = industries.find((item) => item.slug === active) ?? industries[0];
  const journey = industry.journey.slice(0, 6);
  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-explorer-title">
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Built around your business</span>
          <h2 id="industry-explorer-title">Different industries. One connected platform.</h2>
          <p>Explore how customer conversations, qualification, follow-ups and human handoff fit the way your team works.</p>
        </div>
        <div className={styles.tabs} role="group" aria-label="Choose an industry">
          {featured.map(({ slug, Icon }) => {
            const item = industries.find((entry) => entry.slug === slug);
            if (!item) return null;
            return <button type="button" key={slug} className={active === slug ? styles.selected : styles.tab} aria-pressed={active === slug} onClick={() => setActive(slug)}>
              <Icon size={17} aria-hidden="true" />{item.name}
            </button>;
          })}
        </div>
        <div className={styles.panel} aria-live="polite">
          <div className={styles.details}>
            <span className={styles.kicker}>Your industry, your workflow</span>
            <h3>{industry.name}</h3>
            <p className={styles.hero}>{industry.hero}</p>
            <p className={styles.description}>{industry.subhead}</p>
            <div className={styles.actions}>
              <Link href={`/industries/${industry.slug}`} className={styles.primary}>Explore {industry.name} <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link href="/evaluation" className={styles.secondary}>Evaluate My Business</Link>
            </div>
          </div>
          <div className={styles.visualColumn}>
            <div className={styles.industryImage}>
              <img key={industry.slug} src={industryImages[industry.slug]} alt={`${industry.name} industry`} loading="lazy" decoding="async" />
              <div className={styles.imageLabel}><span>INDUSTRY EXPERIENCE</span><strong>{industry.name}</strong></div>
            </div>
            <div className={styles.journey}>
            <div className={styles.journeyTop}><strong>Example customer journey</strong><span>ILLUSTRATIVE</span></div>
            <ol>
              {journey.map((step, index) => <li key={`${industry.slug}-${index}`}><span className={styles.number}>{String(index + 1).padStart(2, "0")}</span><span>{step}</span></li>)}
            </ol>
            <p>Workflows depend on your configuration and enabled plan.</p>
            </div>
          </div>
        </div>
        <Link className={styles.all} href="/industries">View all industries <ArrowRight size={17} aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
