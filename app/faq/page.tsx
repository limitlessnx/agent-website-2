import type { Metadata } from "next";
import Link from "next/link";

const description = "Answers about Fluxknight AI agents, channels, workflows, credits, setup, support, security, and usage-based services.";

export const metadata: Metadata = {
  title: "FAQ",
  description,
  alternates: { canonical: "/faq" },
  openGraph: { type: "website", url: "/faq", title: "Fluxknight FAQ", description },
  twitter: { card: "summary_large_image", title: "Fluxknight FAQ", description },
};

const faqs = [
  {
    q: "What is Fluxknight?",
    a: "Fluxknight designs and deploys AI systems around the way your business already works. That can include one AI agent, several connected agents, communication channels such as WhatsApp or web chat, and workflow automation behind them. You describe the business problem first, then we recommend the system rather than making you choose technical components blindly.",
  },
  {
    q: "Do I have to know which AI agent I need before I start?",
    a: "No. The evaluation process is intentionally problem-first. Tell us what is slow, repetitive, expensive, being missed, or difficult for your team. We assess the requirement and recommend the appropriate agent, channel, workflow, integrations, or combination.",
  },
  {
    q: "Can one Fluxknight system use WhatsApp, web chat, Telegram, email and voice together?",
    a: "Yes. Channels are separate from the agent itself, so a suitable system can connect the same business intelligence and workflow layer to multiple channels. The exact combination depends on the use case and the APIs or accounts available to the business.",
  },
  {
    q: "What happens after my included usage or credits are used?",
    a: "Additional usage can be billed when the allocated allowance is exhausted. Third-party services such as WhatsApp Business API messaging, voice minutes, AI model usage, email delivery, SMS, and other infrastructure are consumption-based costs. Additional usage keeps the system running instead of unexpectedly stopping a live customer conversation.",
  },
  {
    q: "Why are WhatsApp API messages charged separately?",
    a: "WhatsApp Business Platform usage is governed by Meta's business messaging pricing and conversation rules. Those are external platform costs, not a fee Fluxknight can simply remove. Fluxknight can manage the integration, automation and reporting, while the applicable WhatsApp usage is accounted for separately.",
  },
  {
    q: "Why can voice calls cost extra?",
    a: "Voice systems consume telephony infrastructure and often AI speech, transcription, or model resources by minute. Extra voice usage therefore represents real third-party consumption. Charging it separately keeps your base plan predictable and lets you scale call volume without forcing every client to pay for someone else's heavy usage.",
  },
  {
    q: "Will I be warned before my allocated credits run out?",
    a: "The intended experience is to make usage visible in the client dashboard and provide clear thresholds before an allowance is exhausted. Where a third-party provider has its own limit or billing event, the system should also surface that state instead of silently failing.",
  },
  {
    q: "Can I connect my existing CRM and workflows?",
    a: "Yes, where an integration or API is available. Fluxknight systems can pass lead, customer, conversation, booking, and status information between agents and workflows. This allows a lead-generation workflow to hand a qualified prospect to email follow-up, WhatsApp, Telegram, a voice agent, or your CRM instead of creating isolated automations.",
  },
  {
    q: "Can workflows trigger other workflows?",
    a: "Yes. Connected workflows are a core part of the architecture. For example, lead generation can create a lead, trigger enrichment, send an email sequence, notify a sales agent, and start WhatsApp or voice follow-up when the lead reaches a defined qualification state.",
  },
  {
    q: "Will I get a dashboard?",
    a: "Yes. The client experience is designed around a dashboard showing the systems assigned to the business, connected channels, workflow activity, leads or conversations, usage, and important actions. The exact dashboard modules depend on what has been deployed for that client.",
  },
  {
    q: "Can a support agent work on more than one channel?",
    a: "Yes. A support agent can be connected to supported channels such as WhatsApp, web chat, Telegram and other approved channels. The agent role stays separate from the communication channel so the same support logic can be reused without creating a completely different support brain for every channel.",
  },
  {
    q: "Do you replace my staff?",
    a: "The goal is usually to remove repetitive work and improve response speed, not to remove useful human judgment. Systems can qualify leads, answer routine questions, schedule appointments, update records and escalate situations that require a person.",
  },
  {
    q: "How does setup work?",
    a: "You first describe the business and the outcome you want. Fluxknight evaluates the requirement, defines the recommended system, confirms integrations and usage requirements, configures the agents and workflows, tests the system, and then makes the dashboard and operating process available to the client.",
  },
  {
    q: "Can I add more channels or workflows later?",
    a: "Yes. Systems are designed to be expandable. A client can start with one workflow or channel and add another when the business needs it, subject to the required integration, configuration and usage costs.",
  },
  {
    q: "How do I know which service is right for my business?",
    a: "You do not need to decide from a menu of technical products. Start with the Business AI Evaluation and describe the problem. Fluxknight can then recommend the service or combination of services that fits the operation.",
  },
];

