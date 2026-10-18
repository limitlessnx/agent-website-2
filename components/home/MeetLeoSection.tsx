"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, AudioLines, MessageCircle, Search, Sparkles } from "lucide-react";

const examples = [
  { icon: Search, title: "Find the right starting point", description: "Describe the bottleneck. Leo helps you think through the next practical step." },
  { icon: MessageCircle, title: "Talk through your workflow", description: "Explain how enquiries, follow-ups, bookings or customer support work today." },
  { icon: Sparkles, title: "Explore where automation fits", description: "Get guidance on Fluxknight’s approach without needing to know the technical details." },
];

export default function MeetLeoSection() {
  return (
    <section id="meet-leo" className="relative isolate overflow-hidden border-y border-white/[0.07] bg-[#07050f] text-white">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-purple-700/15 blur-[100px]" />
        <div className="absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-violet-500/10 blur-[110px]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(168,85,247,.16)_1px,transparent_1px),linear-gradient(90deg,rgba(168,85,247,.16)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-5 py-12 sm:gap-10 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-10 lg:py-20">
        <div className="relative z-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-400/[0.08] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-purple-200">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-300 shadow-[0_0_12px_rgba(192,132,252,.9)]" />
            Meet Leo
          </div>
          <h2 className="max-w-xl text-4xl font-semibold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
            Your AI business assistant.
            <span className="mt-2 block bg-gradient-to-r from-violet-300 via-purple-400 to-fuchsia-300 bg-clip-text pb-1 text-transparent">A clearer next step.</span>
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            Meet Leo, Fluxknight’s support and business-evaluation assistant. Talk or type about the way your business works, explore what Fluxknight can help with, and get guidance on where customer conversations and routine follow-through could improve.
          </p>

          <div className="mt-9 grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
            {examples.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex gap-3.5">
                <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-purple-300/15 bg-purple-400/[0.08] text-purple-200">
                  <Icon size={18} strokeWidth={1.7} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-white sm:text-base">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-white/55">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#talk-to-leo" className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(124,58,237,.25)] transition hover:bg-purple-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-300">
              Talk to Leo <MessageCircle size={17} /> <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </a>
            <Link href="/evaluation" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.035] px-6 py-3 text-sm font-semibold text-white/85 transition hover:border-purple-300/35 hover:bg-white/[0.07]">
              Evaluate my business
            </Link>
          </div>
          <p className="mt-4 text-xs leading-5 text-white/40">Leo’s public chat helps you explore fit and next steps. Workspace-specific answers depend on the data and access available in your signed-in Fluxknight workspace.</p>
        </div>

        <div className="relative mx-auto w-full max-w-[560px] min-w-0">
          <div aria-hidden="true" className="absolute left-1/2 top-[10%] h-56 w-56 -translate-x-1/2 rounded-full bg-purple-500/20 blur-[75px] sm:h-72 sm:w-72" />
          <div className="relative flex min-w-0 flex-col items-center">
            <div className="relative z-10 mx-auto w-[min(68vw,270px)] sm:w-[min(44vw,320px)] lg:w-[min(100%,360px)]">
              <Image src="https://d2ol7oe51mr4n9.cloudfront.net/user_3GTV38w6zCm0fb6vRYkPEmmsNnH/e9f1e345-e1c5-48a9-bac9-4ea84663bd58.jpg" alt="Leo, Fluxknight’s friendly white-and-black robot with glowing purple facial features and illuminated headphones" width={480} height={450} quality={75} sizes="(min-width: 1024px) 360px, (min-width: 640px) 320px, 68vw" className="block h-auto max-h-[420px] w-full object-contain drop-shadow-[0_20px_45px_rgba(124,58,237,.22)] sm:max-h-[460px] lg:max-h-[480px]" />
              <div className="absolute bottom-[5%] left-1/2 w-max max-w-[90%] -translate-x-1/2 rounded-xl border border-purple-300/25 bg-[#100b1c]/90 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur sm:bottom-[7%] sm:px-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-white"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Leo <span className="font-normal text-white/45">· assistant preview</span></div>
              </div>
            </div>

            <div className="relative z-20 mt-2 w-full min-w-0 rounded-2xl border border-white/10 bg-[#100d19]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,.45)] backdrop-blur-xl sm:mt-4 sm:p-5">
              <div className="mb-4 flex min-w-0 items-center gap-2.5 rounded-xl border border-purple-300/15 bg-purple-400/[0.06] px-3 py-2">
                <Image src="/fluxknight-mark.svg" alt="Fluxknight logo" width={26} height={26} className="h-6 w-6 shrink-0 object-contain" />
                <span className="text-sm font-semibold tracking-wide text-white">Fluxknight</span>
                <span className="ml-auto text-right text-[10px] font-medium uppercase tracking-[0.14em] text-purple-200/70">Leo assistant</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-purple-300/20 bg-purple-400/10 text-purple-200"><Sparkles size={17} /></span>
                  <div className="min-w-0"><p className="text-sm font-semibold">A conversation with Leo</p><p className="mt-0.5 text-xs text-white/45">Illustrative example</p></div>
                </div>
                <AudioLines size={18} className="shrink-0 text-purple-300" />
              </div>
              <div className="space-y-4 py-5">
                <div className="ml-auto max-w-[92%] break-words rounded-2xl rounded-tr-sm border border-purple-300/15 bg-purple-500/20 px-3.5 py-3 text-sm leading-6 text-white/90">
                  We miss follow-ups after new enquiries come in.
                </div>
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-purple-400/10 text-purple-200"><Sparkles size={14} /></span>
                  <div className="min-w-0 break-words rounded-2xl rounded-tl-sm border border-white/[0.08] bg-white/[0.035] px-3.5 py-3 text-sm leading-6 text-white/75">
                    Let’s map what happens after an enquiry, where the response slows down, and which follow-up steps may be suitable for automation.
                  </div>
                </div>
              </div>
              <a href="#talk-to-leo" className="flex w-full items-center justify-between gap-3 rounded-xl border border-purple-300/20 bg-purple-400/[0.07] px-3.5 py-3 text-left text-sm text-purple-100 transition hover:bg-purple-400/[0.12]">
                <span>Start your own conversation</span><ArrowRight size={16} className="shrink-0" />
              </a>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] leading-5 text-white/35">Example dialogue only. No live customer metrics or workspace records are shown.</p>
        </div>
      </div>
    </section>
  );
}
