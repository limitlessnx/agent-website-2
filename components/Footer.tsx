import Link from "next/link";
import { ExternalLink, Globe2, Mail } from "@/components/admin/ServerIcons";
import FluxLogo from "@/components/FluxLogo";
import styles from "@/components/Footer.module.css";

const groups = [
  { title: "Services", links: [["AI Sales Agent", "/services#ai-sales-agent"], ["WhatsApp AI", "/services#whatsapp"], ["AI Voice Agent", "/services#voice"], ["Lead Generation", "/services#lead-generation"], ["CRM Automation", "/services#crm"]] },
  { title: "Company", links: [["About", "/about"], ["Case Studies", "/case-studies"], ["Pricing", "/pricing"], ["Book a Demo", "/evaluation"], ["Login", "/account/login"]] },
  { title: "Industries", links: [["Real Estate", "/industries#real-estate"], ["Hospitality", "/industries#hotels"], ["Clinics", "/industries#clinics"], ["E-commerce", "/industries#ecommerce"], ["Professional Services", "/industries#professional-services"]] },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.desktopGrid}>
          <div className={styles.brand}>
            <Link href="/" aria-label="Fluxknight home"><FluxLogo /></Link>
            <p><strong>Serve Better. Operate Smarter.</strong><br />AI automation for customer operations, follow-up and business workflows.</p>
            <div className={styles.socials}>
              <a href="/" aria-label="Website"><Globe2 size={17} /></a>
              <a href="/contact" aria-label="Email"><Mail size={17} /></a>
              <a href="/about" aria-label="Company profile"><ExternalLink size={17} /></a>
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title} className={styles.group}>
              <h4>{group.title}</h4>
              {group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
            </div>
          ))}
        </div>

        <nav className={styles.mobileNav} aria-label="Footer navigation">
          {groups.map((group) => (
            <section key={group.title} className={styles.mobileGroup}>
              <h4>{group.title}</h4>
              <div className={styles.mobileLinks}>
                {group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}
              </div>
            </section>
          ))}
        </nav>

        <div className={styles.bottom}>
          <span>© {new Date().getFullYear()} Fluxknight. All rights reserved.</span>
          <span>Serve Better. Operate Smarter.</span>
        </div>
      </div>
    </footer>
  );
}