export default function FAQPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#090510", color: "#f7f0ff", overflowX: "hidden" }}>
      <section style={{ padding: "148px 20px 76px", background: "radial-gradient(circle at 50% 0%,rgba(168,85,247,.18),transparent 42%),linear-gradient(180deg,#10091a 0%,#090510 100%)", borderBottom: "1px solid rgba(168,85,247,.22)" }}>
        <div style={{ maxWidth: 820, margin: "0 auto", textAlign: "center" }}>
          <p style={{ color: "#c084fc", fontSize: ".76rem", fontWeight: 900, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 14 }}>Fluxknight FAQ</p>
          <h1 style={{ fontSize: "clamp(2.25rem,7vw,4.8rem)", lineHeight: 1, letterSpacing: "-.055em", margin: 0 }}>Questions before you build.</h1>
          <p style={{ maxWidth: 680, margin: "22px auto 0", color: "#b9a8c9", fontSize: "1rem", lineHeight: 1.75 }}>
            Clear answers about AI agents, channels, workflows, dashboards, credits and the less glamorous part of automation: third-party usage costs.
          </p>
        </div>
      </section>

      <section style={{ padding: "56px 20px 110px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto", display: "grid", gap: 12 }}>
          {faqs.map((item, index) => (
            <details key={item.q} open={index === 0} style={{ background: "#10091a", border: "1px solid rgba(168,85,247,.24)", borderRadius: 16, padding: "0 20px" }}>
              <summary style={{ cursor: "pointer", listStyle: "none", padding: "21px 0", fontSize: "1rem", fontWeight: 800, color: "#f7f0ff", display: "flex", justifyContent: "space-between", gap: 20 }}>
                <span>{item.q}</span><span aria-hidden style={{ color: "#c084fc" }}>+</span>
              </summary>
              <p style={{ color: "#b9a8c9", lineHeight: 1.75, fontSize: ".94rem", margin: "0 0 22px", maxWidth: 800 }}>{item.a}</p>
            </details>
          ))}
        </div>

        <div style={{ maxWidth: 920, margin: "52px auto 0", padding: "28px", borderRadius: 18, border: "1px solid rgba(168,85,247,.34)", background: "linear-gradient(135deg,rgba(168,85,247,.12),rgba(20,12,32,.72))" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: "1.35rem" }}>Still unsure what your business actually needs?</h2>
          <p style={{ color: "#b9a8c9", lineHeight: 1.7, margin: "0 0 20px" }}>Do not pick an agent because the card looked impressive. Describe the business problem and let the evaluation process determine the architecture.</p>
          <Link href="/evaluation" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 20px", borderRadius: 10, background: "linear-gradient(135deg,#a855f7,#8b5cf6)", color: "white", textDecoration: "none", fontWeight: 900 }}>Start Business AI Evaluation <span>↗</span></Link>
        </div>
      </section>
    </main>
  );
}
