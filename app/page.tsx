"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  MessageSquareText,
  Workflow,
} from "@/components/admin/ServerIcons";
import PublicLeoConsultant from "@/components/PublicLeoConsultant";
import IndustryCarousel from "@/components/IndustryCarousel";
import ClientReviews from "@/components/ClientReviews";
import MaiaCaseStudyTeaser from "@/components/MaiaCaseStudyTeaser";
import ReferenceFluxHeroPhase1 from "@/components/home/ReferenceFluxHeroPhase1";
import styles from "./HomepageHeaderRestore.module.css";

const automationPillars = [
  {
    icon: MessageSquareText,
    title: "Customer conversations",
    text: "Handle enquiries and support across customer-facing channels, answer approved questions, capture context, and hand the right conversations to your team.",
    detail: "WhatsApp · Web support · Inquiry handling · Support desk · Human handoff",
  },
  {
    icon: Workflow,
    title: "Follow-up & customer journey",
    text: "Keep interested customers moving after the first conversation instead of relying on staff memory or manual chasing.",
    detail: "Lead qualification · Follow-up · Reminders · Scheduling · Re-engagement",
  },
  {
    icon: Database,
    title: "Connected business operations",
    text: "Connect customer activity to the systems your team uses so information, next actions, and management visibility stay organized.",
    detail: "Email automation · CRM · Databases · Admin visibility · Custom workflows",
  },
];

export default function HomePage() {
  return (
    <main className={`quantix-home ${styles.home}`}>
      <PublicLeoConsultant />
      <ReferenceFluxHeroPhase1 />
      <MaiaCaseStudyTeaser />
      <IndustryCarousel />

      <section className="brand-section" id="services">
        <div className="brand-shell">
          <div className="brand-heading">
            <span className="brand-eyebrow">What Fluxknight automates</span>
            <h2>Three layers. One connected business system.</h2>
            <p>Start with customer conversations, add follow-up when you need it, then connect the wider operation as the business grows.</p>
          </div>
          <div className="brand-grid">
            {automationPillars.map(({ icon: Icon, title, text, detail }) => (
              <article className="brand-card" key={title}>
                <span className="brand-icon"><Icon size={21} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <small>{detail}</small>
                <Link href="/services">Explore capabilities <ArrowRight size={15} /></Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <ClientReviews />

      <section className="brand-section evaluation-journey" id="evaluation-journey">
        <div className="brand-shell">
          <div className="evaluation-conversion-card evaluation-conversion-card--visual evaluation-conversion-card--image">
            <div className="evaluation-conversion-copy">
              <span className="brand-eyebrow">Not sure where your business fits?</span>
              <h3>Show us the workflow. We’ll identify the best place to automate first.</h3>
              <p>Tell us where enquiries get lost, where follow-up breaks down, or where your team spends too much time on repetitive work.</p>
            </div>
            <picture className="evaluation-workflow-artwork">
              <source media="(max-width: 640px)" srcSet="/evaluation-workflow-mobile.svg" />
              <Image src="/evaluation-workflow-desktop.svg" alt="Enquiries, support, follow-up, scheduling and CRM flowing into Fluxknight AI, which identifies the best place to automate first." width={760} height={680} sizes="(max-width: 640px) calc(100vw - 72px), (max-width: 980px) 72vw, 52vw" />
            </picture>
            <div className="evaluation-conversion-actions">
              <Link className="button-primary" href="/evaluation" data-cta="evaluation-final">Evaluate My Business <ArrowRight size={17} /></Link>
              <small>No package selection required before the evaluation.</small>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
