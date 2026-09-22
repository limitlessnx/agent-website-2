import Link from "next/link";
import { ArrowRight, Briefcase, Building2, Dumbbell, Hotel, ShoppingCart, Stethoscope, Truck } from "@/components/admin/ServerIcons";
import { industries as industryCatalog } from "@/lib/industryCatalog";
import styles from "./IndustryCarousel.module.css";

const industryMeta = [
  { id: "real-estate", icon: Building2, image: "https://images.unsplash.com/photo-1767950470198-c9cd97f8ed87?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Real Estate", text: "Capture leads, qualify buyers, book inspections and keep follow-up moving automatically.", examples: ["Enquiries", "Follow-up", "Inspection bookings"] },
  { id: "hotels", icon: Hotel, image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Hotels", text: "Answer guest questions, capture booking intent, coordinate reservations and hand over important conversations to staff.", examples: ["Guest questions", "Bookings", "Reminders"] },
  { id: "restaurants", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Restaurants", text: "Handle reservations, menu questions, order enquiries and follow-up while your team stays focused on service.", examples: ["Reservations", "Orders", "Customer support"] },
  { id: "clinics", icon: Stethoscope, image: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Clinics", text: "Reduce repetitive front-desk work with appointment support, reminders, common questions and clear staff handoff.", examples: ["Appointments", "Reminders", "Patient enquiries"] },
  { id: "sales-companies", icon: Briefcase, image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Sales Companies", text: "Qualify demand, keep follow-up active and preserve conversation context until a serious prospect is ready for your sales team.", examples: ["Lead qualification", "Follow-up", "Sales handoff"] },
  { id: "gyms", icon: Dumbbell, image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Gyms", text: "Capture trial interest, answer membership questions, reactivate prospects and support renewals without manual chasing.", examples: ["Trial enquiries", "Memberships", "Renewals"] },
  { id: "service-businesses", icon: Briefcase, image: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Service Businesses", text: "Move enquiries into booked jobs, collect the right details and keep customers updated while the team stays on delivery.", examples: ["Job enquiries", "Bookings", "Customer updates"] },
  { id: "auto-shops", icon: Truck, image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Auto Shops", text: "Turn repair enquiries into booked jobs, collect vehicle details and keep customers updated without constant back-and-forth.", examples: ["Repair enquiries", "Bookings", "Status updates"] },
  { id: "ecommerce", icon: ShoppingCart, image: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "E-commerce", text: "Help customers choose products, answer order questions and recover purchase interest with structured follow-up.", examples: ["Product questions", "Orders", "Follow-up"] },
  { id: "professional-services", icon: Briefcase, image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&fm=webp&q=72&w=960", eyebrow: "Professional Services", text: "Respond faster, qualify opportunities, book consultations and keep proposals moving through a connected client journey.", examples: ["Client enquiries", "Consultations", "Proposal follow-up"] },
] as const;

const industryNames = new Map(industryCatalog.map((industry) => [industry.slug, industry.name]));

export default function IndustryCarousel() {
  return (
    <section className={styles.section} id="industries" aria-labelledby="industry-list-title">
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Examples by industry</span>
          <h2 id="industry-list-title">See what businesses can automate with Fluxknight.</h2>
          <p>Different businesses have different repetitive work. Here are a few examples of what Fluxknight can handle.</p>
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
          View all industry examples <ArrowRight size={17} />
        </Link>
      </div>
    </section>
  );
}
