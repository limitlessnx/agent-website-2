import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";
import HomePricingOverview from "@/components/home/HomePricingOverview";

const pricingPlans = [
  { slug: "basic", name: "Basic", firstMonth: "₦150,000", ongoing: "₦50,000/month", description: "Start with one customer channel for enquiries, support, collecting lead details and passing important conversations to your team.", features: ["2,500 monthly Flux Credits", "1 channel: Web, WhatsApp or Voice", "24/7 enquiries and support", "FAQ, product and service answers", "Collect lead details + find out what they need", "Send important conversations to up to 2 team members", "Conversation history + dashboard", "No automated follow-up or reminders"], cta: "Choose Basic" },
  { slug: "plus", name: "Plus", firstMonth: "₦300,000", ongoing: "₦100,000/month", description: "Use up to two customer channels and add automatic follow-up and reminders so fewer leads are forgotten.", features: ["5,000 monthly Flux Credits", "Everything in Basic", "Use up to 2 customer channels", "Automated follow-up + reminders", "Missed-lead recovery", "Follow up again with interested or inactive leads", "Human handoff across both channels"], cta: "Choose Plus" },
  { slug: "business", name: "Business", firstMonth: "₦750,000", ongoing: "₦250,000/month", description: "Connect more customer channels, give your team shared access and keep customer details, follow-up and reporting in one place.", features: ["12,000 monthly Flux Credits", "Everything in Plus", "Website, WhatsApp, Voice + Email workflows", "Admin workspace + team access", "Keep customer details and conversation history together", "Reporting + rules for when staff should step in", "Leo Admin Assistance"], cta: "Choose Business", featured: true },
  { slug: "business-plus", name: "Business+", firstMonth: "₦2,000,000", ongoing: "₦500,000/month", description: "Add deeper automation, business records, custom integrations and dashboards for more complex operations.", features: ["25,000+ configurable Flux Credits", "Everything in Business", "Industry or operations database", "Custom business records + customer history", "Advanced workflow automation", "Advanced reporting + customer grouping", "Custom integrations + dashboards", "Managed deployment + support"], cta: "Choose Business+" },
  { slug: "custom", name: "Custom", firstMonth: "Custom", ongoing: "Custom", description: "A system built around how your business already works, including the channels, tools and tasks you want automated.", features: ["Custom automation scope + credits", "Any required channel combination", "Custom AI agents", "Follow-up, reminders + business task automation", "Custom integrations, databases + dashboards", "Internal tools + process automation", "Deployment, onboarding + support"], cta: "Build a Custom Plan", custom: true },
];

export default function HomePricingSection() {
  return (
    <section className="brand-section production-pricing-carousel" id="pricing">
      <div className="brand-shell">
        <div className="brand-heading">
          <span className="brand-eyebrow">Choose how much you want Fluxknight to handle</span>
          <h2>Start small or automate more as your business needs grow.</h2>
          <p>Start with customer enquiries and support, then add follow-up, more channels, deeper automation and business tools when you need them.</p>
        </div>
        <HomePricingOverview plans={pricingPlans} />
        <div className="hero-buttons production-pricing-route-link">
          <Link className="button-secondary" href="/pricing" data-cta="pricing-details">
            See plans and pricing <ArrowRight size={16} />
          </Link>
        </div>
        <p className="production-pricing-note">Basic handles the essentials. Plus adds follow-up and reminders. Business connects more channels and team tools. Business+ adds deeper automation and business data. Custom is built around your exact needs.</p>
      </div>
    </section>
  );
}
