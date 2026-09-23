import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";
import IndustryCarousel from "@/components/IndustryCarousel";
import ClientReviews from "@/components/ClientReviews";
import MaiaCaseStudyTeaser from "@/components/MaiaCaseStudyTeaser";
import ReferenceFluxHeroPhase1 from "@/components/home/ReferenceFluxHeroPhase1";
import AutomationJourney from "@/components/home/AutomationJourney";
import HomePricingSection from "@/components/home/HomePricingSection";
import styles from "./HomepageHeaderRestore.module.css";

export default function HomePage() {
  return (
    <main className={`quantix-home ${styles.home}`}>
      <ReferenceFluxHeroPhase1 />
      <AutomationJourney />
      <MaiaCaseStudyTeaser />
      <IndustryCarousel />
      <ClientReviews />
      <HomePricingSection />
      <section className="brand-section evaluation-journey" id="evaluation-journey">
        <div className="brand-shell"><div className="evaluation-conversion-card evaluation-conversion-card--visual evaluation-conversion-card--image">
          <div className="evaluation-conversion-copy"><span className="brand-eyebrow">Not sure what to automate?</span><h3>Tell us how your business works today.</h3><p>Show us how you handle enquiries, sales, orders, follow-up, bookings, support and customer records. We’ll show you what Fluxknight can automate.</p></div>
          <picture className="evaluation-workflow-artwork"><source media="(max-width: 640px)" srcSet="/evaluation-workflow-mobile.svg" /><Image src="/evaluation-workflow-desktop.svg" alt="Inbound calls, WhatsApp, website chat, email, social media and other enquiries flowing into Fluxknight AI for qualification, follow-up, booking, updates and automation recommendations." width={900} height={700} sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 980px) 88vw, 62vw" /></picture>
          <div className="evaluation-conversion-actions"><Link className="button-primary" href="/evaluation" data-cta="evaluation-final">Evaluate My Business <ArrowRight size={17} /></Link><small>You do not need to know which plan or automation you need.</small></div>
        </div></div>
      </section>
    </main>
  );
}
