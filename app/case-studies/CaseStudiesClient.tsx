"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "@/components/admin/ServerIcons";

function FadeUp({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

const cases = [
  {
    number: "01",
    industry: "Real Estate · Limitless Realty",
    title: "We built and automated a real estate operation around Maia",
    client: "A live real estate system built for Limitless Realty",
    status: "Implemented system",
    intro:
      "Instead of building a chatbot in isolation, we connected the real estate operation around an AI agent, property data, lead management, media, education and human handoff. Maia sits at the front of the customer journey and helps move a buyer from first question to a qualified next step.",
    challenge:
      "Real estate enquiries arrive across channels and usually require the same information to be repeated: available properties, prices, locations, property details, buyer preferences, inspection questions and documentation. A human team can handle this, but repeating it manually does not scale.",
    solution:
      "We built Limitless Realty as a connected digital operation with a property management dashboard, lead management, image storage, customer conversations and Maia as the AI layer. The system is designed so the AI can use the organisation's property and business information instead of inventing answers.",
    flow: [
      "A prospect discovers a property or starts a conversation.",
      "Maia answers questions about the business and available properties.",
      "Maia qualifies the buyer by needs such as location, budget and property interest.",
      "Relevant property information and images can be surfaced from the system.",
      "Maia can educate prospects on real-estate and land-documentation questions where the configured knowledge supports it.",
      "Leads and conversations are captured for follow-up and sales activity.",
      "When a conversation needs a human, the system can hand the lead to the human team instead of pretending AI can negotiate everything on earth."
    ],
    dashboard: [
      "Property listings and property details",
      "Property image management and previews",
      "Lead and contact records",
      "Organisation-specific data and agent configuration",
      "Conversation and support workflows",
      "Channel and workflow connections for the operation"
    ],
    stack: ["Next.js", "Supabase", "AI agent layer", "WhatsApp workflows", "n8n", "Vercel"],
    outcome: [
      "A real estate website connected to an operational dashboard rather than a brochure site alone.",
      "A dedicated AI property/customer agent, Maia, operating as the first response layer.",
      "Property, lead and customer information brought into one operating system.",
      "A structure that can connect conversations to follow-up workflows and human agents.",
      "An education layer that helps prospects understand real-estate and land-documentation topics before they make decisions."
    ],
    ctaHref: "/case-studies/maia",
    ctaLabel: "Open the detailed Maia case study",
  },
  {
    number: "02",
    industry: "Trading · Gencouv",
    title: "From prospecting to onboarding: the Gencouv sales system",
    client: "Gencouv Trading · lead generation, email automation and customer onboarding",
    status: "Implemented workflow",
    intro:
      "Gencouv was not treated as a simple trading website. We connected the acquisition and customer journey so a prospect can be discovered, contacted, nurtured, qualified, onboarded and eventually handed to a human team without the business manually moving information between every stage.",
    challenge:
      "The growth process involved several separate jobs: finding relevant prospects, collecting contact data, sending outreach, following up, identifying interested leads, answering questions on the website, onboarding customers and getting them into the right Telegram experience. Without automation, every stage becomes another place for leads to disappear.",
    solution:
      "We designed a connected workflow around Gencouv: lead generation feeds the prospect database, email automation handles the nurture sequence, the website becomes the conversion and information layer, support handles common customer questions, and the onboarding flow routes customers into Telegram before handing conversations to a human agent when needed.",
    flow: [
      "Target prospects are sourced and organised through the lead-generation workflow.",
      "Lead data is cleaned, qualified and prepared for outreach.",
      "Email sequences begin the nurture process and continue based on the lead's stage.",
      "Interested prospects are directed into the Gencouv website and relevant conversion paths.",
      "The support layer handles common questions and reduces repetitive human replies.",
      "Customers who are ready to proceed enter the Telegram onboarding experience.",
      "The onboarding flow collects or confirms the information required for the next step.",
      "When the workflow reaches a point requiring judgement, trust or direct assistance, it routes the customer to a human agent."
    ],
    dashboard: [
      "Lead and prospect tracking",
      "Campaign and email follow-up activity",
      "Website conversion journey",
      "Support and customer conversations",
      "Telegram onboarding workflow",
      "Human-agent handoff points"
    ],
    stack: ["n8n", "Email automation", "AI support", "Telegram", "Gencouv website", "CRM/data workflows"],
    outcome: [
      "Lead generation connected directly to nurture instead of ending at a spreadsheet.",
      "Automated email follow-up that keeps prospects moving through the sales journey.",
      "A website that functions as part of the acquisition system, not a disconnected brochure.",
      "An automated support layer for repetitive customer questions.",
      "Telegram onboarding connected to the wider customer journey.",
      "Clear human handoff points so automation supports the sales team rather than trying to replace it."
    ],
    ctaHref: "/evaluation",
    ctaLabel: "Evaluate a similar acquisition workflow",
  }
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.13em", textTransform: "uppercase", color: "#a970ff", marginBottom: "10px" }}>
      {children}
    </p>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((item) => (
        <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px", fontSize: "0.9rem", color: "#b9abc9", lineHeight: 1.7 }}>
          <CheckCircle size={15} color="#b56cff" style={{ flexShrink: 0, marginTop: "4px" }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CaseStudiesClient() {
  return (
    <div>
      <section style={{ padding: "140px 24px 88px", background: "radial-gradient(circle at 50% 0%, rgba(146,72,255,0.16), transparent 42%), linear-gradient(180deg,#0b0614 0%,#06030c 100%)", borderBottom: "1px solid rgba(170,100,255,0.16)" }}>
        <div style={{ maxWidth: "820px", margin: "0 auto", textAlign: "center" }}>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="section-label" style={{ marginBottom: "16px" }}>Case Studies</p>
            <h1 style={{ fontSize: "clamp(2rem,5vw,3.7rem)", fontWeight: 900, letterSpacing: "-0.045em", lineHeight: 1.06, color: "#f7f1ff", marginBottom: "22px" }}>
              These are not hypothetical systems.
              <span className="gradient-text"> We built them.</span>
            </h1>
            <p style={{ fontSize: "1.05rem", color: "#a99ab8", lineHeight: 1.8, maxWidth: "700px", margin: "0 auto" }}>
              Two implemented builds showing how Fluxknight connects AI agents, websites, data, automation, follow-up, and human teams as one operating system.
            </p>
          </motion.div>
        </div>
      </section>

      <section style={{ padding: "44px 24px 0" }}>
        <div className="evidence-note">
          <div><span>Evidence scope</span><strong>What this page is intended to prove</strong></div>
          <p>These case studies document implemented workflow design, connected system capability, operating structure, and human handoff. Quantitative ROI, conversion, or revenue claims are not presented unless approved source data supports them.</p>
        </div>
      </section>

      <section style={{ padding: "48px 24px 100px" }}>
        <div style={{ maxWidth: "1060px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "72px" }}>
          {cases.map((c, i) => (
            <FadeUp key={c.title} delay={i * 0.05}>
              <article style={{ background: "linear-gradient(145deg, rgba(20,10,32,0.98), rgba(9,5,16,0.98))", border: "1px solid rgba(172,94,255,0.2)", borderRadius: "24px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" }}>
                <div style={{ padding: "42px 42px 36px", borderBottom: "1px solid rgba(172,94,255,0.13)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "flex-start", marginBottom: "18px" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.16em", color: "#8e56cc" }}>{c.number}</span>
                    <span className="case-status"><i /> {c.status}</span>
                  </div>
                  <span className="section-label" style={{ display: "inline-block", marginBottom: "14px" }}>{c.industry}</span>
                  <h2 style={{ fontSize: "clamp(1.6rem,3.2vw,2.5rem)", fontWeight: 850, color: "#f7f1ff", letterSpacing: "-0.035em", lineHeight: 1.15, marginBottom: "12px", maxWidth: "820px" }}>{c.title}</h2>
                  <p style={{ fontSize: "0.88rem", color: "#806e91" }}>{c.client}</p>
                </div>

                <div style={{ padding: "34px 42px", background: "rgba(174,95,255,0.045)", borderBottom: "1px solid rgba(172,94,255,0.13)" }}>
                  <p style={{ fontSize: "1rem", color: "#c6b7d4", lineHeight: 1.85, margin: 0 }}>{c.intro}</p>
                </div>

                <div style={{ padding: "42px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "44px" }} className="cs-grid">
                  <div style={{ display: "flex", flexDirection: "column", gap: "34px" }}>
                    <div>
                      <Label>The Challenge</Label>
                      <p style={{ fontSize: "0.92rem", color: "#a99ab8", lineHeight: 1.8, margin: 0 }}>{c.challenge}</p>
                    </div>
                    <div>
                      <Label>What We Built</Label>
                      <p style={{ fontSize: "0.92rem", color: "#a99ab8", lineHeight: 1.8, margin: 0 }}>{c.solution}</p>
                    </div>
                    <div>
                      <Label>System Stack</Label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {c.stack.map((s) => <span key={s} style={{ fontSize: "0.74rem", color: "#c4b3d1", border: "1px solid rgba(172,94,255,0.2)", background: "rgba(172,94,255,0.05)", borderRadius: "999px", padding: "6px 11px" }}>{s}</span>)}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>How The System Works</Label>
                    <BulletList items={c.flow} />
                  </div>
                </div>

                <div style={{ padding: "0 42px 42px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "44px" }} className="cs-grid">
                  <div style={{ borderTop: "1px solid rgba(172,94,255,0.13)", paddingTop: "30px" }}>
                    <Label>Inside The Client Dashboard</Label>
                    <BulletList items={c.dashboard} />
                  </div>
                  <div style={{ borderTop: "1px solid rgba(172,94,255,0.13)", paddingTop: "30px" }}>
                    <Label>What The Build Delivers</Label>
                    <BulletList items={c.outcome} />
                  </div>
                </div>

                <div className="case-footer">
                  <div><span>Next</span><p>See the deeper system view or map a similar workflow around your own operation.</p></div>
                  <Link href={c.ctaHref}>{c.ctaLabel} <ArrowRight size={16} /></Link>
                </div>
              </article>
            </FadeUp>
          ))}
        </div>
      </section>

      <section style={{ padding: "90px 24px", background: "linear-gradient(180deg,#0b0614,#06030c)", borderTop: "1px solid rgba(172,94,255,0.13)", textAlign: "center" }}>
        <FadeUp>
          <p className="section-label" style={{ marginBottom: "14px" }}>Build the system, not another disconnected tool</p>
          <h2 style={{ fontSize: "clamp(1.6rem,3vw,2.35rem)", fontWeight: 850, color: "#f7f1ff", marginBottom: "16px", letterSpacing: "-0.03em" }}>Your business can be the next system we map.</h2>
          <p style={{ color: "#a99ab8", maxWidth: "620px", margin: "0 auto 30px", lineHeight: 1.75 }}>Tell us what is repetitive, slow, leaking leads or consuming your team's time. We evaluate the operation before recommending the right agents and workflows.</p>
          <Link href="/evaluation" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 30px", fontSize: "0.95rem", fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#8b45e8,#b56cff)", borderRadius: "10px", textDecoration: "none", boxShadow: "0 0 30px rgba(181,108,255,0.2)" }}>
            Start an AI Evaluation <ArrowRight size={16} />
          </Link>
        </FadeUp>
      </section>

      <style>{`
        .evidence-note{max-width:1060px;margin:0 auto;display:grid;grid-template-columns:.75fr 1.25fr;gap:24px;align-items:center;padding:22px 24px;border:1px solid rgba(172,94,255,.16);border-radius:18px;background:linear-gradient(145deg,rgba(24,12,42,.76),rgba(10,6,18,.9))}.evidence-note span{display:block;color:#a970ff;font-size:.66rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.evidence-note strong{display:block;margin-top:6px;color:#f7f1ff;font-size:1rem}.evidence-note p{margin:0;color:#93859f;font-size:.8rem;line-height:1.65}.case-status{display:inline-flex;align-items:center;gap:7px;color:#aa9ab8;font-size:.68rem;font-weight:700}.case-status i{width:7px;height:7px;border-radius:50%;background:#9f65ff;box-shadow:0 0 12px rgba(159,101,255,.75)}.case-footer{display:flex;align-items:center;justify-content:space-between;gap:22px;padding:24px 42px;border-top:1px solid rgba(172,94,255,.13);background:rgba(172,94,255,.035)}.case-footer span{color:#806e91;font-size:.64rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase}.case-footer p{margin:5px 0 0;color:#9b8ca8;font-size:.78rem;line-height:1.5}.case-footer a{display:inline-flex;align-items:center;gap:8px;flex:0 0 auto;color:#c89cff;font-size:.78rem;font-weight:800;text-decoration:none}@media (max-width:768px){.cs-grid{grid-template-columns:1fr !important}.evidence-note{grid-template-columns:1fr;padding:18px}.case-footer{align-items:flex-start;flex-direction:column;padding:20px 24px}.case-footer a{flex:initial}}
      `}</style>
    </div>
  );
}
