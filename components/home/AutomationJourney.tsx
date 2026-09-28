import Link from "next/link";
import { ArrowRight, MessageSquareText, CalendarDays, Settings2 } from "@/components/admin/ServerIcons";

const layers = [
  {
    number: "01",
    title: "Talk to customers",
    text: "Answer enquiries across WhatsApp, voice, web and email without making customers wait.",
    icon: MessageSquareText,
    examples: ["WhatsApp", "Voice", "Web", "Email"],
  },
  {
    number: "02",
    title: "Move the customer journey",
    text: "Qualify leads, follow up, send reminders and book appointments while keeping the conversation context.",
    icon: CalendarDays,
    examples: ["Qualification", "Follow-up", "Reminders", "Bookings"],
  },
  {
    number: "03",
    title: "Keep operations updated",
    text: "Update customer records, alert the right team member and hand over conversations with the useful details attached.",
    icon: Settings2,
    examples: ["CRM", "Records", "Team alerts", "Human handoff"],
  },
] as const;

export default function AutomationJourney() {
  return (
    <section className="relative overflow-hidden bg-[#07070b] px-6 py-20 text-white md:py-28" id="services" aria-labelledby="automation-journey-title">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(168,85,247,.12),transparent_32%)]" aria-hidden="true" />
      <div className="relative mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-semibold uppercase tracking-[.28em] text-purple-300">How Fluxknight works</span>
          <h2 id="automation-journey-title" className="mt-4 text-4xl font-semibold tracking-tight md:text-6xl">
            Three layers. One connected customer operation.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-neutral-400 md:text-lg">
            Fluxknight handles the conversation, the follow-up and the business updates behind it, so your team does not have to stitch the process together manually.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {layers.map(({ number, title, text, icon: Icon, examples }) => (
            <article key={number} className="rounded-3xl border border-white/10 bg-white/[.035] p-6 md:p-7">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium tracking-[.2em] text-neutral-500">{number}</span>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/20 bg-purple-500/10 text-purple-300">
                  <Icon size={20} />
                </span>
              </div>
              <h3 className="mt-8 text-2xl font-semibold tracking-tight">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-400">{text}</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <span key={example} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-neutral-300">{example}</span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="mt-9 flex justify-center">
          <Link href="/case-studies/maia" className="inline-flex items-center gap-2 text-sm font-medium text-purple-300 transition hover:text-purple-200">
            See a real Fluxknight customer journey <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
