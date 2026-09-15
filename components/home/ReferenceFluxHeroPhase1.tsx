"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Home,
  Infinity as InfinityIcon,
  MessageSquareText,
  PlayCircle,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";

const metricCards = [
  { label: "Active conversations", value: "1,248", change: "12.5%", color: "#4ade80", path: "M0,15 Q10,5 20,10 T40,12 T60,5 T80,15 T100,2" },
  { label: "Qualified leads", value: "386", change: "8.2%", color: "#60a5fa", path: "M0,18 Q15,10 25,15 T50,8 T75,12 T100,4" },
  { label: "Appointments booked", value: "74", change: "16.3%", color: "#fb923c", path: "M0,10 Q20,15 30,5 T60,10 T80,5 T100,12" },
  { label: "Follow-ups sent", value: "912", change: "7.1%", color: "#c084fc", path: "M0,12 Q15,8 30,14 T65,6 T85,10 T100,3" },
];

const navItems = ["Product", "Features", "Integrations", "Pricing"];
const energyLines = Array.from({ length: 12 }, (_, i) => i);
const particles = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 61) % 100}%`,
  size: 1 + (i % 2),
  delay: (i % 7) * 0.22,
  duration: 5.2 + (i % 5) * 0.6,
}));

export default function ReferenceFluxHeroPhase1() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-[#03000A] text-neutral-50 selection:bg-purple-500/30">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[100vh] overflow-hidden" aria-hidden="true">
        <div className="absolute right-[-18rem] top-[1rem] h-[32rem] w-[32rem] rounded-full border border-purple-300/20 shadow-[0_0_90px_rgba(124,58,237,.12)] sm:right-[-12rem] sm:h-[35rem] sm:w-[35rem]" />
        <div className="absolute right-[-17rem] top-[-3rem] h-[38rem] w-[38rem] rounded-full border-[12px] border-purple-500/[0.035] blur-lg sm:right-[-15rem] sm:h-[41rem] sm:w-[41rem]" />

        <svg className="absolute bottom-[13rem] right-[-36rem] h-[30rem] w-[66rem] opacity-30 sm:bottom-[-9rem] sm:right-[-4rem] sm:h-[36rem] sm:w-[72rem] sm:opacity-55" viewBox="0 0 1200 600" fill="none">
          {energyLines.map((i) => (
            <motion.path
              key={i}
              d={`M${360 + i * 8} 625 C ${430 + i * 5} ${492 - (i % 4) * 8}, ${590 + i * 7} ${402 - i * 7}, ${760 + i * 9} ${305 - (i % 5) * 8} C ${900 + i * 4} ${225 + (i % 4) * 6}, 1060 ${166 + (i % 5) * 5}, 1235 ${132 + (i % 3) * 3}`}
              stroke={i % 4 === 0 ? "#c4b5fd" : i % 3 === 0 ? "#a78bfa" : "#7c3aed"}
              strokeWidth={i % 4 === 0 ? 1.6 : 0.8}
              strokeLinecap="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={reduceMotion ? { opacity: 0.38 } : { pathLength: 1, opacity: [0.1, 0.55, 0.18] }}
              transition={reduceMotion ? undefined : { duration: 5.5 + i * 0.18, repeat: Infinity, repeatType: "reverse", ease: "easeInOut", delay: i * 0.08 }}
            />
          ))}
        </svg>

        {!reduceMotion && (
          <div className="absolute inset-0">
            {particles.map((particle, i) => (
              <motion.span
                key={i}
                className="absolute rounded-full bg-purple-200/45 shadow-[0_0_7px_rgba(196,181,253,.32)]"
                style={{ left: particle.left, top: particle.top, width: particle.size, height: particle.size }}
                animate={{ opacity: [0.08, 0.42, 0.08], y: [0, -3, 0] }}
                transition={{ duration: particle.duration, repeat: Infinity, ease: "easeInOut", delay: particle.delay }}
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_88%_14%,rgba(139,92,246,.11),transparent_25%)] sm:bg-[radial-gradient(circle_at_74%_20%,rgba(139,92,246,.10),transparent_29%)]" />
      </div>

      <nav className="relative z-50 mx-auto flex max-w-7xl items-center justify-between px-5 pt-5 sm:px-6 sm:pt-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Fluxknight home">
          <InfinityIcon className="h-7 w-7 text-purple-500 sm:h-8 sm:w-8" strokeWidth={1.8} />
          <span className="text-lg font-medium tracking-tight sm:text-xl">Fluxknight</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm font-medium text-neutral-400 md:flex">
          {navItems.map((item) => (
            <Link key={item} href={item === "Pricing" ? "/pricing" : `#${item.toLowerCase()}`} className="transition-colors duration-200 hover:text-white">
              {item}
            </Link>
          ))}
          <Link href="/resources" className="flex items-center gap-1 transition-colors duration-200 hover:text-white">
            Resources <ChevronDown className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/login" className="hidden text-sm font-medium text-neutral-400 transition-colors hover:text-white md:block">Log in</Link>
          <Link href="/evaluation" className="group flex min-h-10 items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500 px-4 py-2 text-xs font-medium text-white shadow-[0_8px_28px_rgba(124,58,237,.18)] transition-all duration-200 hover:bg-purple-400 sm:px-5 sm:text-sm">
            <span className="hidden sm:inline">Evaluate My Business</span><span className="sm:hidden">Get Started</span><ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pb-24 sm:pt-20 lg:min-h-[85vh] lg:grid-cols-12 lg:gap-10 lg:pb-36 lg:pt-28">
        <div className="z-20 flex flex-col gap-5 text-left sm:gap-6 lg:col-span-5 lg:gap-7">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }} className="flex items-start">
            <div className="inline-flex max-w-full items-center gap-2 border-l border-purple-400/50 pl-3">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-purple-400" strokeWidth={1.5} />
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-purple-300 sm:text-xs">AI-Powered Sales &amp; Customer Operations</span>
            </div>
          </motion.div>

          <h1 className="max-w-[13ch] text-[2.6rem] font-medium leading-[1.02] tracking-[-0.045em] sm:max-w-[12ch] sm:text-6xl lg:max-w-[11.5ch] lg:text-[4.55rem] lg:leading-[1.02]">
            {["Grow your organization", "without growing", "the workload."].map((line, index) => (
              <div key={line} className="overflow-hidden pb-1">
                <motion.div
                  initial={reduceMotion ? false : { y: "105%" }}
                  animate={{ y: "0%" }}
                  transition={{ duration: .9, delay: reduceMotion ? 0 : .1 + index * .12, ease: [0.22, 1, 0.36, 1] }}
                  className={index === 2 ? "block text-purple-300" : "block"}
                >
                  {line}
                </motion.div>
              </div>
            ))}
          </h1>

          <motion.p initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: reduceMotion ? 0 : .55 }} className="max-w-[35rem] text-[15px] font-normal leading-7 text-neutral-400 sm:max-w-[34rem] sm:text-[17px] sm:leading-8">
            Fluxknight builds AI systems that handle customer conversations and the work that follows, from enquiry and support to follow-up, scheduling, CRM updates, and human handoff.
          </motion.p>

          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .65, delay: reduceMotion ? 0 : .65 }} className="grid grid-cols-1 gap-3 pt-1 sm:flex sm:flex-row sm:items-center sm:gap-3">
            <Link href="/pricing" className="group flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-6 py-3 text-sm font-medium text-neutral-950 transition-all duration-200 hover:bg-white sm:w-auto">
              See Pricing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="#services" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-6 py-3 text-sm font-medium text-neutral-200 transition-colors duration-200 hover:border-white/20 hover:bg-white/[0.06] sm:w-auto">
              Watch how it works <PlayCircle className="h-5 w-5 text-neutral-400" />
            </Link>
          </motion.div>
        </div>

        <div className="relative z-20 w-full lg:col-span-7" style={{ perspective: "1200px" }}>
          <div className="pointer-events-none absolute inset-0 -translate-y-6 scale-[.86] rounded-full bg-purple-500/10 blur-[90px]" />

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 20, scale: .985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: .9, delay: reduceMotion ? 0 : .32, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-[420px] sm:hidden"
          >
            <div className="overflow-hidden rounded-[1.35rem] border border-white/[0.09] bg-[#090910]/95 shadow-[0_24px_70px_rgba(0,0,0,.5)]">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3.5">
                <div><p className="text-[10px] uppercase tracking-[0.16em] text-purple-300">Fluxknight overview</p><h3 className="mt-1 text-sm font-medium text-white">Customer operations today</h3></div>
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-purple-400/15 bg-purple-500/[0.08] text-purple-300"><BarChart3 className="h-3.5 w-3.5" /></span>
              </div>
              <div className="p-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {metricCards.map((card) => (
                    <div key={card.label} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <span className="block text-[9px] leading-4 text-neutral-500">{card.label}</span>
                      <div className="mt-1 flex items-end justify-between gap-2"><strong className="text-lg font-medium tracking-tight text-white">{card.value}</strong><span className="mb-0.5 inline-flex items-center gap-0.5 text-[9px] text-green-400"><TrendingUp className="h-2.5 w-2.5" />{card.change}</span></div>
                    </div>
                  ))}
                </div>
                <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                  <div className="flex items-center justify-between"><span className="text-[10px] font-medium text-neutral-200">Live customer journey</span><span className="inline-flex items-center gap-1 rounded-full border border-green-400/15 bg-green-400/[0.06] px-2 py-1 text-[8px] font-medium text-green-300"><span className="h-1.5 w-1.5 rounded-full bg-green-400" /> Running</span></div>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2.5 rounded-lg border border-purple-400/10 bg-purple-500/[0.05] px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-300"><MessageSquareText className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-white">New WhatsApp enquiry qualified</p><span className="text-[8px] text-neutral-500">Maia · 1 min ago</span></div><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" /></div>
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-neutral-300"><Clock3 className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-white">Follow-up scheduled automatically</p><span className="text-[8px] text-neutral-500">Lead workflow · today</span></div><ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-600" /></div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"><div><span className="block text-[8px] uppercase tracking-[0.14em] text-neutral-600">Top channels</span><strong className="mt-0.5 block text-[11px] font-medium text-neutral-200">WhatsApp · Web · Voice</strong></div><span className="rounded-full border border-purple-400/15 bg-purple-500/[0.07] px-2.5 py-1 text-[9px] text-purple-300">1.2K interactions</span></div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, rotateY: -8, rotateX: 3, y: 24 }}
            animate={{ opacity: 1, rotateY: -5, rotateX: 2, y: 0 }}
            transition={{ duration: 1, delay: reduceMotion ? 0 : .35, ease: [0.22, 1, 0.36, 1] }}
            className="relative ml-auto hidden aspect-[16/10] w-full max-w-[800px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#090910]/94 shadow-[-18px_28px_58px_rgba(0,0,0,.62)] sm:block"
            style={{ transformStyle: "preserve-3d" }}
          >
            <div className="relative flex h-full flex-row overflow-hidden text-sm">
              <aside className="hidden w-48 flex-col border-r border-white/5 bg-white/[0.015] pt-6 md:flex">
                <div className="mb-8 px-6"><InfinityIcon className="h-6 w-6 text-purple-500" /></div>
                <div className="flex flex-col gap-1 px-3">
                  {[[Home, "Overview", true], [MessageSquareText, "Conversations", false], [Users, "Leads", false], [Workflow, "Automations", false], [BarChart3, "Analytics", false]].map(([Icon, label, active]) => {
                    const Cmp = Icon as typeof Home;
                    return <div key={String(label)} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium ${active ? "bg-purple-500/10 text-purple-300" : "text-neutral-500"}`}><Cmp className="h-4 w-4" />{String(label)}</div>;
                  })}
                </div>
                <div className="mb-6 mt-auto px-6"><div className="flex items-center gap-3 text-neutral-500"><Settings className="h-4 w-4" /><span className="text-xs font-medium">Settings</span></div></div>
              </aside>

              <div className="flex flex-1 flex-col overflow-hidden p-4 md:p-6">
                <div className="mb-4 flex items-start justify-between md:mb-6"><div><h3 className="text-sm font-medium text-neutral-100 md:text-base">Good morning, team 👋</h3><p className="mt-1 hidden text-xs text-neutral-500 md:block">Here&apos;s what Fluxknight handled across your customer journey today.</p></div><div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[10px] text-neutral-400 md:px-3 md:text-xs"><CalendarDays className="h-3.5 w-3.5 md:h-4 md:w-4" /> This month <ChevronDown className="hidden h-3 w-3 text-neutral-600 md:block" /></div></div>

                <div className="mb-4 grid grid-cols-2 gap-2 md:mb-6 md:gap-3 lg:grid-cols-4">
                  {metricCards.map((card) => (
                    <div key={card.label} className="flex flex-col gap-1 rounded-xl border border-white/[0.055] bg-white/[0.022] p-2.5 md:p-4"><span className="text-[8px] font-medium text-neutral-500 md:text-[10px]">{card.label}</span><span className="text-base font-medium tracking-tight text-white md:text-lg">{card.value}</span><div className="mt-1 flex items-center gap-1 text-[8px] text-green-400 md:text-[10px]"><TrendingUp className="h-3 w-3" />{card.change}</div><div className="relative mt-1 h-4 w-full md:mt-2 md:h-6"><svg viewBox="0 0 100 20" className="h-full w-full overflow-visible"><path d={card.path} fill="none" stroke={card.color} strokeWidth="1.35" opacity=".78" /></svg></div></div>
                  ))}
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-3 gap-3 md:gap-5">
                  <div className="relative col-span-2 flex flex-col rounded-xl border border-white/[0.055] bg-white/[0.018] p-3 md:p-4"><div className="mb-2 flex items-center justify-between md:mb-4"><span className="text-[10px] font-medium text-neutral-200 md:text-xs">Customer journey activity</span><span className="text-[8px] text-neutral-600 md:text-[10px]">This month</span></div><div className="pointer-events-none absolute inset-0 flex flex-col justify-between px-4 pb-8 pt-12 opacity-15">{[0,1,2,3].map(i => <div key={i} className="h-px w-full border-b border-white/20" />)}</div><div className="relative mt-1 flex-1"><svg viewBox="0 0 400 150" className="h-full w-full overflow-visible" preserveAspectRatio="none"><path d="M0,120 C40,90 80,130 120,80 C160,30 200,90 240,60 C280,30 320,60 360,20 L400,40" fill="none" stroke="#c084fc" strokeWidth="2.2" /><path d="M0,140 C50,130 90,145 140,110 C190,75 230,120 280,90 C330,60 370,100 400,70" fill="none" stroke="#60a5fa" strokeWidth="1.7" opacity=".55" /><path d="M0,150 C60,145 100,155 160,130 C220,105 260,140 320,120 C380,100 390,130 400,110" fill="none" stroke="#a78bfa" strokeWidth="1.2" opacity=".35" /></svg></div><div className="mt-2 hidden justify-between px-2 text-[8px] text-neutral-600 md:flex"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span><span>Now</span></div></div>

                  <div className="col-span-1 flex flex-col rounded-xl border border-white/[0.055] bg-white/[0.018] p-3 md:p-4"><span className="mb-2 text-[10px] font-medium text-neutral-200 md:mb-4 md:text-xs">Top channels</span><div className="relative flex flex-1 items-center justify-center"><div className="relative flex h-16 w-16 items-center justify-center rounded-full md:h-24 md:w-24" style={{ background: "conic-gradient(from 180deg,#c084fc 0% 48%,#3b82f6 48% 76%,#8b5cf6 76% 92%,#6d28d9 92% 100%)" }}><div className="absolute inset-0 rounded-full border-[10px] border-[#090910] md:border-[16px]" /><div className="z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#090910] md:h-16 md:w-16"><span className="text-[9px] font-medium text-white md:text-xs">1.2K</span></div></div></div><div className="mt-2 hidden flex-col gap-2 text-[9px] md:flex">{[["WhatsApp", "48%", "bg-purple-400"], ["Website", "28%", "bg-blue-500"], ["Voice", "16%", "bg-indigo-500"]].map(([name, value, dot]) => <div key={name} className="flex items-center justify-between"><div className="flex items-center gap-1.5 text-neutral-500"><div className={`h-1.5 w-1.5 rounded-full ${dot}`} />{name}</div><span className="text-neutral-200">{value}</span></div>)}</div></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
