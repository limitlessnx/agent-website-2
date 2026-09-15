"use client";

import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import styles from "./IndustryCarousel.module.css";

const organizationGroups = [
  {
    id: "hospitality-service",
    eyebrow: "Hospitality & service",
    title: "Never leave an enquiry waiting",
    description: "Give guests and customers fast answers, capture intent, coordinate bookings and hand the right conversations to your team.",
    detail: "Hotels · Restaurants · Service businesses",
    href: "/industries/hotels",
    image: "/industry-product-hospitality.svg",
    icon: Hotel,
  },
  {
    id: "sales-property",
    eyebrow: "Sales & property",
    title: "Keep every serious lead moving",
    description: "Qualify demand, preserve conversation context and automate follow-up until a prospect is ready for the next human step.",
    detail: "Real estate · Sales companies · Professional services",
    href: "/industries/real-estate",
    image: "/industry-product-sales.svg",
    icon: Building2,
  },
  {
    id: "health-fitness",
    eyebrow: "Health & fitness",
    title: "Make customer journeys easier to manage",
    description: "Reduce repetitive front-desk work with faster administrative answers, appointment support, reminders and structured handoff.",
    detail: "Clinics · Gyms",
    href: "/industries/clinics",
    image: "/industry-product-health.svg",
    icon: Stethoscope,
  },
  {
    id: "commerce-operations",
    eyebrow: "Commerce & operations",
    title: "Turn support into an operating system",
    description: "Connect product questions, order or job updates, customer follow-up and team visibility in one coordinated workflow.",
    detail: "E-commerce · Auto shops",
    href: "/industries/ecommerce",
    image: "/industry-product-commerce.svg",
    icon: ShoppingCart,
  },
];

const allIndustries = [
  { id: "hotels", title: "Hotels", icon: Hotel },
  { id: "restaurants", title: "Restaurants", icon: ShoppingCart },
  { id: "clinics", title: "Clinics", icon: Stethoscope },
  { id: "sales-companies", title: "Sales Companies", icon: Briefcase },
  { id: "real-estate", title: "Real Estate", icon: Building2 },
  { id: "gyms", title: "Gyms", icon: Dumbbell },
  { id: "service-businesses", title: "Service Businesses", icon: Briefcase },
  { id: "auto-shops", title: "Auto Shops", icon: Truck },
  { id: "ecommerce", title: "E-commerce", icon: ShoppingCart },
  { id: "professional-services", title: "Professional Services", icon: Briefcase },
];

export default function IndustryCarousel() {
  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-carousel-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Organizations</span>
          <h2 id="industry-carousel-title">One AI operating layer, shaped around how your organization works.</h2>
          <p>Fluxknight adapts the same core intelligence to different customer journeys, teams and operating realities without forcing every business into one rigid workflow.</p>
        </div>

        <div className={styles.expandingCards}>
          {organizationGroups.map(({ id, eyebrow, title, description, detail, href, image, icon: Icon }, index) => (
            <article className={styles.card} key={id} tabIndex={0}>
              <img className={styles.cardImage} src={image} alt="" aria-hidden="true" />
              <div className={styles.cardShade} aria-hidden="true" />

              <div className={styles.cardTopline}>
                <span className={styles.cardIcon}><Icon size={18} /></span>
                <span className={styles.counter}>0{index + 1}</span>
              </div>

              <div className={styles.cardTitle}>
                <span>{eyebrow}</span>
              </div>

              <div className={styles.reveal}>
                <div className={styles.revealPanel}>
                  <p className={styles.kicker}>Fluxknight for {eyebrow.toLowerCase()}</p>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <small>{detail}</small>
                  <Link href={href} className={styles.link}>
                    Explore this workflow <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.directory} aria-label="Explore all industries">
          <div className={styles.directoryHeading}>
            <span>Explore every industry</span>
            <p>See how the workflows adapt to your business.</p>
          </div>
          <div className={styles.industryLinks}>
            {allIndustries.map(({ id, title, icon: Icon }) => (
              <Link key={id} href={`/industries/${id}`} className={styles.industryLink}>
                <Icon size={14} />
                <span>{title}</span>
                <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
