import Link from "next/link";
import { Globe2, Linkedin, Mail } from "lucide-react";
import FluxLogo from "@/components/FluxLogo";

const groups = [
  { title: "Services", links: [["AI Sales Agent", "/services#ai-sales-agent"], ["WhatsApp AI", "/services#whatsapp"], ["AI Voice Agent", "/services#voice"], ["Lead Generation", "/services#lead-generation"], ["CRM Automation", "/services#crm"]] },
  { title: "Company", links: [["About", "/about"], ["Case Studies", "/case-studies"], ["Pricing", "/pricing"], ["Book a Demo", "/evaluation"], ["Login", "/account/login"]] },
  { title: "Industries", links: [["Real Estate", "/industries#real-estate"], ["Hospitality", "/industries#hotels"], ["Clinics", "/industries#clinics"], ["E-commerce", "/industries#ecommerce"], ["Professional Services", "/industries#professional-services"]] },
];

export default function Footer() {
  return (
    <footer className="flux-footer">
      <div className="flux-footer-grid">
        <div className="flux-footer-brand">
          <Link href="/" aria-label="Fluxknight home"><FluxLogo /></Link>
          <p>We build connected AI employees, lead-generation engines, and automation systems for businesses that want to sell, support, and scale without operational confusion.</p>
          <div className="flux-socials"><a href="/" aria-label="Website"><Globe2 size={17} /></a><a href="/contact" aria-label="Email"><Mail size={17} /></a><a href="/about" aria-label="LinkedIn"><Linkedin size={17} /></a></div>
        </div>
        {groups.map((group) => <div key={group.title} className="flux-footer-group"><h4>{group.title}</h4>{group.links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div>)}
      </div>
      <div className="flux-footer-bottom"><span>© {new Date().getFullYear()} Fluxknight. All rights reserved.</span><span>AI automation built around real operations.</span></div>
    </footer>
  );
}
