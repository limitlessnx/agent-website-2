"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  BarChart2,
  Bot,
  Calendar,
  CheckCircle,
  Database,
  FileText,
  Headphones,
  MessageSquare,
  Mic,
  Network,
  Sparkles,
  Workflow,
} from "@/components/admin/ServerIcons";
import styles from "./ServicesClient.module.css";

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

const allServices = [
  { id: "ai-sales-agent", icon: Bot, title: "AI Sales Agent", tagline: "Your best salesperson doesn't sleep.", desc: "A conversational AI that qualifies leads, handles objections, answers approved buying questions and books meetings around the clock.", bullets: ["Lead qualification and scoring", "Objection handling", "Appointment booking", "CRM sync", "Human handoff"] },
  { id: "ai-customer-support", icon: Headphones, title: "AI Customer Support Agent", tagline: "Instant answers. Zero queue.", desc: "Resolve FAQs, handle routine support requests and escalate edge cases across the channels your customers already use.", bullets: ["24/7 support", "Ticket routing", "Escalation", "Knowledge base", "Human takeover"] },
  { id: "whatsapp", icon: MessageSquare, title: "WhatsApp AI Assistant", tagline: "Your business runs on WhatsApp. Your AI should too.", desc: "Automate WhatsApp conversations from first enquiry through qualification, support, booking and follow-up using the approved business API.", bullets: ["WhatsApp Business API", "Lead intake", "Q&A", "Follow-up", "Media sharing"] },
  { id: "telegram", icon: MessageSquare, title: "Telegram AI Assistant", tagline: "Bots with actual intelligence.", desc: "AI-powered Telegram systems for customer engagement, lead handling, notifications and internal business workflows.", bullets: ["Customer chat", "Notifications", "Lead handling", "Internal automation", "Broadcast workflows"] },
  { id: "voice", icon: Mic, title: "AI Voice Agent", tagline: "Every call answered. Every lead captured.", desc: "An AI that can handle configured inbound or outbound calls, qualify callers, book appointments and hand off important conversations.", bullets: ["Inbound calls", "Outbound calls", "Scheduling", "Qualification", "Call summaries"] },
  { id: "crm", icon: Database, title: "CRM Automation", tagline: "Your CRM should fill itself.", desc: "Connect lead capture, conversations, qualification and follow-up so your CRM stays current without manual data entry.", bullets: ["Lead capture", "Stage updates", "Follow-up triggers", "Pipeline reporting", "CRM integrations"] },
  { id: "lead-generation", icon: BarChart2, title: "Lead Generation Engine", tagline: "Prospecting and qualification on autopilot.", desc: "Discover relevant public business prospects, enrich records, qualify them and pass sales-ready leads into connected outreach workflows.", bullets: ["Targeted prospecting", "Enrichment", "Deduplication", "Lead scoring", "Sales alerts"] },
  { id: "calendar-email", icon: Calendar, title: "Calendar & Email Automation", tagline: "Outreach that runs itself.", desc: "Automate email sequences, appointment reminders, booking flows and calendar-driven follow-up so opportunities keep moving.", bullets: ["Email sequences", "Reminders", "No-show follow-up", "Proposal follow-up", "Calendar sync"] },
  { id: "email-follow-up", icon: FileText, title: "Email Follow-up Automation", tagline: "Every lead gets the right next message.", desc: "Give cold, warm and hot leads different follow-up paths based on behaviour, interest, timing and qualification state.", bullets: ["Cold nurture", "Warm follow-up", "Hot lead prompts", "Reply tracking", "Reusable campaigns"] },
];

const flow = [
  { icon: MessageSquare, title: "Customer channels", text: "Website, WhatsApp, voice, email and messaging" },
  { icon: Sparkles, title: "Fluxknight AI", text: "Responds, qualifies, routes and keeps context connected" },
  { icon: Workflow, title: "Automated work", text: "Follow-up, booking, updates, reminders and handoffs" },
  { icon: Network, title: "Business systems", text: "CRM, dashboards, team visibility and operational records" },
];

export default function ServicesClient() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="fk-shell">
          <div className={styles.heroGrid}>
            <motion.div className={styles.heroCopy} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <span className={styles.eyebrow}>Fluxknight services</span>
              <h1>AI systems built around <span>how your business works.</span></h1>
              <p>Explore what each system does, how it works, what your business gains and what the client dashboard can track. Start with one service or let Fluxknight map the right combination for your operation.</p>
              <div className={styles.heroActions}>
                <Link className={styles.primary} href="/evaluation">Evaluate My Business <ArrowRight size={16} /></Link>
                <a className={styles.secondary} href="#service-systems">Explore the systems</a>
              </div>
            </motion.div>

            <motion.div className={styles.heroVisual} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.08 }} aria-label="Fluxknight connected automation system preview">
              <div className={styles.visualHead}><strong>Connected operation</strong><span className={styles.live}><i /> Systems online</span></div>
              <div className={styles.flow}>
                {flow.map(({ icon: Icon, title, text }) => (
                  <div className={styles.flowRow} key={title}>
                    <span className={styles.flowIcon}><Icon size={18} /></span>
                    <div className={styles.flowCopy}><strong>{title}</strong><span>{text}</span></div>
                  </div>
                ))}
              </div>
              <div className={styles.visualFoot}>
                <div><b>24/7</b><span>coverage</span></div>
                <div><b>1</b><span>connected context</span></div>
                <div><b>Human</b><span>when needed</span></div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className={styles.intro} id="service-systems">
        <div className="fk-shell">
          <div className={styles.introRow}>
            <div><span className={styles.eyebrow}>Automation systems</span><h2>Choose the pressure point. Connect the rest.</h2></div>
            <p>Fluxknight services are designed to work alone or as one connected operating layer. Customer conversations can feed qualification, follow-up, scheduling, CRM updates and human handoff instead of becoming another isolated tool your team has to babysit.</p>
          </div>
        </div>
      </section>

      <section className={styles.services}>
        <div className="fk-shell">
          <div className={styles.grid}>
            {allServices.map((service, index) => (
              <FadeUp key={service.id} delay={(index % 2) * 0.04}>
                <article className={styles.card} id={service.id}>
                  <div className={styles.cardTop}>
                    <span className={styles.icon}><service.icon size={21} /></span>
                    <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className={styles.tagline}>{service.tagline}</p>
                  <h3>{service.title}</h3>
                  <p className={styles.description}>{service.desc}</p>
                  <span className={styles.includedLabel}>What&apos;s included</span>
                  <ul className={styles.bullets}>
                    {service.bullets.map((bullet) => <li key={bullet}><CheckCircle size={14} />{bullet}</li>)}
                  </ul>
                  <Link className={styles.cardLink} href={`/services/${service.id}`}>View how it works <ArrowRight size={15} /></Link>
                </article>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className="fk-shell">
          <FadeUp>
            <div className={styles.ctaCard}>
              <div>
                <span className={styles.eyebrow}>Not sure which system fits?</span>
                <h2>Start with the business problem, not the technology.</h2>
                <p>Show us where enquiries get lost, where staff repeat the same work, or where follow-up breaks down. Fluxknight will map the smallest useful automation system first.</p>
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
