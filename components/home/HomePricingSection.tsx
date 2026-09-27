import Link from "next/link";
import { ArrowRight } from "@/components/admin/ServerIcons";

const plans = [
  {
    name: "Basic",
    setup: "₦150k",
    monthly: "From ₦50k/mo",
    text: "Start with one AI customer channel for enquiries, support and lead capture.",
  },
  {
    name: "Plus",
    setup: "₦300k",
    monthly: "₦100k/mo",
    text: "Add automated follow-up and reminders across up to two customer channels.",
  },
  {
    name: "Business",
    setup: "₦750k",
    monthly: "₦250k/mo",
    text: "Connect more channels, team access, customer records and reporting.",
    featured: true,
  },
  {
    name: "Business+",
    setup: "₦2m",
    monthly: "₦500k/mo",
    text: "Add deeper workflow automation, business data, integrations and custom dashboards.",
  },
] as const;

export default function HomePricingSection() {
  return (
    <section className="relative overflow-hidden bg-[#06070b] px-6 py-20 text-white md:py-28" id="pricing" aria-labelledby="home-pricing-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,.10),transparent_34%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[.28em] text-purple-300">Simple starting points</span>
          <h2 id="home-pricing-title" className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            Start with what you need. Automate more when it makes sense.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-400 md:text-lg">
            The homepage gives you the useful numbers. The full comparison can live on the pricing page, where pricing details belong instead of staging a small coup against the homepage.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`relative rounded-3xl border p-6 ${"featured" in plan && plan.featured ? "border-purple-400/40 bg-purple-500/[.08] shadow-[0_20px_70px_rgba(126,55,190,.15)]" : "border-white/10 bg-white/[.035]"}`}
            >
              {"featured" in plan && plan.featured ? (
                <span className="absolute right-5 top-5 rounded-full border border-purple-300/20 bg-purple-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-purple-200">Popular</span>
              ) : null}
              <h3 className="text-xl font-semibold">{plan.name}</h3>
              <div className="mt-7">
                <span className="block text-3xl font-semibold tracking-tight">{plan.setup}</span>
                <span className="mt-1 block text-xs text-neutral-500">implementation</span>
              </div>
              <p className="mt-5 text-sm leading-6 text-neutral-400">{plan.text}</p>
              <div className="mt-7 border-t border-white/10 pt-5 text-sm font-medium text-neutral-200">{plan.monthly}</div>
            </article>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-5 rounded-3xl border border-white/10 bg-white/[.025] p-6 text-center md:flex-row md:text-left">
          <div>
            <strong className="text-base">Need something outside the standard plans?</strong>
            <p className="mt-1 text-sm text-neutral-400">We can build a custom system around your channels, tools and operating process.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 md:justify-end">
            <Link href="/pricing" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10">
              Compare all plans <ArrowRight size={16} />
            </Link>
            <Link href="/evaluation" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-neutral-100">
              Evaluate My Business <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
