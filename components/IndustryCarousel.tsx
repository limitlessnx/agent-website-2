"use client";

import Image from "next/image";
import Link from "next/link";
import { Briefcase, Building2, Dumbbell, Globe2, Headphones, Hotel, Mail, MessageCircle, Network, Send, ShoppingCart, Stethoscope, Truck, UsersRound, Workflow } from "@/components/admin/ServerIcons";
import styles from "./IndustryCarousel.module.css";

const industries = [
  { id: "hotels", title: "Hotels", icon: Hotel },
  { id: "restaurants", title: "Restaurants", icon: ShoppingCart },
  { id: "clinics", title: "Clinics", icon: Stethoscope },
  { id: "sales-companies", title: "Sales Companies", icon: Briefcase },
  { id: "real-estate", title: "Real Estate", icon: Building2 },
  { id: "gyms", title: "Gyms", icon: Dumbbell },
  { id: "services", title: "Service Businesses", icon: Briefcase },
  { id: "auto-shops", title: "Auto Shops", icon: Truck },
  { id: "ecommerce", title: "E-commerce", icon: ShoppingCart },
  { id: "professional-services", title: "Professional Services", icon: Briefcase },
];

const metrics = [
  { icon: UsersRound, value: "2K+", label: "Community Members" },
  { icon: Workflow, value: "500+", label: "Automations Shared" },
  { icon: Headphones, value: "24/7", label: "Active Support" },
  { icon: Network, value: "100+", label: "Expert Contributors" },
];

const socials = [
  { icon: Globe2, label: "Website", href: "/" },
  { icon: MessageCircle, label: "Community", href: "/contact" },
  { icon: Mail, label: "Email", href: "/contact" },
  { icon: Send, label: "Updates", href: "/about" },
  { icon: Network, label: "Network", href: "/industries" },
];

export default function IndustryCarousel() {
  return (
    <section className={styles.section} id="industries" aria-labelledby="ecosystem-title">
      <div className={styles.shell}>
        <div className={styles.heading}>
          <span className={styles.eyebrow}>Community</span>
          <h2 id="ecosystem-title">Join the Fluxknight Community</h2>
          <p>Connect, learn, and grow with businesses building smarter operations with AI agents and automation.</p>
          <Link href="/contact">Join Our Community</Link>
        </div>

        <div className={styles.orbitScene}>
          <Image src="/fluxknight-orbital-network.png" alt="Fluxknight automation ecosystem" fill sizes="(max-width: 760px) 100vw, 900px" />
          <div className={styles.core}><Network size={34}/><span>Fluxknight</span></div>
          {metrics.map(({icon:Icon,value,label},index)=><article className={styles.metric} data-position={index} key={label}><span><Icon size={17}/></span><div><strong>{value}</strong><small>{label}</small></div></article>)}
        </div>

        <div className={styles.industryLinks} aria-label="Industries served">
          {industries.map(({id,title,icon:Icon})=><Link key={id} href={`/industries#${id}`}><Icon size={15}/>{title}</Link>)}
        </div>

        <div className={styles.socialHeading}>Stay connected with us</div>
        <div className={styles.socials}>{socials.map(({icon:Icon,label,href})=><Link key={label} href={href}><span><Icon size={18}/></span><small>{label}</small></Link>)}</div>
      </div>
    </section>
  );
}
