"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CheckCircle,
  Network,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Truck,
  Workflow,
} from "@/components/admin/ServerIcons";
import styles from "./IndustriesClient.module.css";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const industries = [
  { slug: "hotels", icon: Building2, label: "Hotels", eyebrow: "Guest operations", image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=82", headline: "Turn guest enquiries into bookings without making the front desk carry every conversation.", outcome: "Guest Q&A, reservation intake, booking reminders, staff handoff and deeper guest operations on higher plans." },
  { slug: "restaurants", icon: ShoppingCart, label: "Restaurants", eyebrow: "Reservations & service", image: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=82", headline: "Handle reservations, orders, catering enquiries and routine customer questions without service bottlenecks.", outcome: "Menu support, structured order intake, reservations, reminders, catering qualification and staff fulfilment handoff." },
  { slug: "clinics", icon: Stethoscope, label: "Clinics", eyebrow: "Patient administration", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=82", headline: "Reduce administrative booking friction without putting clinical decisions in an AI agent.", outcome: "Approved non-clinical Q&A, appointment intake, scheduling, reminders, rescheduling and staff escalation." },
  { slug: "sales-companies", icon: Briefcase, label: "Sales Companies", eyebrow: "Lead conversion", image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=82", headline: "Qualify demand earlier and keep every serious opportunity moving toward a closer.", outcome: "Sales intake, qualification, follow-up, intent visibility, management support and human closer handoff." },
  { slug: "real-estate", icon: Building2, label: "Real Estate", eyebrow: "Buyer journey", image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=82", headline: "Turn more property enquiries into inspections and qualified buyer conversations.", outcome: "Property Q&A, buyer qualification, matching, inspection workflow, reminders, cross-channel follow-up and human-agent handoff." },
  { slug: "gyms", icon: Briefcase, label: "Gyms", eyebrow: "Membership growth", image: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=82", headline: "Turn trial interest into memberships and reduce repetitive member communication.", outcome: "Membership Q&A, qualification, trial booking, reminders, renewal communication and the future Gym Membership System." },
  { slug: "service-businesses", icon: Briefcase, label: "Service Businesses", eyebrow: "Booking operations", image: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=1200&q=82", headline: "Turn vague service enquiries into qualified jobs before staff spend time chasing details.", outcome: "Job intake, qualification, quote and booking preparation, reminders, follow-up and staff handoff." },
  { slug: "auto-shops", icon: Truck, label: "Auto Shops", eyebrow: "Repair workflow", image: "https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=1200&q=82", headline: "Capture vehicle and repair requests cleanly before they reach the workshop team.", outcome: "Vehicle intake, service qualification, quote or booking workflow, reminders, updates and advisor handoff." },
  { slug: "ecommerce", icon: ShoppingCart, label: "E-commerce", eyebrow: "Commerce support", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=82", headline: "Keep buying intent alive from product question to the right next action.", outcome: "Product Q&A, buying-intent capture, order-support intake, unfinished-journey recovery and human escalation." },
  { slug: "professional-services", icon: Briefcase, label: "Professional Services", eyebrow: "Client acquisition", image: "https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=82", headline: "Turn enquiries into qualified consultations without burying professionals in repetitive intake.", outcome: "Qualification, discovery intake, consultation booking, proposal follow-up, onboarding support and professional handoff." },
];

const systemLayers = [
  { icon: Sparkles, title: "Customer-facing AI", text: "Answers approved questions and captures the right context" },
  { icon: Workflow, title: "Automated workflows", text: "Moves follow-up, booking, reminders and handoffs forward" },
  { icon: Network, title: "Operational systems", text: "Keeps CRM, team visibility and industry records connected" },
];

export default function IndustriesClient() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="fk-shell">
          <div className={styles.heroGrid}>
            <motion.div className={styles.heroCopy} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className={styles.eyebrow}>Industries</span>
              <h1>One operating layer. <span>Different business journeys.</span></h1>
              <p>Fluxknight adapts the same automation foundation to how each industry actually sells, serves customers, books work, follows up and hands important decisions back to people.</p>
              <div className={styles.heroActions}>
                <Link className={styles.primary} href="/evaluation">Evaluate My Business <ArrowRight size={16} /></Link>
                <a className={styles.secondary} href="#industry-directory">Explore industries</a>
              </div>
            </motion.div>

            <motion.div className={styles.heroVisual} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.08 }} aria-label="Fluxknight industry automation architecture preview">
              <div className={styles.visualHead}><strong>Industry automation architecture</strong><span className={styles.live}><i /> Connected</span></div>
              <div className={styles.visualStack}>
                {systemLayers.map(({ icon: Icon, title, text }) => (
                  <div className={styles.visualItem} key={title}>
                    <span className={styles.visualIcon}><Icon size={18} /></span>
                    <div className={styles.visualCopy}><strong>{title}</strong><span>{text}</span></div>
                    <span className={styles.visualStatus}>Active</span>
                  </div>
                ))}
              </div>
              <div className={styles.visualFoot}>
                <div><b>10</b><span>industry journeys</span></div>
                <div><b>1</b><span>shared AI layer</span></div>
                <div><b>Human</b><span>when judgment matters</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className={styles.intro} id="industry-directory">
        <div className="fk-shell">
          <div className={styles.introRow}>
            <div>
              <span className={styles.eyebrow}>Built around the workflow</span>
              <h2>Start with how the business operates.</h2>
            </div>
            <p>Each industry page shows where friction usually appears, what the automation journey looks like, which channels fit, how the system should hand work to staff, and where deeper plans add operational structure rather than merely another chatbot.</p>
          </div>
        </div>
      </section>

      <section className={styles.directory}>
        <div className="fk-shell">
          <div className={styles.grid}>
            {industries.map((industry, index) => {
              const Icon = industry.icon;
              return (
                <FadeUp key={industry.slug} delay={index * 0.025}>
                  <article className={styles.card}>
                    <div className={styles.imageWrap}>
                      <img className={styles.image} src={industry.image} alt="" aria-hidden="true" loading={index < 4 ? "eager" : "lazy"} decoding="async" />
                      <div className={styles.imageShade} aria-hidden="true" />
                      <div className={styles.imageTop}>
                        <span className={styles.icon}><Icon size={20} /></span>
                        <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                      </div>
                    </div>
                    <div className={styles.content}>
                      <span className={styles.label}>{industry.eyebrow}</span>
                      <h3>{industry.headline}</h3>
                      <p className={styles.outcome}>{industry.outcome}</p>
                      <div className={styles.proof}><CheckCircle size={15} /> <span>Plans, workflows, channels and industry-specific operating scope</span></div>
                      <div className={styles.actions}>
                        <Link className={styles.cardLink} href={`/industries/${industry.slug}`}>Explore {industry.label} <ArrowRight size={14} /></Link>
                        <Link className={styles.evaluateLink} href={`/evaluation?industry=${encodeURIComponent(industry.slug)}`}>Evaluate</Link>
                      </div>
                    </div>
                  </article>
                </FadeUp>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className="fk-shell">
          <FadeUp>
            <div className={styles.ctaCard}>
              <div>
                <span className={styles.eyebrow}>Your industry is only the starting point</span>
                <h2>The useful system is the one built around your actual bottleneck.</h2>
                <p>Two companies in the same industry can need completely different automation. Fluxknight maps the customer journey, repetitive work and operational pressure before recommending the smallest useful system.</p>
              </div>
              <div className={styles.ctaActions}>
                <Link className={styles.primary} href="/evaluation">Start Business AI Evaluation <ArrowRight size={16} /></Link>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </main>
  );
}
