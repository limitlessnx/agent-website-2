import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import { industries as industryCatalog } from "@/lib/industryCatalog";
import styles from "./IndustryCarousel.module.css";

const industryMeta = [
  { id: "real-estate", icon: Building2, image: "https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Real Estate", text: "Reply to property enquiries, find out what buyers need, follow up and book inspections.", examples: ["Enquiries", "Follow-up", "Inspection bookings"] },
  { id: "hotels", icon: Hotel, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Hotels", text: "Answer guest questions, help with bookings, send reminders and pass important requests to staff.", examples: ["Guest questions", "Bookings", "Reminders"] },
  { id: "restaurants", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Restaurants", text: "Answer menu questions, take booking or order enquiries, follow up and keep customers updated.", examples: ["Reservations", "Orders", "Customer support"] },
  { id: "clinics", icon: Stethoscope, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Clinics", text: "Answer common questions, help with appointments, send reminders and pass important cases to staff.", examples: ["Appointments", "Reminders", "Patient enquiries"] },
  { id: "sales-companies", icon: Briefcase, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Sales Companies", text: "Reply to leads, collect the right details, follow up and pass serious buyers to your sales team.", examples: ["Lead qualification", "Follow-up", "Sales handoff"] },
  { id: "gyms", icon: Dumbbell, image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Gyms", text: "Answer membership questions, follow up with new leads, book trials and remind members about renewals.", examples: ["Trial enquiries", "Memberships", "Renewals"] },
  { id: "service-businesses", icon: Briefcase, image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Service Businesses", text: "Reply to enquiries, collect job details, book work and keep customers updated.", examples: ["Job enquiries", "Bookings", "Customer updates"] },
  { id: "auto-shops", icon: Truck, image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Auto Shops", text: "Reply to repair enquiries, collect vehicle details, book jobs and send customers updates.", examples: ["Repair enquiries", "Bookings", "Status updates"] },
  { id: "ecommerce", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "E-commerce", text: "Answer product questions, help with orders, follow up with interested buyers and handle support.", examples: ["Product questions", "Orders", "Follow-up"] },
  { id: "professional-services", icon: Briefcase, image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Professional Services", text: "Reply to enquiries, collect client details, book consultations and follow up on proposals.", examples: ["Client enquiries", "Consultations", "Proposal follow-up"] },
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
          <p>Every business works differently. These are just a few examples of what we can automate. We can also build around the way your business already works.</p>
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
          See more business examples <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
