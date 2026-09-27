import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Hotel, ShoppingCart, Stethoscope } from "@/components/admin/ServerIcons";
import { industries as industryCatalog } from "@/lib/industryCatalog";
import styles from "./IndustryCarousel.module.css";

const industryMeta = [
  { id: "real-estate", icon: Building2, image: "https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Real Estate", text: "Reply to property enquiries, qualify buyers, follow up and book inspections.", examples: ["Enquiries", "Follow-up", "Inspections"] },
  { id: "hotels", icon: Hotel, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Hotels", text: "Answer guest questions, support bookings, send reminders and route important requests.", examples: ["Guest questions", "Bookings", "Reminders"] },
  { id: "restaurants", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Restaurants", text: "Handle menu questions, reservations, order enquiries and customer updates.", examples: ["Reservations", "Orders", "Support"] },
  { id: "clinics", icon: Stethoscope, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Clinics", text: "Answer routine questions, help with appointments and send reminders.", examples: ["Appointments", "Reminders", "Enquiries"] },
  { id: "sales-companies", icon: Briefcase, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Sales Companies", text: "Reply to leads, collect the right details, follow up and hand serious buyers to sales.", examples: ["Qualification", "Follow-up", "Handoff"] },
  { id: "professional-services", icon: Briefcase, image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Professional Services", text: "Reply to enquiries, collect client details, book consultations and follow up on proposals.", examples: ["Enquiries", "Consultations", "Proposals"] },
] as const;

const industryNames = new Map(industryCatalog.map((industry) => [industry.slug, industry.name]));

export default function IndustryCarousel() {
  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-list-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>A few examples</span>
          <h2 id="industry-list-title">See what Fluxknight can automate in different businesses.</h2>
          <p>Start with the customer work your team repeats most. Fluxknight adapts to the way your business already operates.</p>
        </div>

        <div className={styles.list}>
          {industryMeta.map(({ id, icon: Icon, image, eyebrow, text, examples }, index) => {
            const title = industryNames.get(id) ?? eyebrow;
            const reverse = index % 2 === 1;

            return (
              <article className={`${styles.card} ${reverse ? styles.reverse : ""}`} key={id}>
                <div className={styles.imageWrap}>
                  <img className={styles.cardImage} src={image} alt={`${title} business environment`} loading={index < 2 ? "eager" : "lazy"} decoding="async" />
                  <div className={styles.imageShade} aria-hidden="true" />
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className={styles.content}>
                  <div className={styles.titleRow}>
                    <span className={styles.icon}><Icon size={20} /></span>
                    <span className={styles.cardEyebrow}>{eyebrow}</span>
                  </div>

                  <h3>{title}</h3>
                  <p>{text}</p>

                  <div className={styles.examples} aria-label={`Examples of what Fluxknight can automate for ${title}`}>
                    {examples.map((example) => <span key={example}>{example}</span>)}
                  </div>

                  <Link href={`/industries/${id}`} className={styles.link}>
                    Explore {title} <ArrowRight size={16} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <Link href="/industries" className={styles.allIndustries}>
          Explore all industries <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
