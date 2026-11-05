import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";
import IndustryExplorer from "@/components/home/IndustryExplorer";
import MaiaCaseStudyTeaser from "@/components/MaiaCaseStudyTeaser";
import ProductLedHero from "@/components/home/ProductLedHero";
import ProductShowcase from "@/components/home/ProductShowcase";
import MaiaInteractiveDemo from "@/components/home/MaiaInteractiveDemo";
import AutomationJourney from "@/components/home/AutomationJourney";
import MeetLeoSection from "@/components/home/MeetLeoSection";

export default function HomePage() {
  return (
    <div className="quantix-home">
      <ProductLedHero />
      <AutomationJourney />
      <IndustryExplorer />
      <ProductShowcase />
      <MaiaInteractiveDemo />
      <MeetLeoSection />
      <MaiaCaseStudyTeaser />
      <section className="brand-section evaluation-journey" id="evaluation-journey">
        <div className="brand-shell"><div className="evaluation-conversion-card evaluation-conversion-card--visual evaluation-conversion-card--image">
          <div className="evaluation-conversion-copy"><span className="brand-eyebrow">Where are opportunities slipping through?</span><h3>Evaluate how your business handles leads after they arrive.</h3><p>Show us how you handle enquiries, qualification, follow-up, bookings, support and customer records. We’ll help identify where slow response, missed follow-up or disconnected customer context may be costing you opportunities, then map where Fluxknight can help.</p></div>
          <picture className="evaluation-workflow-artwork"><source media="(max-width: 640px)" srcSet="/evaluation-workflow-mobile.svg" /><Image src="/evaluation-workflow-desktop.svg" alt="Inbound calls, WhatsApp, website chat, email, social media and other enquiries flowing into Fluxknight AI for qualification, follow-up, booking, updates and automation recommendations." width={900} height={700} sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 980px) 88vw, 62vw" /></picture>
          <div className="evaluation-conversion-actions"><Link className="button-primary" href="/evaluation" data-cta="evaluation-final">Evaluate My Business <ArrowRight size={17} /></Link><a className="button-secondary" href="/#talk-to-leo" data-cta="evaluation-talk-to-leo">Talk to Leo for more details</a><small>You do not need to know which plan or automation you need. Leo can also help you think through the gaps first.</small></div>
        </div></div>
      </section>
    </div>
  );
}
